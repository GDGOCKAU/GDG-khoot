
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Devu from "../../components/common/Devu";
import "./PlayerGame.css";

const question = {
  text: "Which company created the Flutter framework?",
  answers: ["Google", "Meta", "Microsoft", "Apple"],
  correctAnswer: 0,
  timeLimit: 20,
};

function PlayerGame() {
  const { gameId } = useParams();

  const [timeLeft, setTimeLeft] = useState(question.timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [phase, setPhase] = useState("question");

  const nickname = localStorage.getItem("gdgNickname") || "Guest Player";
  const avatar = JSON.parse(
    localStorage.getItem("gdgAvatar") ||
    '{"color":"blue","number":1}'
  );

  useEffect(() => {
    if (phase !== "question" || selectedAnswer !== null) return;

    if (timeLeft <= 0) {
      setPhase("timeout");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, phase, selectedAnswer]);

  function handleAnswer(index) {
    if (selectedAnswer !== null || phase !== "question") return;

    setSelectedAnswer(index);
    setPhase(index === question.correctAnswer ? "correct" : "incorrect");
  }

  return (
    <main className={`player-game-page ${phase}`}>
      <header className="player-game-header">
        <div className="player-game-brand">
          GDG KAU <strong>Quiz</strong>
        </div>

        <div className="player-profile">
          <Devu color={avatar.color} number={avatar.number} />
          <span>{nickname}</span>
        </div>
      </header>

      {phase === "question" && (
        <section className="player-question-content">
          <span className="player-question-number">
            QUESTION 1
          </span>

          <div className="player-timer">
            {timeLeft}
          </div>

          <h1>{question.text}</h1>

          <p className="player-answer-instruction">
            Choose your answer
          </p>

          <div className="player-answer-grid">
            {question.answers.map((answer, index) => (
              <button
                key={answer}
                className={`player-answer answer-${index + 1}`}
                onClick={() => handleAnswer(index)}
                type="button"
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {answer}
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === "correct" && (
        <section className="player-feedback">
          <div className="feedback-icon">✓</div>
          <h1>Correct!</h1>
          <p>Great job! You got the right answer.</p>
          <div className="feedback-points">+1000 points</div>
          <p className="feedback-waiting">
            Waiting for the next question...
          </p>
        </section>
      )}

      {phase === "incorrect" && (
        <section className="player-feedback">
          <div className="feedback-icon">×</div>
          <h1>Not quite!</h1>
          <p>The correct answer was:</p>
          <div className="correct-answer-display">
            {question.answers[question.correctAnswer]}
          </div>
          <p className="feedback-waiting">
            Don't worry. There's another question coming!
          </p>
        </section>
      )}

      {phase === "timeout" && (
        <section className="player-feedback">
          <div className="feedback-icon">!</div>
          <h1>Time's up!</h1>
          <p>You didn't submit an answer in time.</p>
          <div className="correct-answer-display">
            {question.answers[question.correctAnswer]}
          </div>
          <p className="feedback-waiting">
            Waiting for the next question...
          </p>
        </section>
      )}

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
