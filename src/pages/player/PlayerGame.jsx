
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./PlayerGame.css";
import ThemeToggle from "../../components/common/ThemeToggle";

const questions = [
  {
    text: "Which company created the Flutter framework?",
    answers: ["Google", "Meta", "Microsoft", "Apple"],
    correctAnswer: 0,
    timeLimit: 20,
  },
  {
    text: "Which language is primarily used with React?",
    answers: ["Python", "JavaScript", "Java", "C++"],
    correctAnswer: 1,
    timeLimit: 20,
  },
  {
    text: "What does HTML stand for?",
    answers: [
      "Hyper Trainer Marking Language",
      "Hyper Text Markup Language",
      "High Text Machine Language",
      "Hyperlink Text Management Language",
    ],
    correctAnswer: 1,
    timeLimit: 20,
  },
];

const answerColors = ["red", "blue", "green", "yellow"];
const answerShapes = ["triangle", "diamond", "circle", "square"];

function PlayerGame() {
  const { gameId } = useParams();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(questions[0].timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentQuestion = questions[questionIndex];
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  // Countdown before each question
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown <= 0) {
      setPhase("question");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Question timer continues while the player waits
  useEffect(() => {
    if (phase !== "question" && phase !== "waiting") return;

    if (timeLeft <= 0) {
      setPhase("reveal");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  // Calculate the player's points when the answer is revealed
  useEffect(() => {
    if (phase !== "reveal") return;

    if (selectedAnswer === currentQuestion.correctAnswer) {
      const earned = Math.max(100, timeLeft * 50);
      setPointsEarned(earned);
      setScore((previous) => previous + earned);
    } else {
      setPointsEarned(0);
    }
  }, [phase]);

  function handleAnswer(index) {
    if (phase !== "question" || selectedAnswer !== null) return;

    setSelectedAnswer(index);
    setPhase("waiting");
  }

  function handleNextQuestion() {
    if (questionIndex === questions.length - 1) {
      setPhase("final");
      return;
    }

    const nextIndex = questionIndex + 1;

    setQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    setPointsEarned(0);
    setTimeLeft(questions[nextIndex].timeLimit);
    setCountdown(3);
    setPhase("countdown");
  }

  const progress = (timeLeft / currentQuestion.timeLimit) * 100;
  const gamePin = gameId || "------";

  return (
    <main className={`player-game-page phase-${phase}`}>
      <header className="player-game-header">
  <div className="player-game-brand">
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
    <span>
      GDG KAU<span className="brand-blue">HOOT</span>
    </span>
  </div>

  <div className="player-game-header-actions">
    <div className="player-game-meta">
      {/* Keep your existing PIN, question count, and timer JSX here */}
    </div>

    <ThemeToggle />
  </div>
</header>

      <section className="player-game-content">
        {phase === "countdown" && (
          <div className="player-countdown-screen">
            <span className="player-eyebrow">
              QUESTION {questionIndex + 1} OF {questions.length}
            </span>

            <h1>Get ready!</h1>
            <p>Look at the screen and get ready to answer.</p>

            <div className="countdown-circle">
              {countdown > 0 ? countdown : "GO!"}
            </div>

            <div className="countdown-dots" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        )}

        {(phase === "question" || phase === "waiting") && (
          <div className="player-question-screen">
            <div className="player-progress-track">
              <div
                className="player-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="player-question-heading">
              <span className="player-eyebrow">YOUR QUESTION</span>
              <span className="player-question-number">
                QUESTION {questionIndex + 1}
              </span>
            </div>

            <div className="player-question-card">
              <h1>{currentQuestion.text}</h1>
            </div>

            {phase === "question" ? (
              <>
                <div className="player-answer-grid">
                  {currentQuestion.answers.map((answer, index) => (
                    <button
                      key={`${questionIndex}-${index}`}
                      type="button"
                      className={`player-answer-button ${answerColors[index]}`}
                      onClick={() => handleAnswer(index)}
                    >
                      <span
                        className={`answer-shape ${answerShapes[index]}`}
                        aria-hidden="true"
                      />
                      <span className="answer-text">{answer}</span>
                    </button>
                  ))}
                </div>

                <p className="player-game-tip">
                  Choose your answer before the timer runs out.
                </p>
              </>
            ) : (
              <div className="player-waiting-screen">
                <div className="waiting-animation" aria-hidden="true">
  <div className="orbit-ring">
    <span className="orbit-shape triangle" />
    <span className="orbit-shape diamond" />
    <span className="orbit-shape circle" />
    <span className="orbit-shape square" />
  </div>

  <div className="orbit-center">?</div>
</div>

                <h2>Answer submitted!</h2>
                <p>Your answer has been locked in.</p>

                <div className="player-selected-answer">
                  <span>YOUR ANSWER</span>
                  <strong>
                    {currentQuestion.answers[selectedAnswer]}
                  </strong>
                </div>

                <p className="waiting-note">
                  Waiting for the question to finish...
                </p>
              </div>
            )}
          </div>
        )}

        {phase === "reveal" && (
          <div
            className={`player-feedback-screen ${
              selectedAnswer === null
                ? "timeout"
                : isCorrect
                  ? "correct"
                  : "incorrect"
            }`}
          >
            <span className="player-eyebrow">QUESTION {questionIndex + 1}</span>

            <div className="feedback-icon">
              {selectedAnswer === null ? "⌛" : isCorrect ? "✓" : "✕"}
            </div>

            <h1>
              {selectedAnswer === null
                ? "Time's up!"
                : isCorrect
                  ? "Correct!"
                  : "Not quite!"}
            </h1>

            <p>
              {selectedAnswer === null
                ? "You didn't submit an answer."
                : isCorrect
                  ? "Great job! You got the right answer."
                  : "Keep going. There's another question ahead!"}
            </p>

            <div className="correct-answer-card">
              <span>CORRECT ANSWER</span>
              <strong>
                {currentQuestion.answers[currentQuestion.correctAnswer]}
              </strong>
            </div>

            {selectedAnswer !== null && isCorrect && (
              <div className="points-earned">+{pointsEarned} points</div>
            )}

            <div className="player-score-card">
              <span>YOUR TOTAL SCORE</span>
              <strong>{score.toLocaleString()} pts</strong>
            </div>

            <button
              type="button"
              className="player-next-button"
              onClick={handleNextQuestion}
            >
              {questionIndex === questions.length - 1
                ? "View my results"
                : "Next question"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {phase === "final" && (
          <div className="player-final-screen">
            <div className="final-trophy" aria-hidden="true">★</div>

            <span className="player-eyebrow">QUIZ COMPLETED</span>
            <h1>Well played!</h1>
            <p>You've completed all the questions.</p>

            <div className="player-final-score">
              <span>YOUR FINAL SCORE</span>
              <strong>{score.toLocaleString()}</strong>
              <small>POINTS</small>
            </div>

            <p className="player-final-message">
              Thanks for playing GDG KAUHOOT!
            </p>
          </div>
        )}
      </section>

      <footer className="player-game-footer" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </footer>
    </main>
  );
}

export default PlayerGame;
