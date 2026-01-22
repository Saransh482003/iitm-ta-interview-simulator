# TA Interview Simulator

A full‑stack interview practice app that simulates a TA interview with adaptive follow‑up questions, scoring, hints, and a guided timing experience.

## What it does

- Runs a guided interview flow (intro → topic selection → follow‑ups).
- Generates follow‑up questions using an LLM with RAG context.
- Scores answers with a grading model.
- Provides optional hints based on retrieved context plus model knowledge (without revealing answers).
- Shows a per‑question timer recommended by the LLM.
- Supports webcam preview, text input, and speech‑to‑text.

## Core concepts used

### 1) Retrieval‑Augmented Generation (RAG)
The backend retrieves relevant context using a prebuilt RAPTOR summary tree and Chroma stores. This context is injected into LLM prompts for:
- follow‑up question generation
- hint generation

### 2) Multi‑stage interview flow
The backend keeps a session state with:
- `intro` → asks for self‑introduction
- `topics` → asks for comfortable topics
- `followup` → asks follow‑up questions per topic

### 3) LLM‑assisted timing
Each generated follow‑up question includes an `expected_time_seconds` value. The frontend uses it to show a countdown that gradually transitions from green to red after the half‑time mark.

### 4) Hints (context‑first, knowledge‑fallback)
Hints are generated from RAG context. If the context is insufficient, the model uses its own knowledge, but must avoid revealing the direct answer.

### 5) User control: skip
A “Skip question” control allows skipping to the next topic without relying on LLM intent detection.

### 6) Speech features
The frontend uses browser Web Speech APIs for:
- text‑to‑speech narration of questions
- speech‑to‑text answer capture

## Project layout

```
backend/
  main.py
  requirements.txt
  raptor-rag/
  chroma_store/
  chromaDB_store/
frontend/
  pages/
  styles/
  package.json
```

## How it works (flow)

1. **Start**: `/interview/start` returns the intro question.
2. **Intro answer**: `/interview/answer` moves to topic selection.
3. **Topic selection**: user provides topics; backend extracts and ranks them.
4. **Follow‑ups**: backend generates a follow‑up question + expected time.
5. **Answer**: backend grades the answer and asks the next question.
6. **Hint (optional)**: user requests a hint with a custom prompt.
7. **Skip (optional)**: user skips to the next topic.

## API endpoints

- `POST /interview/start` → start session
- `POST /interview/answer` → submit answer
- `POST /interview/hint` → get hint for current question
- `POST /interview/skip` → skip to next topic
- `GET /ollama/health` → LLM connectivity check

## Environment variables

Backend (`backend/.env`):

- `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)
- `OLLAMA_CHAT_MODEL` (default: `qwen2.5:7b`)
- `OLLAMA_GRADE_MODEL` (default: same as chat)
- `MAX_FOLLOWUPS_PER_TOPIC` (default: `3`)

Frontend:

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://127.0.0.1:8000`)

## Run locally

### Backend

1. Create venv and install deps:
   - `pip install -r backend/requirements.txt`
2. Start the API:
   - `uvicorn main:app --reload` (from `backend/`)

### Frontend

1. Install deps:
   - `npm install`
2. Start dev server:
   - `npm run dev`

## Notes

- Speech features require a compatible browser and microphone permissions.
- The RAG components depend on the included `raptor-rag` data and Chroma stores.
- The hint system is designed to avoid direct answers by instruction.

## License

Add your license here.
