#!/usr/bin/env python3
"""
Test script to verify interview question progression
"""

import json
import random
from retrieve_relevancy import interview_step

def test_interview_progression():
    # Load initial questions
    with open("./initialising_questions.json", "r") as f:
        questions = json.load(f)
    
    # Start with a formatted initial question
    initial_question_text = questions[random.randint(0, len(questions)-1)]
    current_question = f"Question 1: {initial_question_text}"
    
    print("=== INTERVIEW PROGRESSION TEST ===")
    print(f"Starting question: {current_question}")
    
    # Simulate 5 rounds of interview
    for round_num in range(1, 6):
        print(f"\n--- Round {round_num} ---")
        print(f"Question: {current_question}")
        
        # Simulate a candidate answer
        sample_answers = [
            "Machine learning is a subset of AI that enables computers to learn from data without explicit programming.",
            "Supervised learning uses labeled data, unsupervised finds patterns in unlabeled data, and reinforcement learning uses rewards.",
            "Classification predicts categories while regression predicts continuous values.",
            "Overfitting occurs when a model is too complex and memorizes training data instead of learning patterns.",
            "Data splitting helps evaluate model performance on unseen data to prevent overfitting."
        ]
        
        candidate_answer = sample_answers[min(round_num-1, len(sample_answers)-1)]
        print(f"Simulated Answer: {candidate_answer}")
        
        # Get next question
        try:
            result = interview_step(current_question, candidate_answer, round_num)
            print(f"Score: {result['score']}")
            print(f"Feedback: {result['feedback']}")
            print(f"Next Question: {result['next_question']}")
            
            current_question = result['next_question']
            
            # Verify question numbering
            expected_num = round_num + 1
            if f"Question {expected_num}:" in current_question:
                print(f"✅ Question numbering correct for round {expected_num}")
            else:
                print(f"❌ Question numbering incorrect. Expected 'Question {expected_num}:' but got: {current_question}")
                
        except Exception as e:
            print(f"❌ Error in round {round_num}: {e}")
            break
    
    print("\n=== TEST COMPLETED ===")

if __name__ == "__main__":
    test_interview_progression()