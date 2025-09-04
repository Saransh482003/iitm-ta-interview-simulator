import ollama
import chromadb
import json
import random

# 🔹 Load ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection("lectures")

# 🔹 Retrieve relevant context
def retrieve_context(query, top_k=3):
    query_emb = ollama.embeddings(model="nomic-embed-text", prompt=query)["embedding"]
    results = collection.query(
        query_embeddings=[query_emb],
        n_results=top_k
    )
    return results["documents"], results["metadatas"]

# 🔹 Interview evaluation step
def interview_step(question, candidate_answer):
    if not candidate_answer.strip():
        candidate_answer = "No answer provided."
    docs, _ = retrieve_context(candidate_answer)
    context = "\n\n".join([d for sublist in docs for d in sublist])

    prompt = f"""
        You are interviewing a candidate for a Teaching Assistant role.

        Lecture Context:
        {context}

        Interview Question: {question}
        Candidate Answer: {candidate_answer}

        Tasks:
        1. Evaluate correctness of the candidate's answer (score 0-5).
        2. Give short feedback (1-2 sentences).
        3. Ask a *follow-up question* that digs deeper into the candidate's answer 
        OR explores a closely related lecture concept.
        - The follow-up should feel natural, not random.
        - Avoid repeating the same question.
        - Increase difficulty slightly if the answer was correct.

        IMPORTANT!!!: Return your evaluation in the following strict JSON format:

        {{
        "score": <integer from 0 to 5>,
        "feedback": "<1-2 sentences of feedback>",
        "next_question": "<a single clear follow-up interview question>"
        }}
    """

    resp = ollama.chat(model="llama3", messages=[
        {"role": "system", "content": "You are a strict but fair interviewer who adapts follow-up questions based on the candidate's answers."},
        {"role": "user", "content": prompt}
    ])

    # Parse JSON safely
    try:
        data = json.loads(resp["message"]["content"])
    except:
        # fallback if the model outputs extra text
        text = resp["message"]["content"]
        start = text.find("{")
        end = text.rfind("}")
        data = json.loads(text[start:end+1])

    return data

# 🔹 Interview Loop
if __name__ == "__main__":
    print("🎤 TA Interview Started")
    with open("initialising_questions.json", "r") as f:
        questions = json.load(f)
    question = questions[random.randint(0, len(questions)-1)]

    for round_num in range(15):  # 15 rounds demo
        print(f"\n❓ Question {round_num+1}: {question}")
        candidate_answer = input("🧑 Candidate: ")

        result = interview_step(question, candidate_answer)

        print("\n🤖 Interviewer:")
        print("Evaluation Score:", result["score"])
        print("Feedback:", result["feedback"])
        print("Follow-up Question:", result["next_question"])

        question = result["next_question"]

