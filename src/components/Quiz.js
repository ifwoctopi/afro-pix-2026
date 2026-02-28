import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllDictionaryTerms } from '../services/dictionaryService';
import { Book, CheckCircle, XCircle, RotateCcw, ArrowLeft, MapPin } from 'lucide-react';
import './Quiz.css';

const Quiz = () => {
  const [allTerms, setAllTerms] = useState([]);
  const [quizTerms, setQuizTerms] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [questionType, setQuestionType] = useState('term'); // 'term' (show term, ask definition) or 'definition' (show definition, ask term)
  const [questionDataList, setQuestionDataList] = useState([]); // Store all question data
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set()); // Track which questions have been answered
  const [userAnswers, setUserAnswers] = useState({}); // Store user's answers: { questionIndex: answerId }
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-submission
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  const QUESTION_COUNT = 10;

  const loadAllTerms = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await getAllDictionaryTerms();
      if (error) {
        throw new Error(error.message || 'Failed to load dictionary terms');
      }
      setAllTerms(data || []);
    } catch (error) {
      console.error('Error loading dictionary terms:', error);
      alert(`Failed to load legal glossary: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllTerms();
  }, [loadAllTerms]);

  const startQuiz = () => {
    if (allTerms.length < QUESTION_COUNT) {
      alert(`Not enough terms in the legal glossary. Need at least ${QUESTION_COUNT} terms.`);
      return;
    }

    // Randomly select terms for the quiz
    const shuffled = [...allTerms].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, QUESTION_COUNT);
    setQuizTerms(selected);
    
    // Generate question data for all questions
    const questions = selected.map((term) => {
      const options = generateOptions(term);
      if (questionType === 'term') {
        return {
          question: `What is the definition of "${term.medical_term}" in legal context?`,
          options: options.map(opt => ({
            id: opt.id,
            text: opt.definition,
            correct: opt.id === term.id
          })),
          correctAnswer: term.id
        };
      } else {
        return {
          question: `Which legal term matches this definition: "${term.definition.substring(0, 150)}${term.definition.length > 150 ? '...' : ''}"?`,
          options: options.map(opt => ({
            id: opt.id,
            text: opt.medical_term,
            correct: opt.id === term.id
          })),
          correctAnswer: term.id
        };
      }
    });
    
    setQuestionDataList(questions);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setQuizStarted(true);
  };

  const generateOptions = (correctTerm) => {
    // Get 3 random wrong answers
    const wrongTerms = allTerms
      .filter(term => term.id !== correctTerm.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Combine correct and wrong answers, then shuffle
    const options = [correctTerm, ...wrongTerms].sort(() => Math.random() - 0.5);
    return options;
  };

  const handleAnswerSelect = (answer) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || isSubmitting) return;
    
    // Prevent double-submission
    if (answeredQuestions.has(currentQuestion)) return;

    const questionData = questionDataList[currentQuestion];
    if (!questionData) return;

    const currentAnswerId = selectedAnswer.id;

    // Store the user's answer
    const updatedAnswers = {
      ...userAnswers,
      [currentQuestion]: currentAnswerId
    };
    setUserAnswers(updatedAnswers);

    // Mark this question as answered
    setAnsweredQuestions(prev => new Set([...prev, currentQuestion]));

    setIsSubmitting(true);

    // Show result for a moment, then move to next question
    setTimeout(() => {
      setIsSubmitting(false);
      if (currentQuestion < quizTerms.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
      } else {
        // Calculate final score when quiz is complete (include current answer)
        calculateFinalScore(updatedAnswers);
        setShowResult(true);
      }
    }, 1500);
  };

  const calculateFinalScore = (answers = userAnswers) => {
    let correctCount = 0;
    questionDataList.forEach((questionData, index) => {
      const userAnswerId = answers[index];
      if (userAnswerId && userAnswerId === questionData.correctAnswer) {
        correctCount++;
      }
    });
    setScore(correctCount);
  };

  const restartQuiz = () => {
    setQuizStarted(false);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setQuizTerms([]);
    setQuestionDataList([]);
    setAnsweredQuestions(new Set());
    setUserAnswers({});
    setIsSubmitting(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const questionData = questionDataList[currentQuestion] || null;
  const percentage = quizTerms.length > 0 ? Math.round((score / quizTerms.length) * 100) : 0;

  return (
    <div className="quiz-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo">
            <button
              type="button"
              className="nav-logo-link"
              onClick={() => navigate('/home')}
              aria-label="Go to home page"
            >
              <img src="/images/afro-pix-logo.png" alt="Compass logo" className="nav-logo-image" />
              <h2>Compass</h2>
            </button>
          </div>
          <div className="nav-actions">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/home')}
            >
              Home
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/dictionary')}
            >
              <ArrowLeft size={16} style={{ marginRight: '6px' }} />
              Back to Glossary
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/advisors')}
            >
              <MapPin size={16} style={{ marginRight: '6px' }} />
              Legal Advisors
            </button>
            <span className="nav-user-email">{userEmail}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="quiz-section">
          {!quizStarted ? (
            <div className="quiz-start">
              <div className="quiz-start-header">
                <h1>
                  <Book size={32} className="header-icon" />
                  Legal Glossary Quiz
                </h1>
                <p className="subtitle">
                  Test your knowledge of legal terms. Answer {QUESTION_COUNT} questions to check your legal vocabulary.
                </p>
              </div>

              {isLoading ? (
                <div className="loading-container">
                  <div className="spinner">⏳ Loading terms...</div>
                </div>
              ) : (
                <div className="quiz-start-content">
                  <div className="quiz-info">
                    <div className="info-card">
                      <h3>Quiz Details</h3>
                      <ul>
                        <li>📚 {allTerms.length} terms available</li>
                        <li>❓ {QUESTION_COUNT} questions per quiz</li>
                        <li>🔄 Randomized questions</li>
                        <li>⭐ Test your knowledge</li>
                      </ul>
                    </div>

                    <div className="question-type-selector">
                      <h3>Question Type</h3>
                      <div className="type-options">
                        <label className={`type-option ${questionType === 'term' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="questionType"
                            value="term"
                            checked={questionType === 'term'}
                            onChange={(e) => setQuestionType(e.target.value)}
                          />
                          <span>Show Term → Find Definition</span>
                        </label>
                        <label className={`type-option ${questionType === 'definition' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="questionType"
                            value="definition"
                            checked={questionType === 'definition'}
                            onChange={(e) => setQuestionType(e.target.value)}
                          />
                          <span>Show Definition → Find Term</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-large start-quiz-btn" onClick={startQuiz}>
                    Start Quiz
                  </button>
                </div>
              )}
            </div>
          ) : showResult ? (
            <div className="quiz-result">
              <div className="result-header">
                <h1>Quiz Complete! 🎉</h1>
                <div className="score-display">
                  <div className="score-circle">
                    <span className="score-number">{score}</span>
                    <span className="score-total">/ {quizTerms.length}</span>
                  </div>
                  <div className="score-percentage">
                    {quizTerms.length > 0 ? Math.round((score / quizTerms.length) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="result-message">
                {percentage >= 90 && <p className="excellent">Excellent work! You're a legal terminology expert! 🌟</p>}
                {percentage >= 70 && percentage < 90 && <p className="good">Great job! You have a strong grasp of legal terms! 👍</p>}
                {percentage >= 50 && percentage < 70 && <p className="fair">Good effort! Keep studying to improve your legal vocabulary. 📚</p>}
                {percentage < 50 && <p className="needs-improvement">Keep practicing! Review the legal glossary to improve. 💪</p>}
              </div>

              <div className="result-actions">
                <button className="btn btn-primary" onClick={restartQuiz}>
                  <RotateCcw size={18} style={{ marginRight: '8px' }} />
                  Try Again
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/dictionary')}>
                  Back to Glossary
                </button>
              </div>
            </div>
          ) : questionData ? (
            <div className="quiz-content">
              <div className="quiz-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${((currentQuestion + 1) / quizTerms.length) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  Question {currentQuestion + 1} of {quizTerms.length}
                </div>
              </div>

              <div className="question-card">
                <h2 className="question-text">{questionData.question}</h2>
                
                <div className="options-list">
                  {questionData.options.map((option, index) => {
                    const isSelected = selectedAnswer?.id === option.id;
                    const isCorrect = option.correct;
                    const showAnswer = selectedAnswer && (isSelected || isCorrect);

                    return (
                      <button
                        key={option.id}
                        className={`option-btn ${isSelected ? 'selected' : ''} ${showAnswer ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={!!selectedAnswer}
                      >
                        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                        <span className="option-text">{option.text}</span>
                        {showAnswer && (
                          <span className="option-icon">
                            {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedAnswer && (
                  <div className="answer-feedback">
                    {selectedAnswer.id === questionData.correctAnswer ? (
                      <div className="feedback correct-feedback">
                        <CheckCircle size={24} />
                        <span>Correct! Well done!</span>
                      </div>
                    ) : (
                      <div className="feedback incorrect-feedback">
                        <XCircle size={24} />
                        <span>Incorrect. The correct answer is highlighted.</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary submit-btn"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer || isSubmitting || answeredQuestions.has(currentQuestion)}
                >
                  {isSubmitting 
                    ? 'Processing...' 
                    : currentQuestion < quizTerms.length - 1 
                    ? 'Next Question' 
                    : 'Finish Quiz'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Quiz;

