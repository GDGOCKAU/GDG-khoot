
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Devu from "../../components/common/Devu";
import "./PlayerGame.css";

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

const answerColors = ["blue", "red", "yellow", "green"];

function PlayerGame() {
  const { gameId } = useParams();

  const nickname = localStorage.getItem("gdgNickname") || "Guest Player";

  let savedAvatar = { color: "blue", number: 1 };

  try {
    savedAvatar = JSON.parse(
      localStorage.getItem("gdgAvatar") ||
        '{"color":"blue","number":1}'
    );
  } catch {
    savedAvatar = { color: "blue", number: 1 };
  }

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(questions[0].timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentQuestion = questions[questionIndex];

  const isCorrect =
    selectedAnswer === currentQuestion.correctAnswer;

  // Countdown before the question
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

  // Question timer
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

  // Calculate points when the answer is revealed
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

  const progress =
    (timeLeft / currentQuestion.timeLimit) * 100;

  return (
    <main className={`player-game-page phase-${phase}`}>
      <header className="player-game-header">
        <div className="player-game-brand">
          GDG KAU <strong>Quiz</strong>
        </div>

        <div className="player-profile">
          <Devu
            color={savedAvatar.color}
            number={savedAvatar.number}
            size={42}
          />
          <span>{nickname}</span>
        </div>
      </header>

      <section className="player-game-content">

        {/* Countdown */}
        {phase === "countdown" && (
          <div className="player-countdown-screen">
            <span className="player-question-label">
              Question {questionIndex + 1} of {questions.length}
            </span>

            <Devu
              color={savedAvatar.color}
              number={savedAvatar.number}
              size={150}
            />

            <h1>Get ready!</h1>

            <div className="countdown-circle">
              {countdown > 0 ? countdown : "GO!"}
            </div>

            <p>Your answer buttons will appear in a moment.</p>
          </div>
        )}

        {/* Question and waiting screen */}
        {(phase === "question" || phase === "waiting") && (
          <div className="player-question-screen">

            <div className="player-question-top">
              <span className="player-question-label">
                Question {questionIndex + 1} of {questions.length}
              </span>

              <div className="player-timer">
                <span>{timeLeft}</span>
                <small>SEC</small>
              </div>
            </div>

            <div className="player-progress-track">
              <div
                className="player-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="player-question-card">
              <span className="player-question-type">
                MULTIPLE CHOICE
              </span>

              <h1>{currentQuestion.text}</h1>
            </div>

            {phase === "question" ? (
              <>
                <div className="player-answer-grid">
                  {currentQuestion.answers.map((answer, index) => (
                    <button
                      key={index}
                      className={`player-answer-button ${answerColors[index]}`}
                      onClick={() => handleAnswer(index)}
                    >
                      <span className="answer-letter">
                        {String.fromCharCode(65 + index)}
                      </span>

                      <span>{answer}</span>
                    </button>
                  ))}
                </div>

                <p className="player-game-tip">
                  Choose your answer before time runs out!
                </p>
              </>
            ) : (
              <div className="player-waiting-screen">
                <div className="waiting-spinner" />

                <h2>Answer submitted!</h2>

                <p>Waiting for the time to run out...</p>

                <div className="player-selected-answer">
                  Your answer:{" "}
                  <strong>
                    {currentQuestion.answers[selectedAnswer]}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Answer reveal */}
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
            <Devu
              color={savedAvatar.color}
              number={savedAvatar.number}
              size={130}
            />

            {selectedAnswer === null ? (
              <>
                <span className="feedback-icon">⏰</span>

                <h1>Time's up!</h1>

                <p>You didn't submit an answer.</p>
              </>
            ) : isCorrect ? (
              <>
                <span className="feedback-icon">✓</span>

                <h1>Correct!</h1>

                <p>Great job! You got the right answer.</p>

                <div className="points-earned">
                  +{pointsEarned} points
                </div>
              </>
            ) : (
              <>
                <span className="feedback-icon">✕</span>

                <h1>Not quite!</h1>

                <p>Better luck on the next question.</p>
              </>
            )}

            <div className="correct-answer-card">
              <span>THE CORRECT ANSWER</span>

              <strong>
                {currentQuestion.answers[currentQuestion.correctAnswer]}
              </strong>
            </div>

            <div className="player-score-card">
              <span>Your total score</span>

              <strong>{score.toLocaleString()} pts</strong>
            </div>

            <button
              className="player-next-button"
              onClick={handleNextQuestion}
            >
              {questionIndex === questions.length - 1
                ? "View my results"
                : "Next question"}
            </button>
          </div>
        )}

        {/* Final results */}
        {phase === "final" && (
          <div className="player-final-screen">
            <Devu
              color={savedAvatar.color}
              number={savedAvatar.number}
              size={160}
            />

            <span className="player-question-label">
              QUIZ COMPLETED
            </span>

            <h1>Well played!</h1>

            <p>You have completed all the questions.</p>

            <div className="player-final-score">
              <span>Your final score</span>

              <strong>{score.toLocaleString()}</strong>

              <small>POINTS</small>
            </div>

            <p className="player-final-message">
              Thanks for playing!
            </p>
          </div>
        )}
      </section>

      <footer className="player-game-footer">
        <span />
        <span />
        <span />
        <span />
      </footer>
    </main>
  );
}

export default PlayerGame;
