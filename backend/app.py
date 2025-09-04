from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import random
from retrieve_relevancy import interview_step

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variable to store interview state
interview_state = {
    "current_question": None,
    "round_number": 0,
    "total_score": 0,
    "history": []
}

@app.route('/api/start-interview', methods=['POST'])
def start_interview():
    """Initialize a new interview session"""
    global interview_state
    
    # Load initial questions
    with open("./initialising_questions.json", "r") as f:
        questions = json.load(f)
    
    # Pick a random starting question and format it properly
    initial_question_text = questions[random.randint(0, len(questions)-1)]
    initial_question = f"Question 1: {initial_question_text}"
    
    # Reset interview state
    interview_state = {
        "current_question": initial_question,
        "round_number": 1,
        "total_score": 0,
        "history": []
    }
    
    return jsonify({
        "status": "success",
        "question": initial_question,
        "round_number": 1
    })

@app.route('/api/submit-answer', methods=['POST'])
def submit_answer():
    """Process candidate answer and return evaluation"""
    global interview_state
    
    data = request.get_json()
    candidate_answer = data.get('answer', '')
    current_question = interview_state["current_question"]
    
    if not current_question:
        return jsonify({"error": "No active interview session"}), 400
    
    # Get evaluation from the backend
    try:
        print(f"DEBUG: Processing answer for Round {interview_state['round_number']}")
        print(f"DEBUG: Current question: {current_question}")
        print(f"DEBUG: Candidate answer: {candidate_answer[:100]}...")
        
        result = interview_step(current_question, candidate_answer, interview_state["round_number"])
        
        print(f"DEBUG: Generated next question: {result['next_question']}")
        
        # Update interview state
        interview_state["round_number"] += 1
        interview_state["total_score"] += result["score"]
        interview_state["history"].append({
            "question": current_question,
            "answer": candidate_answer,
            "score": result["score"],
            "feedback": result["feedback"]
        })
        interview_state["current_question"] = result["next_question"]
        
        print(f"DEBUG: Updated to Round {interview_state['round_number']}")
        
        return jsonify({
            "status": "success",
            "score": result["score"],
            "feedback": result["feedback"],
            "next_question": result["next_question"],
            "round_number": interview_state["round_number"],
            "total_score": interview_state["total_score"],
            "average_score": round(interview_state["total_score"] / (interview_state["round_number"] - 1), 2)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/interview-status', methods=['GET'])
def get_interview_status():
    """Get current interview status"""
    return jsonify({
        "current_question": interview_state["current_question"],
        "round_number": interview_state["round_number"],
        "total_score": interview_state["total_score"],
        "history": interview_state["history"]
    })

@app.route('/api/end-interview', methods=['POST'])
def end_interview():
    """End the current interview session"""
    global interview_state
    
    final_stats = {
        "total_rounds": interview_state["round_number"] - 1,
        "total_score": interview_state["total_score"],
        "average_score": round(interview_state["total_score"] / max(1, interview_state["round_number"] - 1), 2),
        "history": interview_state["history"]
    }
    
    # Reset state
    interview_state = {
        "current_question": None,
        "round_number": 0,
        "total_score": 0,
        "history": []
    }
    
    return jsonify({
        "status": "Interview completed",
        "final_stats": final_stats
    })

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)