
import { useState } from "react";
import HangingDevu from "../../components/common/HangingDevu";
import Navbar from "../../components/common/Navbar.jsx";
import "./Home.css";
import { Link, useNavigate } from "react-router-dom";// Temporary until the backend provides the quiz list.
// Expected quiz fields: id, status, topic, title, desc, questions, pin.
const quizzes = [];

const TOPICS = {
  Mobile: { color: "blue", icon: "📱" },
  Cloud: { color: "red", icon: "☁️" },
  AI: { color: "yellow", icon: "✨" },
  Web: { color: "green", icon: "💻" },
  Other: { color: "blue", icon: "⭐" },
};

function formatPin(pin) {
  const digits = String(pin ?? "").replace(/\D/g, "");
  return digits.length === 6
    ? `${digits.slice(0, 3)} ${digits.slice(3)}`
    : digits;
}

function Home() {
  const navigate = useNavigate();

  const [gamePin, setGamePin] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  function handleJoinGame(event) {
    event.preventDefault();

    const pin = gamePin.replace(/\D/g, "");

    if (pin.length !== 6) {
      setPinError("Please enter a valid 6-digit game PIN.");
      return;
    }

    setPinError("");
    navigate(`/join/${pin}`);
  }

  const readyQuizzes = quizzes.filter(
    (quiz) => quiz.status === "ready"
  );

  const topics = [
    "All",
    ...Object.keys(TOPICS),
  ];

  const filteredQuizzes =
    activeFilter === "All"
      ? readyQuizzes
      : readyQuizzes.filter(
          (quiz) => quiz.topic === activeFilter
        );

  return (
    <>
      <Navbar />

      <main>
        <section className="home-hero hero" id="join">
          <HangingDevu />

          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-orb hero-orb-blue" aria-hidden="true" />
          <div className="hero-orb hero-orb-green" aria-hidden="true" />

          <div className="hero-content">
            <div className="hero-copy">
              <span className="hero-label">
                <span className="hero-label-dot" />
                GOOGLE DEVELOPER GROUPS · KAU
              </span>

              <h1>
                Play<span className="blue-period">.</span>{" "}
                Think<span className="red-period">.</span>
                <br />
                Learn<span className="yellow-period">.</span>
              </h1>

              <p className="hero-description">
                Got what it takes? Jump into a live GDG KAU quiz,
                race your friends, and learn something new.
              </p>

              <div className="hero-benefits">
                <span className="benefit blue-benefit">
                  No account needed
                </span>
                <span className="benefit red-benefit">
                  Works on any phone
                </span>
                <span className="benefit green-benefit">
                  Free for everyone
                </span>
              </div>
            </div>

            <form
              className="join-game-card"
              onSubmit={handleJoinGame}
              noValidate
            >
              <div>
                <h2>Join a game</h2>
                <p className="join-card-description">
                  Enter the PIN shown on the big screen.
                </p>
              </div>

              <label className="pin-field">
                <span>Game PIN</span>
                
<input
  type="text"
  inputMode="numeric"
  autoComplete="off"
  maxLength={7}
  placeholder="000 000"
  value={
    gamePin.length > 3
      ? `${gamePin.slice(0, 3)} ${gamePin.slice(3)}`
      : gamePin
  }
  aria-describedby="pin-error"
  onChange={(event) => {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setGamePin(value);
    setPinError("");
  }}
/>

              </label>

              {pinError && (
                <p
                  className="pin-error"
                  id="pin-error"
                  role="alert"
                >
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                className="join-submit-button"
              >
                Enter game <span aria-hidden="true">→</span>
              </button>

              <div className="home-color-bar" />

              <p className="join-card-hint">
                Each quiz below shows its PIN, or just press Play on one.
              </p>
            </form>
          </div>
        </section>

        {/* Explore quizzes */}
        <section
          className="home-section quizzes-section"
          id="quizzes"
        >
          <div className="section-inner">
            <div className="section-heading quizzes-heading">
              <div>
                <span className="section-label quizzes-label">
                  LEARN SOMETHING NEW
                </span>
                <h2>Explore quizzes</h2>
              </div>

              <div
                className="quiz-filters"
                role="tablist"
                aria-label="Filter quizzes by topic"
              >
                {topics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === topic}
                    className={
                      activeFilter === topic
                        ? "quiz-filter active"
                        : "quiz-filter"
                    }
                    onClick={() => setActiveFilter(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {filteredQuizzes.length > 0 ? (
              <div className="quiz-grid">
                {filteredQuizzes.map((quiz) => {
                  const topicInfo =
                    TOPICS[quiz.topic] || TOPICS.Other;

                  return (
                    <article
                      className={`quiz-card quiz-card-${topicInfo.color}`}
                      key={quiz.id}
                    >
                      <div
                        className="quiz-card-glow"
                        aria-hidden="true"
                      />

                      <span className="quiz-card-icon">
                        {topicInfo.icon}
                      </span>

                      <h3>{quiz.title}</h3>

                      <p className="quiz-card-description">
                        {quiz.desc || ""}
                      </p>

                      <div className="quiz-card-meta">
                        <span className="quiz-chip">
                          {quiz.questions?.length ?? 0} questions
                        </span>

                        <span
                          className={`quiz-chip quiz-topic-${topicInfo.color}`}
                        >
                          {quiz.topic || "Other"}
                        </span>

                        <span
                          className="quiz-chip"
                          title="Game PIN"
                        >
                          PIN {formatPin(quiz.pin)}
                        </span>
                      </div>

                      <Link
                        to={`/join/${quiz.id}`}
                        className="quiz-play-button"
                      >
                        Play <span aria-hidden="true">→</span>
                      </Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="quiz-empty">
                No quizzes in this topic yet.
              </div>
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="home-section how-section" id="how">
          <div className="section-inner">
            <div className="section-heading">
              <div>
                <span className="section-label how-label">
                  HOW IT WORKS
                </span>
                <h2>Three steps to play</h2>
              </div>
            </div>

            <div className="steps-grid">
              <article className="step-card step-blue">
                <span className="step-number">1</span>
                <h3>Get the PIN</h3>
                <p>
                  The host shows it on the big screen at the event.
                </p>
              </article>

              <article className="step-card step-red">
                <span className="step-number">2</span>
                <h3>Pick a nickname</h3>
                <p>
                  Keep it fun, it shows on the leaderboard.
                </p>
              </article>

              <article className="step-card step-yellow">
                <span className="step-number">3</span>
                <h3>Answer fast</h3>
                <p>
                  Right and quick answers earn the most points.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-inner">
          <span>
            GDG on Campus · King Abdulaziz University
          </span>
          <Link to="/admin/login">Admin sign in</Link>
        </div>

        <div className="home-color-bar footer-color-bar" />
      </footer>
    </>
  );
}

export default Home;
