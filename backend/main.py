import contextlib
import io
import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request as UrlRequest, urlopen

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

RAPTOR_RAG_PATH = os.path.join(os.path.dirname(__file__), "raptor-rag")
if RAPTOR_RAG_PATH not in sys.path:
	sys.path.append(RAPTOR_RAG_PATH)

_RAPTOR_CACHE: Dict[str, object] = {}

try:
	from langchain_ollama import ChatOllama
except Exception as exc:  # pragma: no cover
	ChatOllama = None  # type: ignore[assignment]


load_dotenv()

logging.basicConfig(
	level=logging.INFO,
	format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("ta-interview-simulator")
logging.getLogger("httpx").setLevel(logging.WARNING)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")
OLLAMA_GRADE_MODEL = os.getenv("OLLAMA_GRADE_MODEL", OLLAMA_CHAT_MODEL)

MAX_FOLLOWUPS_PER_TOPIC = int(os.getenv("MAX_FOLLOWUPS_PER_TOPIC", "3"))


app = FastAPI(title="TA Interview Simulator", version="0.1.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class StartResponse(BaseModel):
	session_id: str
	question: str
	stage: str
	expected_time_seconds: int


class AnswerRequest(BaseModel):
	session_id: str
	answer: str = Field(..., min_length=1)


class HintRequest(BaseModel):
	session_id: str
	prompt: str = Field(..., min_length=1)


class SkipRequest(BaseModel):
	session_id: str


class HintResponse(BaseModel):
	session_id: str
	stage: str
	topic: Optional[str] = None
	info: str
	info_remaining: Optional[int] = None


class AnswerResponse(BaseModel):
	session_id: str
	question: str
	stage: str
	topic: Optional[str] = None
	followup_index: int
	expected_time_seconds: Optional[int] = None
	score: Optional[int] = None
	score_reason: Optional[str] = None
	info: Optional[str] = None
	info_remaining: Optional[int] = None


class SessionState(BaseModel):
	session_id: str
	stage: str
	topic_index: int
	followup_index: int
	topics: List[str]
	last_question: str
	history: List[Dict]
	created_at: str
	info_used: int = 0


SESSIONS: Dict[str, SessionState] = {}


INTRO_QUESTION = "Let's start with an introduction. Can you briefly introduce yourself?"
TOPICS_QUESTION = (
	"What topics are you most comfortable with? "
	"Please list them in order of comfort, separated by commas."
)


def _ensure_llm() -> ChatOllama:
	if ChatOllama is None:
		raise HTTPException(status_code=500, detail="langchain_ollama is not available")
	_check_ollama_accessible()
	return ChatOllama(model=OLLAMA_CHAT_MODEL, base_url=OLLAMA_BASE_URL, keep_alive=0)


def _ensure_grader() -> ChatOllama:
	if ChatOllama is None:
		raise HTTPException(status_code=500, detail="langchain_ollama is not available")
	_check_ollama_accessible()
	return ChatOllama(model=OLLAMA_GRADE_MODEL, base_url=OLLAMA_BASE_URL, keep_alive=0)


def _check_ollama_accessible() -> None:
	url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags"
	request = UrlRequest(url, method="GET")
	try:
		with urlopen(request, timeout=3) as response:
			if response.status != 200:
				raise HTTPException(
					status_code=503,
					detail=f"Ollama not reachable (status {response.status})",
				)
	except URLError as exc:
		raise HTTPException(status_code=503, detail=f"Ollama not reachable: {exc}")


def _extract_topics(answer: str) -> List[str]:
	llm = _ensure_llm()
	system = (
		"Extract a ranked list of 2-6 interview topics from the candidate's answer. "
		"Return strict JSON: {\"topics\": [\"topic1\", \"topic2\", ...]}"
	)
	user = f"Candidate answer: {answer}"
	try:
		response = llm.invoke([{"role": "system", "content": system}, 
				               {"role": "user", "content": user}])
		payload = json.loads(response.content)
		topics = [t.strip() for t in payload.get("topics", []) if t.strip()]
	except Exception:
		topics = [t.strip() for t in answer.split(",") if t.strip()]

	if not topics:
		topics = ["linear regression", "support vector machines", "decision trees"]
	return topics[:6]


def _is_dont_know(answer: str) -> bool:
	patterns = [
		r"\b(don't|dont)\s+know\b",
		r"\bno\s+idea\b",
		r"\bnot\s+sure\b",
		r"\bcan't\s+answer\b",
		r"\bcannot\s+answer\b",
		r"\bnot\s+familiar\b",
		r"\bhaven't\s+learned\b",
		r"\bno\s+clue\b",
	]
	text = answer.lower()
	return any(re.search(p, text) for p in patterns)


def _is_info_request(answer: str) -> bool:
	patterns = [
		r"\bmore\s+info\b",
		r"\bmore\s+information\b",
		r"\bclarify\b",
		r"\bcan\s+you\s+explain\b",
		r"\bplease\s+explain\b",
		r"\belaborate\b",
		r"\bhint\b",
		r"\bhelp\b",
		r"\bwhat\s+does\s+that\s+mean\b",
	]
	text = answer.lower()
	return any(re.search(p, text) for p in patterns)


def _is_clarification_question(answer: str) -> bool:
	text = answer.strip().lower()
	if "?" not in text:
		return False
	patterns = [
		r"^what\s+is\b",
		r"^what\s+are\b",
		r"^why\b",
		r"^how\b",
		r"^can\s+you\b",
		r"^could\s+you\b",
		r"^define\b",
		r"^explain\b",
	]
	return any(re.search(p, text) for p in patterns)


def _classify_user_intent(answer: str, question: str, topic: str) -> str:
	"""Classify user intent: clarify, dont_know_topic, dont_know_question, answer."""
	llm = _ensure_llm()
	system = (
		"You are an intent classifier for interview responses. "
		"Return STRICT JSON: {\"intent\": "
		"\"clarify\"|\"dont_know_topic\"|\"dont_know_question\"|\"answer\"}. "
		"Definitions: "
		"clarify = asking for explanation or hint (e.g., 'can you clarify?'); "
		"dont_know_topic = says they don't know the topic or are not familiar with it; "
		"dont_know_question = says they don't know the question/answer but not the topic; "
		"answer = provides an answer attempt."
	)
	user = (
		f"Topic: {topic}\n"
		f"Question: {question}\n"
		f"Response: {answer}"
	)
	try:
		response = llm.invoke([
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		])
		payload = json.loads(response.content)
		intent = str(payload.get("intent", "answer")).strip().lower()
		if intent in {"clarify", "dont_know_topic", "dont_know_question", "answer"}:
			return intent
	except Exception:
		pass

	# Fallback heuristics
	if _is_info_request(answer) or _is_clarification_question(answer):
		return "clarify"
	if _is_dont_know(answer):
		text = answer.lower()
		if any(key in text for key in ["topic", "subject", "area", "field", "this topic"]):
			return "dont_know_topic"
		return "dont_know_question"
	return "answer"


def _provide_info_without_answer(question: str, topic: str, prompt: Optional[str] = None) -> str:
	llm = _ensure_llm()
	query = f"{topic} {question}"
	if prompt:
		query = f"{query} {prompt}"
	context = _retrieve_context(query)
	system = (
		"Provide a short clarification or definition for the question. "
		"First, use the provided context. If the context is insufficient, "
		"use your general knowledge to add a brief clarification. "
		"STRICTLY Do NOT reveal the answer in any case. Answer as precisely as possible and as less as possible."
	)
	user = f"Question: {question}\nUser hint request: {prompt or ''}\nContext:\n{context}"
	response = llm.invoke([{"role": "system", "content": system}, {"role": "user", "content": user}])
	return response.content.strip()


def _get_raptor_components() -> Dict[str, object]:
	if _RAPTOR_CACHE:
		return _RAPTOR_CACHE
	try:
		from mechanics import retrieval_mechs  # type: ignore
	except Exception as exc:  # pragma: no cover
		raise HTTPException(status_code=500, detail=f"RAPTOR retrieval not available: {exc}")

	_RAPTOR_CACHE["raptor_retrieve"] = retrieval_mechs.raptor_retrieve
	_RAPTOR_CACHE["summary_tree"] = retrieval_mechs.summary_tree
	return _RAPTOR_CACHE


def _retrieve_context(query: str) -> str:
	raptor = _get_raptor_components()
	silent_stdout = io.StringIO()
	silent_stderr = io.StringIO()
	with contextlib.redirect_stdout(silent_stdout), contextlib.redirect_stderr(silent_stderr):
		retrieval = raptor["raptor_retrieve"](
			query=query,
			summary_tree=raptor["summary_tree"],
			top_k_root=5,
			top_k_children=2,
			use_query_refinement=False,
			enable_keyword_rescue=False,
		)
	contexts = retrieval.get("all_contexts", [])
	if not contexts:
		return ""
	joined = []
	for ctx in contexts:
		content = ctx.get("content", "")
		source = ctx.get("source", "unknown")
		joined.append(f"Source: {source}\n{content}")
	return "\n\n".join(joined)


def _grade_answer(question: str, answer: str, topic: str) -> Dict[str, object]:
	grader = _ensure_grader()
	system = (
		"""You are a strict interview grader. 
		This interview is for the position of a Teaching Assistant for the Machine Learning Practices course.
		Score the candidate's answer on a 0-5 scale. "
		Return STRICT JSON: {\"score\": <int 0-5>, \"reason\": \"short reason\"}."""
	)
	user = (
		f"Topic: {topic}\n"
		f"Question: {question}\n"
		f"Answer: {answer}"
	)
	response = grader.invoke([{"role": "system", "content": system}, {"role": "user", "content": user}])
	try:
		payload = json.loads(response.content)
		score = int(payload.get("score", 0))
		score = max(0, min(5, score))
		reason = str(payload.get("reason", "")).strip()
	except Exception:
		score, reason = 0, "Unable to parse grading response."
	return {"score": score, "reason": reason}


def _generate_followup_question(
	topic: str,
	candidate_answer: str,
	last_question: str,
	followup_index: int,
) -> Dict[str, object]:
	llm = _ensure_llm()
	retrieval_query = f"{topic} {candidate_answer}"
	context = _retrieve_context(retrieval_query)

	system = (
		"You are an interview simulator. Generate the next follow-up question and an expected "
		"answer time in seconds. Complex or explanation-heavy questions should get more time. "
		"Return STRICT JSON: {\"question\": \"...\", \"time_seconds\": <int>}"
	)
	user = (
		f"Topic: {topic}\n"
		f"Follow-up index: {followup_index}\n"
		f"Previous question: {last_question}\n"
		f"Candidate answer: {candidate_answer}\n"
		f"Relevant context:\n{context}"
	)
	response = llm.invoke([{"role": "system", "content": system}, {"role": "user", "content": user}])
	try:
		payload = json.loads(response.content)
		question = str(payload.get("question", "")).strip()
		time_seconds = int(payload.get("time_seconds", 60))
		if not question:
			raise ValueError("Empty question")
		if time_seconds < 15:
			time_seconds = 15
		if time_seconds > 300:
			time_seconds = 300
		return {"question": question, "time_seconds": time_seconds}
	except Exception:
		fallback_question = response.content.strip()
		fallback_time = min(180, max(30, 20 + len(fallback_question) // 6))
		return {"question": fallback_question, "time_seconds": fallback_time}


def _get_current_topic(state: SessionState) -> str:
	if not state.topics:
		return "decision trees"
	if state.topic_index >= len(state.topics):
		return state.topics[-1]
	return state.topics[state.topic_index]


@app.get("/")
def health() -> Dict[str, str]:
	return {"status": "ok", "service": "ta-interview-simulator"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
	logger.exception("Unhandled error on %s %s", request.method, request.url.path)
	return JSONResponse(
		status_code=500,
		content={"detail": "Internal Server Error"},
	)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
	if exc.status_code >= 500:
		logger.error(
			"HTTPException %s on %s %s: %s",
			exc.status_code,
			request.method,
			request.url.path,
			exc.detail,
		)
	return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/ollama/health")
def ollama_health() -> Dict[str, str]:
	_check_ollama_accessible()
	return {"status": "ok", "ollama": OLLAMA_BASE_URL}


@app.middleware("http")
async def disable_cache_headers(request: Request, call_next):
	response: Response = await call_next(request)
	response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
	response.headers["Pragma"] = "no-cache"
	response.headers["Expires"] = "0"
	return response


@app.post("/interview/start", response_model=StartResponse)
def start_interview() -> StartResponse:
	session_id = str(uuid.uuid4())
	state = SessionState(
		session_id=session_id,
		stage="intro",
		topic_index=0,
		followup_index=0,
		topics=[],
		last_question=INTRO_QUESTION,
		history=[],
		created_at=datetime.utcnow().isoformat(),
		info_used=0,
	)
	SESSIONS[session_id] = state
	return StartResponse(
		session_id=session_id,
		question=INTRO_QUESTION,
		stage="intro",
		expected_time_seconds=45,
	)


@app.post("/interview/answer", response_model=AnswerResponse)
def submit_answer(payload: AnswerRequest) -> AnswerResponse:
	state = SESSIONS.get(payload.session_id)
	if not state:
		raise HTTPException(status_code=404, detail="Session not found")

	answer = payload.answer.strip()

	if state.stage == "intro":
		state.history.append({"question": state.last_question, "answer": answer, "score": None})
		state.stage = "topics"
		state.last_question = TOPICS_QUESTION
		return AnswerResponse(
			session_id=state.session_id,
			question=TOPICS_QUESTION,
			stage=state.stage,
			followup_index=state.followup_index,
			expected_time_seconds=40,
		)

	if state.stage == "topics":
		state.history.append({"question": state.last_question, "answer": answer, "score": None})
		state.topics = _extract_topics(answer)
		state.stage = "followup"
		state.followup_index = 0
		state.topic_index = 0
		topic = _get_current_topic(state)
		question_payload = _generate_followup_question(topic, answer, state.last_question, 1)
		state.last_question = str(question_payload["question"])
		return AnswerResponse(
			session_id=state.session_id,
			question=str(question_payload["question"]),
			stage=state.stage,
			topic=topic,
			followup_index=state.followup_index,
			expected_time_seconds=int(question_payload["time_seconds"]),
		)

	if state.stage == "followup":
		topic = _get_current_topic(state)
		grading = _grade_answer(state.last_question, answer, topic)
		state.history.append(
			{
				"question": state.last_question,
				"answer": answer,
				"score": grading["score"],
				"reason": grading["reason"],
				"topic": topic,
			}
		)

		state.followup_index += 1

		if state.followup_index >= MAX_FOLLOWUPS_PER_TOPIC:
			state.topic_index += 1
			state.followup_index = 0

		next_topic = _get_current_topic(state)
		question_payload = _generate_followup_question(
			next_topic,
			answer,
			state.last_question,
			state.followup_index + 1,
		)
		state.last_question = str(question_payload["question"])

		return AnswerResponse(
			session_id=state.session_id,
			question=str(question_payload["question"]),
			stage=state.stage,
			topic=next_topic,
			followup_index=state.followup_index,
			expected_time_seconds=int(question_payload["time_seconds"]),
			score=int(grading["score"]),
			score_reason=str(grading["reason"]),
		)

	raise HTTPException(status_code=400, detail="Invalid session state")


@app.post("/interview/hint", response_model=HintResponse)
def request_hint(payload: HintRequest) -> HintResponse:
	state = SESSIONS.get(payload.session_id)
	if not state:
		raise HTTPException(status_code=404, detail="Session not found")
	if state.stage != "followup":
		raise HTTPException(status_code=400, detail="Hints are only available during follow-ups")

	max_hints = 3
	remaining = max(0, max_hints - state.info_used)
	if remaining <= 0:
		return HintResponse(
			session_id=state.session_id,
			stage=state.stage,
			topic=_get_current_topic(state),
			info="Hint limit reached for this session.",
			info_remaining=0,
		)

	topic = _get_current_topic(state)
	info = _provide_info_without_answer(state.last_question, topic, prompt=payload.prompt.strip())
	state.info_used += 1
	remaining = max(0, max_hints - state.info_used)
	return HintResponse(
		session_id=state.session_id,
		stage=state.stage,
		topic=topic,
		info=info,
		info_remaining=remaining,
	)


@app.post("/interview/skip", response_model=AnswerResponse)
def skip_question(payload: SkipRequest) -> AnswerResponse:
	state = SESSIONS.get(payload.session_id)
	if not state:
		raise HTTPException(status_code=404, detail="Session not found")
	if state.stage != "followup":
		raise HTTPException(status_code=400, detail="Skip is only available during follow-ups")

	state.history.append(
		{"question": state.last_question, "answer": "Skipped", "score": None, "reason": "Skipped"}
	)
	state.topic_index += 1
	state.followup_index = 0
	next_topic = _get_current_topic(state)
	question_payload = _generate_followup_question(next_topic, "Skipped", state.last_question, 1)
	state.last_question = str(question_payload["question"])
	return AnswerResponse(
		session_id=state.session_id,
		question=str(question_payload["question"]),
		stage=state.stage,
		topic=next_topic,
		followup_index=state.followup_index,
		expected_time_seconds=int(question_payload["time_seconds"]),
	)
