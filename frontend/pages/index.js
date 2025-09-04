import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roundNumber, setRoundNumber] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const [lastFeedback, setLastFeedback] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Speech and Camera states
  const [isRecording, setIsRecording] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setUserAnswer(prev => prev + ' ' + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  // Camera functions
  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      setCameraStream(stream);
      setCameraEnabled(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const disableCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraEnabled(false);
  };

  // Speech recognition functions
  const startRecording = () => {
    if (recognitionRef.current && speechSupported) {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://3296734498b4.ngrok-free.app/api/start-interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentQuestion(data.question);
        setRoundNumber(data.round_number);
        setInterviewStarted(true);
        setLastScore(null);
        setLastFeedback('');
        setTotalScore(0);
        setAverageScore(0);
        setInterviewHistory([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Make sure the backend server is running on port 5000.');
    }
    setIsLoading(false);
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) {
      alert('Please provide an answer before submitting.');
      return;
    }

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://3296734498b4.ngrok-free.app/api/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer: userAnswer }),
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setLastScore(data.score);
        setLastFeedback(data.feedback);
        setCurrentQuestion(data.next_question);
        setRoundNumber(data.round_number);
        setTotalScore(data.total_score);
        setAverageScore(data.average_score);
        setUserAnswer('');
        setShowResults(true);
        
        // Add to history
        setInterviewHistory(prev => [...prev, {
          question: currentQuestion,
          answer: userAnswer,
          score: data.score,
          feedback: data.feedback
        }]);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer. Please try again.');
    }
    setIsLoading(false);
  };

  const continueInterview = () => {
    setShowResults(false);
    setLastScore(null);
    setLastFeedback('');
  };

  const endInterview = async () => {
    setIsLoading(true);
    
    // Stop recording and camera
    if (isRecording) {
      stopRecording();
    }
    disableCamera();
    
    try {
      const response = await fetch('https://3296734498b4.ngrok-free.app/api/end-interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('Interview ended:', data);
      
      setInterviewStarted(false);
      setCurrentQuestion('');
      setUserAnswer('');
      setRoundNumber(0);
      setShowResults(false);
    } catch (error) {
      console.error('Error ending interview:', error);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score) => {
    if (score >= 4) return '#4CAF50'; // Green
    if (score >= 3) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 4) return 'Excellent';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>ML Teaching Assistant Interview</title>
        <meta name="description" content="Machine Learning Teaching Assistant Interview System" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          🎓 MLP Teaching Assistant Interview
        </h1>

        {!interviewStarted ? (
          <div className={styles.startScreen}>
            <p className={styles.description}>
              Welcome to the Machine Learning Teaching Assistant interview system.
              This interactive interview will test your knowledge of ML concepts
              and provide real-time feedback based on course materials.
            </p>
            
            {/* Camera Setup */}
            <div className={styles.setupOptions}>
              <div className={styles.setupOption}>
                <label className={styles.setupLabel}>
                  <input
                    type="checkbox"
                    checked={cameraEnabled}
                    onChange={(e) => e.target.checked ? enableCamera() : disableCamera()}
                    className={styles.setupCheckbox}
                  />
                  Enable Camera (Optional)
                </label>
                <p className={styles.setupDescription}>
                  Turn on your camera for a more interactive interview experience
                </p>
              </div>
              
              {speechSupported && (
                <div className={styles.setupOption}>
                  <p className={styles.setupInfo}>
                    🎤 Speech input is available! You can speak your answers during the interview.
                  </p>
                </div>
              )}
            </div>
            
            <button 
              className={styles.startButton}
              onClick={startInterview}
              disabled={isLoading}
            >
              {isLoading ? 'Starting Interview...' : 'Start Interview'}
            </button>
          </div>
        ) : (
          <div className={styles.interviewScreen}>
            {/* Camera Feed */}
            {cameraEnabled && (
              <div className={styles.cameraContainer}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className={styles.cameraFeed}
                />
                <div className={styles.cameraControls}>
                  <button
                    className={styles.cameraToggle}
                    onClick={disableCamera}
                    title="Turn off camera"
                  >
                    📷 ❌
                  </button>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className={styles.progressBar}>
              <div className={styles.progressInfo}>
                <span>Round {roundNumber}</span>
                {totalScore > 0 && (
                  <span>Average Score: {averageScore}/5</span>
                )}
              </div>
            </div>

            {/* Results Display */}
            {showResults && lastScore !== null && (
              <div className={styles.resultsCard}>
                <h3>📊 Your Performance</h3>
                <div className={styles.scoreDisplay}>
                  <div 
                    className={styles.scoreCircle}
                    style={{ backgroundColor: getScoreColor(lastScore) }}
                  >
                    {lastScore}/5
                  </div>
                  <div className={styles.scoreLabel}>
                    {getScoreLabel(lastScore)}
                  </div>
                </div>
                <div className={styles.feedback}>
                  <strong>Feedback:</strong> {lastFeedback}
                </div>
                <button 
                  className={styles.continueButton}
                  onClick={continueInterview}
                >
                  Continue to Next Question
                </button>
              </div>
            )}

            {/* Question Display */}
            {!showResults && (
              <div className={styles.questionCard}>
                <h3>❓ Question {roundNumber}</h3>
                <p className={styles.question}>{currentQuestion}</p>
                
                <div className={styles.answerSection}>
                  <div className={styles.inputControls}>
                    <textarea
                      className={styles.answerInput}
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer here or use speech input..."
                      rows={6}
                      disabled={isLoading}
                    />
                    
                    {/* Speech Controls */}
                    {speechSupported && (
                      <div className={styles.speechControls}>
                        <button
                          className={`${styles.speechButton} ${isRecording ? styles.recording : ''}`}
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={isLoading}
                          title={isRecording ? "Stop recording" : "Start speech input"}
                        >
                          {isRecording ? '🎤 Stop' : '🎤 Speak'}
                        </button>
                        {isRecording && (
                          <span className={styles.recordingIndicator}>Recording...</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.inputHint}>
                    💡 You can type your answer or click the microphone to speak
                  </div>
                </div>
                
                <div className={styles.buttonGroup}>
                  <button 
                    className={styles.submitButton}
                    onClick={submitAnswer}
                    disabled={isLoading || !userAnswer.trim()}
                  >
                    {isLoading ? 'Evaluating...' : 'Submit Answer'}
                  </button>
                  
                  <button 
                    className={styles.endButton}
                    onClick={endInterview}
                    disabled={isLoading}
                  >
                    End Interview
                  </button>
                </div>
              </div>
            )}

            {/* Interview History */}
            {interviewHistory.length > 0 && (
              <div className={styles.historyCard}>
                <h3>📝 Interview History</h3>
                <div className={styles.historyList}>
                  {interviewHistory.map((item, index) => (
                    <div key={index} className={styles.historyItem}>
                      <div className={styles.historyQuestion}>
                        <strong>Q{index + 1}:</strong> {item.question.substring(0, 100)}...
                      </div>
                      <div className={styles.historyScore}>
                        Score: <span style={{ color: getScoreColor(item.score) }}>
                          {item.score}/5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
