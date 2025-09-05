#!/usr/bin/env python3
"""
Test script for the "I don't know" detection functionality
"""

from retrieve_relevancy import detect_dont_know_response

def test_dont_know_detection():
    """Test various "I don't know" responses"""
    
    # Test cases that should return True (detected as "I don't know")
    positive_cases = [
        "I don't know",
        "i dont know",
        "I'm not sure",
        "im not sure",
        "No idea",
        "not sure",
        "I have no idea",
        "can't remember",
        "Not familiar with this",
        "I don't know.",
        "dunno",
        "I'm unsure",
        "not certain",
        "beats me"
    ]
    
    # Test cases that should return False (NOT "I don't know")
    negative_cases = [
        "Well, I think machine learning is about training models on data",
        "Linear regression is a supervised learning algorithm",
        "I believe it has something to do with gradient descent",
        "From what I remember, it's related to optimization",
        "I think it might be related to overfitting, but I'm not completely sure of the details",
        "I know a little bit about this topic",
        "I'm somewhat familiar with this concept"
    ]
    
    print("🧪 Testing 'I don't know' detection function...")
    print("\n✅ Testing positive cases (should detect as 'I don't know'):")
    
    all_passed = True
    
    for i, case in enumerate(positive_cases, 1):
        result = detect_dont_know_response(case)
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {i:2d}. '{case}' -> {result} {status}")
        if not result:
            all_passed = False
    
    print("\n❌ Testing negative cases (should NOT detect as 'I don't know'):")
    for i, case in enumerate(negative_cases, 1):
        result = detect_dont_know_response(case)
        status = "✅ PASS" if not result else "❌ FAIL"
        print(f"  {i:2d}. '{case[:50]}...' -> {result} {status}")
        if result:
            all_passed = False
    
    print(f"\n🎯 Overall test result: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    return all_passed

if __name__ == "__main__":
    test_dont_know_detection()