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
  
  // Browser compatibility check
  const [browserInfo, setBrowserInfo] = useState({
    speech: false,
    camera: false,
    browser: ''
  });
  
  // Question narration states
  const [isNarrating, setIsNarrating] = useState(false);
  const [speechSynthSupported, setSpeechSynthSupported] = useState(false);
  
  // Speech recognition enhancement states
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Check browser compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;
      let browserName = 'Unknown';
      
      if (userAgent.indexOf('Chrome') > -1) browserName = 'Chrome';
      else if (userAgent.indexOf('Firefox') > -1) browserName = 'Firefox';
      else if (userAgent.indexOf('Safari') > -1) browserName = 'Safari';
      else if (userAgent.indexOf('Edge') > -1) browserName = 'Edge';
      
      const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasSpeechSynth = !!(window.speechSynthesis);
      
      setBrowserInfo({
        speech: hasSpeech,
        camera: hasCamera,
        browser: browserName
      });
      
      setSpeechSynthSupported(hasSpeechSynth);
      
      console.log('Browser compatibility:', { browserName, hasSpeech, hasCamera, hasSpeechSynth });
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Checking speech recognition support...');
      
      // Check for various speech recognition implementations
      const SpeechRecognition = window.SpeechRecognition || 
                               window.webkitSpeechRecognition || 
                               window.mozSpeechRecognition || 
                               window.msSpeechRecognition;
      
      if (SpeechRecognition) {
        console.log('Speech recognition supported!');
        setSpeechSupported(true);
        
        try {
          recognitionRef.current = new SpeechRecognition();
          
          // Enhanced configuration for better accuracy
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'en-US';
          recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives
          
          // Adjust for better audio capture
          if ('webkitSpeechRecognition' in window) {
            // Chrome-specific optimizations
            recognitionRef.current.serviceURI = 'wss://www.google.com/speech-api/v2/recognize';
          }

          recognitionRef.current.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            // Process all results from the last processed index
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = result[0].transcript;
              
              if (result.isFinal) {
                finalTranscript += transcript;
                console.log('Final transcript:', transcript);
              } else {
                interimTranscript += transcript;
                console.log('Interim transcript:', transcript);
              }
            }
            
            // Update interim transcript for preview
            setInterimTranscript(interimTranscript);
            
            // Update the answer with final transcript
            if (finalTranscript) {
              setUserAnswer(prev => {
                const newValue = prev ? prev + ' ' + finalTranscript : finalTranscript;
                console.log('Updated answer:', newValue);
                return newValue.trim();
              });
              // Clear interim when we get final
              setInterimTranscript('');
            }
          };

          recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error, event);
            
            // Handle different error types
            if (event.error === 'not-allowed') {
              alert('Microphone access was denied. Please allow microphone access and refresh the page.');
            } else if (event.error === 'no-speech') {
              console.log('No speech detected, continuing...');
              // Don't stop recording for no-speech, just continue
              return;
            } else if (event.error === 'audio-capture') {
              alert('No microphone was found. Please ensure your microphone is connected and try again.');
            } else if (event.error === 'network') {
              alert('Network error occurred. Please check your internet connection.');
            } else if (event.error === 'aborted') {
              console.log('Speech recognition was aborted');
            } else {
              console.log('Speech recognition error:', event.error);
            }
            
            setIsRecording(false);
          };

          recognitionRef.current.onend = () => {
            console.log('Speech recognition ended');
            setIsRecording(false);
          };

          recognitionRef.current.onstart = () => {
            console.log('Speech recognition started');
            setIsRecording(true);
            setIsListening(true);
          };

          recognitionRef.current.onspeechstart = () => {
            console.log('Speech detected');
            setIsListening(true);
          };

          recognitionRef.current.onspeechend = () => {
            console.log('Speech ended');
            setIsListening(false);
          };

          recognitionRef.current.onnomatch = () => {
            console.log('No speech match found');
          };
          
        } catch (error) {
          console.error('Failed to initialize speech recognition:', error);
          setSpeechSupported(false);
        }
      } else {
        console.log('Speech recognition not supported in this browser');
        setSpeechSupported(false);
      }
    }
  }, []);

  // Camera functions
  const enableCamera = async () => {
    try {
      console.log('Requesting camera access...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      
      console.log('Camera access granted, setting up video...');
      setCameraStream(stream);
      setCameraEnabled(true);
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Ensure video plays
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(error => {
            console.error('Error playing video:', error);
          });
        };
      }
      
      console.log('Camera setup complete');
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraEnabled(false);
      
      if (error.name === 'NotAllowedError') {
        alert('Camera access was denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera found on this device.');
      } else if (error.name === 'NotReadableError') {
        alert('Camera is already in use by another application.');
      } else {
        alert('Could not access camera: ' + error.message);
      }
    }
  };

  const disableCamera = () => {
    console.log('Disabling camera...');
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraEnabled(false);
    console.log('Camera disabled');
  };

  // Speech recognition functions
  const startRecording = () => {
    if (recognitionRef.current && speechSupported) {
      try {
        console.log('Starting speech recognition...');
        
        // Stop any existing recognition first
        if (isRecording) {
          recognitionRef.current.stop();
        }
        
        // Small delay to ensure clean start
        setTimeout(() => {
          try {
            setIsRecording(true);
            recognitionRef.current.start();
            
            // Auto-restart if it stops unexpectedly (for continuous recording)
            const restartTimeout = setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                console.log('Auto-restarting speech recognition for continuous capture...');
                try {
                  recognitionRef.current.stop();
                  setTimeout(() => {
                    if (isRecording) {
                      recognitionRef.current.start();
                    }
                  }, 100);
                } catch (restartError) {
                  console.error('Error restarting speech recognition:', restartError);
                }
              }
            }, 10000); // Restart every 10 seconds for continuous capture
            
            // Store timeout for cleanup
            recognitionRef.current.restartTimeout = restartTimeout;
            
          } catch (startError) {
            console.error('Error during recognition start:', startError);
            setIsRecording(false);
            alert('Could not start speech recognition: ' + startError.message);
          }
        }, 100);
        
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsRecording(false);
        alert('Could not start speech recognition: ' + error.message);
      }
    } else {
      console.log('Speech recognition not available');
      alert('Speech recognition is not available in your browser. Please use Chrome, Edge, or Safari.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        console.log('Stopping speech recognition...');
        
        // Clear restart timeout
        if (recognitionRef.current.restartTimeout) {
          clearTimeout(recognitionRef.current.restartTimeout);
          recognitionRef.current.restartTimeout = null;
        }
        
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        setIsRecording(false);
      }
    }
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      // Stop any ongoing speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cameraStream]);

  // Question narration functions
  const speakQuestion = (text) => {
    if (!speechSynthSupported || !text) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    setIsNarrating(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    utterance.onend = () => {
      setIsNarrating(false);
      console.log('Question narration completed');
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsNarrating(false);
    };
    
    utterance.onstart = () => {
      console.log('Question narration started');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const stopNarration = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsNarrating(false);
    }
  };

  // Auto-narrate new questions
  useEffect(() => {
    if (currentQuestion && speechSynthSupported && interviewStarted) {
      // Small delay to ensure the question is displayed first
      setTimeout(() => {
        speakQuestion(currentQuestion);
      }, 500);
    }
  }, [currentQuestion, speechSynthSupported, interviewStarted]);

  const startInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://9c13f2bf3856.ngrok-free.app/api/start-interview', {
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
      const response = await fetch('https://9c13f2bf3856.ngrok-free.app/api/submit-answer', {
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
      const response = await fetch('https://9c13f2bf3856.ngrok-free.app/api/end-interview', {
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
              {/* Browser Compatibility Info */}
              <div className={styles.compatibilityInfo}>
                <h4>Browser Compatibility Status</h4>
                <div className={styles.compatibilityGrid}>
                  <div className={styles.compatibilityItem}>
                    <span>Browser: {browserInfo.browser}</span>
                  </div>
                  <div className={styles.compatibilityItem}>
                    <span className={browserInfo.speech ? styles.supported : styles.notSupported}>
                      🎤 Speech Input: {browserInfo.speech ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>
                  <div className={styles.compatibilityItem}>
                    <span className={speechSynthSupported ? styles.supported : styles.notSupported}>
                      🔊 Question Narration: {speechSynthSupported ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>
                  <div className={styles.compatibilityItem}>
                    <span className={browserInfo.camera ? styles.supported : styles.notSupported}>
                      📷 Camera: {browserInfo.camera ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={styles.setupOption}>
                <label className={styles.setupLabel}>
                  <input
                    type="checkbox"
                    checked={cameraEnabled}
                    onChange={(e) => e.target.checked ? enableCamera() : disableCamera()}
                    className={styles.setupCheckbox}
                    disabled={!browserInfo.camera}
                  />
                  Enable Camera (Optional) {!browserInfo.camera && '- Not Available'}
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
              
              {speechSynthSupported && (
                <div className={styles.setupOption}>
                  <p className={styles.setupInfo}>
                    🔊 Question narration is available! Questions will be read aloud automatically.
                  </p>
                </div>
              )}
              
              {!speechSupported && (
                <div className={styles.setupOption}>
                  <p className={styles.setupWarning}>
                    ⚠️ Speech input is not available in your browser. Please use Chrome, Edge, or Safari for speech features.
                  </p>
                </div>
              )}
              
              {!speechSynthSupported && (
                <div className={styles.setupOption}>
                  <p className={styles.setupWarning}>
                    ⚠️ Question narration is not available in your browser.
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
                  playsInline
                  className={styles.cameraFeed}
                  onLoadedMetadata={() => console.log('Video metadata loaded')}
                  onCanPlay={() => console.log('Video can play')}
                  onError={(e) => console.error('Video error:', e)}
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
                <div className={styles.cameraStatus}>
                  Camera Active
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
                <div className={styles.questionHeader}>
                  <h3>❓ Question {roundNumber}</h3>
                  {speechSynthSupported && (
                    <button
                      className={`${styles.speakerButton} ${isNarrating ? styles.speaking : ''}`}
                      onClick={isNarrating ? stopNarration : () => speakQuestion(currentQuestion)}
                      title={isNarrating ? "Stop narration" : "Read question aloud"}
                    >
                      {isNarrating ? '🔊 Stop' : '🔊 Speak'}
                    </button>
                  )}
                </div>
                <p className={styles.question}>{currentQuestion}</p>
                
                <div className={styles.answerSection}>
                  <div className={styles.inputControls}>
                    <div className={styles.textareaContainer}>
                      <textarea
                        className={styles.answerInput}
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="Type your answer here or use speech input..."
                        rows={6}
                        disabled={isLoading}
                      />
                      {userAnswer && (
                        <button
                          className={styles.clearButton}
                          onClick={() => setUserAnswer('')}
                          title="Clear answer"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                    
                    {/* Speech Controls */}
                    <div className={styles.speechControls}>
                      {speechSupported ? (
                        <>
                          <button
                            className={`${styles.speechButton} ${isRecording ? styles.recording : ''}`}
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isLoading}
                            title={isRecording ? "Stop recording" : "Start speech input"}
                          >
                            {isRecording ? '🎤 Stop' : '🎤 Speak'}
                          </button>
                          {isRecording && (
                            <div className={styles.recordingStatus}>
                              <span className={styles.recordingIndicator}>
                                {isListening ? '🔴 Listening...' : '⏸️ Ready to listen'}
                              </span>
                              {interimTranscript && (
                                <div className={styles.interimTranscript}>
                                  <span>Preview: "{interimTranscript}"</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={styles.speechTips}>
                            <small>💡 Speak clearly and pause between sentences for better accuracy</small>
                          </div>
                        </>
                      ) : (
                        <div className={styles.speechNotAvailable}>
                          <span>🎤 Speech recognition not available in this browser</span>
                          <small>Try Chrome, Firefox, or Safari for speech input</small>
                        </div>
                      )}
                    </div>
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
