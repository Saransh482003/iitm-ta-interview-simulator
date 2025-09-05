import ollama
import chromadb
import json
import random

# 🔹 Load ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection("lectures")

# 🔹 Retrieve relevant context
def retrieve_context(query, top_k=3):
    try:
        results = collection.query(query_texts=[query], n_results=top_k)
        return results["documents"], results["distances"]
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return [[""]], [[1.0]]

# 🔹 Interview evaluation step
def interview_step(question, candidate_answer, round_number=1, should_shift_topic=False):
    if not candidate_answer.strip():
        candidate_answer = "No answer provided."
    docs, _ = retrieve_context(candidate_answer)
    context = "\n\n".join([d for sublist in docs for d in sublist])

    # Create difficulty progression based on round number
    difficulty_guidance = ""
    if round_number <= 3:
        difficulty_guidance = "Keep the follow-up question at a basic to intermediate level. Focus on fundamental concepts."
    elif round_number <= 6:
        difficulty_guidance = "Ask an intermediate level follow-up question. Build upon the basic concepts."
    else:
        difficulty_guidance = "Ask a more advanced follow-up question. Explore deeper implications and complex scenarios."

    # Topic shifting logic
    if should_shift_topic:
        try:
            # Load available topics from initial questions
            with open("./initialising_questions.json", "r") as f:
                questions = json.load(f)
            
            new_topic_question = questions[random.randint(0, len(questions)-1)]
            topic_instruction = f"""
            IMPORTANT: This is a TOPIC SHIFT. After evaluating the current answer, you must introduce a NEW topic.
            
            Use this new topic question as inspiration: "{new_topic_question}"
            
            Your next question should:
            - Move to a completely different ML concept/topic
            - Be related to the new topic question provided above
            - Start fresh (don't reference the previous topic)
            - Be clear and well-structured for a new discussion thread
            """
        except Exception as e:
            print(f"Error loading questions for topic shift: {e}")
            topic_instruction = """
            IMPORTANT: This is a TOPIC SHIFT. After evaluating the current answer, you must introduce a NEW topic.
            Your next question should move to a completely different ML concept/topic.
            """
    else:
        topic_instruction = """
        Continue with the SAME TOPIC. Ask a follow-up question that:
        - Builds directly on the current conversation
        - Explores the same concept more deeply
        - Maintains logical flow from the previous questions
        """

    prompt = f"""
        You are interviewing a candidate for a Teaching Assistant role.
        This is round {round_number} of the interview.

        Lecture Context:
        {context}

        Current Interview Question: {question}
        Candidate Answer: {candidate_answer}

        Tasks:
        1. Evaluate correctness of the candidate's answer (score 0-5).
        2. Give short feedback (1-2 sentences).
        3. Ask a *follow-up question* that builds logically on this conversation.
        
        {topic_instruction}
        
        Follow-up Question Guidelines:
        - {difficulty_guidance}
        - Number your question clearly as "Question {round_number + 1}: [your question]"
        - If the candidate answered well, explore deeper aspects of the concept
        - If the candidate struggled, ask a simpler question on the same topic

        IMPORTANT!!!: Return your evaluation in the following strict JSON format:

        {{
        "score": <integer from 0 to 5>,
        "feedback": "<1-2 sentences of feedback>",
        "next_question": "Question {round_number + 1}: <a single clear follow-up interview question>"
        }}
    """

    resp = ollama.chat(model="llama3", messages=[
        {"role": "system", "content": f"You are a systematic interviewer conducting round {round_number}. You follow logical question progression and {'shift to new topics when instructed' if should_shift_topic else 'maintain topic coherence throughout the interview'}."},
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

    # Ensure the question is properly formatted with the correct number
    next_question = data["next_question"]
    expected_question_num = round_number + 1
    
    # Check if the question already has proper numbering
    if not next_question.startswith(f"Question {expected_question_num}:"):
        # Remove any existing question numbering
        if next_question.startswith("Question"):
            # Find the end of the question number part
            colon_index = next_question.find(":")
            if colon_index != -1:
                next_question = next_question[colon_index + 1:].strip()
        
        # Add the correct question number
        data["next_question"] = f"Question {expected_question_num}: {next_question}"
    
    print(f"DEBUG: Generated question for round {expected_question_num}: {data['next_question']}")
    print(f"DEBUG: Topic shift applied: {should_shift_topic}")
    
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

        # Simulate topic shifting every 3 questions
        should_shift = (round_num + 1) % 3 == 0
        result = interview_step(question, candidate_answer, round_num + 1, should_shift)

        print("\n🤖 Interviewer:")
        print("Evaluation Score:", result["score"])
        print("Feedback:", result["feedback"])
        print("Follow-up Question:", result["next_question"])

        question = result["next_question"]

