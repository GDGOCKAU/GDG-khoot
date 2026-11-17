
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./Game.css";

const demoQuestion = {
  text: "Which company created the Flutter framework?",
  answers: ["Google", "Meta", "Microsoft", "Apple"],
  timeLimit: 20,
  correctAnswer: 0,
};

function Game() {
  const { gameId } = useParams();

  const [phase, setPhase] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(demoQuestion.timeLimit);

  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown === 0) {
      setPhase("question");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "question") return;

    if (timeLeft === 0) {
      setPhase("ended");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  return (
    <main className="game-host-page">
      <header className="game-header">
        <Link to={`/admin/host/${gameId}`} className="game-brand">
          <span className="game-brand-dots">
            <i />
            <i />
            <i />
            <i />
          </span>
          GDG KAU <strong>Quiz</strong>
        </Link>

        <span className="game-question-counter">
          QUESTION 1 OF 10
        </span>
      </header>

      {phase === "countdown" && (
        <section className="game-countdown">
          <span className="game-eyebrow">GET READY</span>

          <h1>
            Are you ready<span>?</span>
          </h1>

          <div className="countdown-circle">
            <span>{countdown || "GO!"}</span>
          </div>

          <p>
            Phones out, fingers ready. The first question starts in a moment.
          </p>

          <div className="answer-color-preview">
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span>D</span>
          </div>
        </section>
      )}

      {phase === "question" && (
        <section className="game-question-screen">
          <div className="game-timer">
            <span>{timeLeft}</span>
            <small>SECONDS</small>
          </div>

          <span className="game-eyebrow">QUESTION 1</span>

          <h1>{demoQuestion.text}</h1>

          <div className="host-answer-grid">
            {demoQuestion.answers.map((answer, index) => (
              <div
                className={`host-answer answer-color-${index + 1}`}
                key={answer}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <strong>{answer}</strong>
              </div>
            ))}
          </div>

          <p className="game-instruction">
            Choose your answer on your phone!
          </p>
        </section>
      )}

      {phase === "ended" && (
        <section className="game-ended-screen">
          <span className="game-eyebrow">TIME'S UP</span>
          <h1>Time is up!</h1>
          <p>The answer reveal and leaderboard will come next.</p>
          <Link
            to={`/admin/host/${gameId}`}
            className="game-return-button"
          >
            Return to lobby
          </Link>
        </section>
      )}

      <footer className="game-footer">
        <span className="footer-blue" />
        <span className="footer-red" />
        <span className="footer-yellow" />
        <span className="footer-green" />
      </footer>
    </main>
  );
}

export default Game;
