
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Devu from "../../components/common/Devu";
import "./Game.css";

const questions = [
  {
    text: "Which company created the Flutter framework?",
    topic: "Technology",
    answers: ["Google", "Meta", "Microsoft", "Apple"],
    correctAnswer: 0,
    timeLimit: 20,
    answerStats: [3, 1, 1, 0],
  },
  {
    text: "Which language is primarily used with React?",
    topic: "Technology",
    answers: ["Python", "JavaScript", "Java", "C++"],
    correctAnswer: 1,
    timeLimit: 20,
    answerStats: [1, 3, 1, 0],
  },
  {
    text: "What does HTML stand for?",
    topic: "Technology",
    answers: [
      "Hyper Trainer Marking Language",
      "Hyper Text Markup Language",
      "High Text Machine Language",
      "Hyperlink Text Management Language",
    ],
    correctAnswer: 1,
    timeLimit: 20,
    answerStats: [0, 4, 1, 0],
  },
];

const initialPlayers = [
  {
    id: 1,
    name: "PixelWizard",
    color: "blue",
    number: 1,
    score: 2800,
    correct: 3,
    lastPoints: 1000,
  },
  {
    id: 2,
    name: "CodeNinja",
    color: "red",
    number: 3,
    score: 2400,
    correct: 3,
    lastPoints: 900,
  },
  {
    id: 3,
    name: "TechSpark",
    color: "green",
    number: 2,
    score: 1900,
    correct: 2,
    lastPoints: 800,
  },
  {
    id: 4,
    name: "QuantumCat",
    color: "yellow",
    number: 4,
    score: 1500,
    correct: 2,
    lastPoints: 700,
  },
  {
    id: 5,
    name: "CloudChaser",
    color: "blue",
    number: 5,
    score: 1100,
    correct: 1,
    lastPoints: 500,
  },
];

const answerColors = ["blue", "red", "yellow", "green"];

const teamNames = {
  blue: "Blue",
  red: "Red",
  yellow: "Yellow",
  green: "Green",
};

const phaseDurations = {
  ready: 3000,
  reveal: 7000,
  leaderboard: 7000,
  next: 3000,
  teams: 8000,
  podium: 9000,
};

function Game() {
  const { gameId } = useParams();

  const [phase, setPhase] = useState("ready");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(questions[0].timeLimit);
  const [phaseTime, setPhaseTime] = useState(3);

  const currentQuestion = questions[questionIndex];
  const totalQuestions = questions.length;
  const [players] = useState(initialPlayers);

  const rankedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players]
  );

  const teamStats = useMemo(() => {
    return Object.keys(teamNames)
      .map((color) => {
        const members = players.filter(
          (player) => player.color === color
        );

        const totalScore = members.reduce(
          (sum, player) => sum + player.score,
          0
        );

        return {
          color,
          name: teamNames[color],
          count: members.length,
          totalScore,
          average: members.length
            ? Math.round(totalScore / members.length)
            : 0,
        };
      })
      .filter((team) => team.count > 0)
      .sort((a, b) => b.average - a.average);
  }, [players]);

  const correctCount =
    currentQuestion.answerStats[currentQuestion.correctAnswer];

  // Automatically progress through timed phases.
  useEffect(() => {
    const duration = phaseDurations[phase];

    if (!duration) return;

    setPhaseTime(duration / 1000);

    const interval = setInterval(() => {
      setPhaseTime((previous) => Math.max(0, previous - 1));
    }, 1000);

    const timeout = setTimeout(() => {
      if (phase === "ready") {
        setPhase("question");
      } else if (phase === "reveal") {
        setPhase("leaderboard");
      } else if (phase === "leaderboard") {
        if (questionIndex === totalQuestions - 1) {
          setPhase("teams");
        } else {
          setPhase("next");
        }
      } else if (phase === "next") {
        const nextIndex = questionIndex + 1;
        setQuestionIndex(nextIndex);
        setTimeLeft(questions[nextIndex].timeLimit);
        setPhase("question");
      } else if (phase === "teams") {
        setPhase("podium");
      } else if (phase === "podium") {
        setPhase("final");
      }
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase, questionIndex, totalQuestions]);

  // Question timer.
  useEffect(() => {
    if (phase !== "question") return;

    if (timeLeft <= 0) {
      setPhase("reveal");
      return;
    }

    const timeout = setTimeout(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [phase, timeLeft]);

  function skipCountdown() {
    setPhase("question");
  }

  function skipQuestion() {
    setPhase("reveal");
  }

  function getPhaseLabel() {
    if (phase === "ready" || phase === "question" || phase === "reveal") {
      return `QUESTION ${questionIndex + 1} OF ${totalQuestions}`;
    }

    if (phase === "leaderboard") {
      return `AFTER QUESTION ${questionIndex + 1}`;
    }

    if (phase === "next") {
      return `QUESTION ${questionIndex + 2} OF ${totalQuestions}`;
    }

    return "GAME RESULTS";
  }

  const progress = (timeLeft / currentQuestion.timeLimit) * 100;

  return (
    <main className="game-host-page">
      <header className="host-header">
        <Link to={`/admin/host/${gameId}`} className="host-brand">
          <span className="host-brand-dots" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>

          <span>
            GDG KAU <strong>Quiz</strong>
          </span>
        </Link>

        <span className="host-phase-label">{getPhaseLabel()}</span>
      </header>

      <main className="host-main">
        {/* READY */}
        {phase === "ready" && (
          <section className="host-ready-screen">
            <span className="host-eyebrow">
              {players.length} PLAYERS READY
            </span>

            <span className="host-small-chip">
              QUESTION {questionIndex + 1} OF {totalQuestions}
            </span>

            <h1>
              Are you ready<span>?</span>
            </h1>

            <div className="host-ring">
              <span>{phaseTime}</span>
            </div>

            <p>
              Phones out, fingers ready. The first question starts in a
              moment.
            </p>

            <div className="host-answer-legend">
              {["A", "B", "C", "D"].map((letter, index) => (
                <span
                  key={letter}
                  className={`host-legend-${answerColors[index]}`}
                >
                  {letter}
                </span>
              ))}
            </div>

            <button
              className="host-skip-button"
              onClick={skipCountdown}
            >
              Skip countdown
            </button>
          </section>
        )}

        {/* QUESTION */}
        {phase === "question" && (
          <section className="host-question-screen">
            <div className="host-question-card">
              <div className="host-question-card-top">
                <span className="host-topic-chip">
                  {currentQuestion.topic}
                </span>

                <span className="host-small-chip">
                  QUESTION {questionIndex + 1}
                </span>
              </div>

              <h1>{currentQuestion.text}</h1>
            </div>

            <div className="host-question-status">
              <div className="host-question-timer">
                <strong>{timeLeft}</strong>
                <span>SECONDS</span>
              </div>

              <div className="host-answer-count">
                <strong>
                  {currentQuestion.answerStats.reduce(
                    (sum, count) => sum + count,
                    0
                  )}
                </strong>
                <span>/ {players.length}</span>
                <small>answers in</small>
              </div>
            </div>

            <div className="host-progress-track">
              <div
                className="host-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="host-answers-grid">
              {currentQuestion.answers.map((answer, index) => (
                <div
                  key={answer}
                  className={`host-answer-card host-answer-${answerColors[index]}`}
                >
                  <span className="host-answer-letter">
                    {String.fromCharCode(65 + index)}
                  </span>

                  <strong>{answer}</strong>
                </div>
              ))}
            </div>

            <p className="host-instruction">
              Players, choose your answer on your phone!
            </p>

            <button
              className="host-skip-button"
              onClick={skipQuestion}
            >
              End question early
            </button>
          </section>
        )}

        {/* KAHOOT-STYLE ANSWER ANALYTICS */}
        {phase === "reveal" && (
          <section className="host-reveal-screen">
            <div className="host-reveal-question">
              <span className="host-eyebrow">
                {currentQuestion.topic}
              </span>

              <h1>{currentQuestion.text}</h1>
            </div>

            <div className="host-reveal-summary">
              <span className="host-correct-summary">
                <span className="host-correct-icon">✓</span>

                <strong>
                  {correctCount} of {players.length} got it right
                </strong>
              </span>

              <span className="host-leaderboard-countdown">
                Leaderboard in <strong>{phaseTime}</strong>s
              </span>
            </div>

            <div className="host-analytics-chart">
              {currentQuestion.answers.map((answer, index) => {
                const count = currentQuestion.answerStats[index];

                const maxCount = Math.max(
                  1,
                  ...currentQuestion.answerStats
                );

                const isCorrect =
                  index === currentQuestion.correctAnswer;

                const percentage = (count / maxCount) * 100;

                return (
                  <div
                    key={answer}
                    className={`host-analytics-column ${
                      isCorrect ? "is-correct" : "is-wrong"
                    }`}
                    style={{ "--bar-delay": `${index * 150}ms` }}
                  >
                    <strong className="host-analytics-count">
                      {count}
                    </strong>

                    <div className="host-analytics-track">
                      <div
                        className={`host-analytics-bar host-analytics-${answerColors[index]}`}
                        style={{
                          "--bar-height": `${Math.max(4, percentage)}%`,
                        }}
                      />
                    </div>

                    <div
                      className={`host-analytics-label host-answer-${answerColors[index]}`}
                    >
                      <span className="host-analytics-letter">
                        {String.fromCharCode(65 + index)}
                      </span>

                      <span className="host-analytics-answer">
                        {answer}
                      </span>

                      {isCorrect && (
                        <span className="host-analytics-check">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* LEADERBOARD */}
        {phase === "leaderboard" && (
          <section className="host-leaderboard-screen">
            <div className="host-results-heading">
              <span className="host-eyebrow">
                CORRECT ANSWER ·{" "}
                {currentQuestion.answers[currentQuestion.correctAnswer]}
              </span>

              <h1>Leaderboard</h1>

              <p>
                After question {questionIndex + 1} of {totalQuestions}
                {" · "}
                {phaseTime}s
              </p>
            </div>

            <div className="host-leaderboard-layout">
              <div className="host-leaderboard">
                {rankedPlayers.slice(0, 8).map((player, index) => (
                  <div
                    className="host-leaderboard-row"
                    key={player.id}
                  >
                    <span className="host-rank">{index + 1}</span>

                    <Devu
                      color={player.color}
                      number={player.number}
                      size={42}
                    />

                    <strong className="host-player-name">
                      {player.name}
                    </strong>

                    <span className="host-last-points">
                      +{player.lastPoints.toLocaleString()}
                    </span>

                    <strong className="host-player-score">
                      {player.score.toLocaleString()}
                    </strong>
                  </div>
                ))}
              </div>

              <aside className="host-team-panel">
                <div className="host-team-heading">
                  <strong>Team standings</strong>
                  <span>Average points per player</span>
                </div>

                {teamStats.map((team, index) => (
                  <div className="host-team-row" key={team.color}>
                    <div className="host-team-row-top">
                      <span>{index + 1}</span>

                      <span className={`host-team-dot ${team.color}`} />

                      <strong>Team {team.name}</strong>

                      <b>{team.average.toLocaleString()}</b>
                    </div>

                    <div className="host-team-bar">
                      <span
                        className={`host-team-bar-fill ${team.color}`}
                        style={{
                          width: `${
                            (team.average /
                              Math.max(
                                ...teamStats.map((item) => item.average),
                                1
                              )) *
                            100
                          }%`,
                        }}
                      />
                    </div>

                    <small>
                      {team.count} player{team.count === 1 ? "" : "s"}
                    </small>
                  </div>
                ))}
              </aside>
            </div>
          </section>
        )}

        {/* NEXT QUESTION */}
        {phase === "next" && (
          <section className="host-ready-screen">
            <span className="host-eyebrow">GET READY</span>

            <span className="host-small-chip">
              QUESTION {questionIndex + 2} OF {totalQuestions}
            </span>

            <h1>
              Next question<span>!</span>
            </h1>

            <div className="host-ring">
              <span>{phaseTime}</span>
            </div>

            <p>Eyes on the screen, fingers ready.</p>

            <div className="host-answer-legend">
              {["A", "B", "C", "D"].map((letter, index) => (
                <span
                  key={letter}
                  className={`host-legend-${answerColors[index]}`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* TEAM RESULTS */}
        {phase === "teams" && (
          <section className="host-team-results">
            <div className="host-results-heading">
              <span className="host-eyebrow">TEAM RESULTS</span>

              <h1>
                Team{" "}
                <span
                  className={`host-winning-name ${teamStats[0]?.color}`}
                >
                  {teamStats[0]?.name}
                </span>{" "}
                wins!
              </h1>
            </div>

            <div className="host-team-podium">
              {teamStats.map((team, index) => (
                <div
                  className={`host-team-podium-item ${team.color}`}
                  key={team.color}
                >
                  <Devu
                    color={team.color}
                    number={1}
                    size={index === 0 ? 100 : 76}
                  />

                  <strong>Team {team.name}</strong>

                  <span>
                    {team.count} player{team.count === 1 ? "" : "s"}
                  </span>

                  <div className="host-podium-block">
                    <b>{index + 1}</b>
                    <span>{team.average.toLocaleString()} avg</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="host-podium-note">
              Ranked by average points per player, so team size doesn't
              matter. Top 3 players next.
            </p>
          </section>
        )}

        {/* TOP THREE */}
        {phase === "podium" && (
          <section className="host-podium-screen">
            <div className="host-results-heading">
              <span className="host-eyebrow">FINAL RESULTS</span>
              <h1>And the winners are...</h1>
            </div>

            <div className="host-player-podium">
              {[1, 0, 2].map((rank) => {
                const player = rankedPlayers[rank];

                if (!player) return null;

                return (
                  <div
                    key={player.id}
                    className={`host-podium-player rank-${rank + 1} ${player.color}`}
                  >
                    {rank === 0 && (
                      <span className="host-crown">♛</span>
                    )}

                    <Devu
                      color={player.color}
                      number={player.number}
                      size={rank === 0 ? 125 : 95}
                    />

                    <strong>{player.name}</strong>

                    <span>{player.score.toLocaleString()} pts</span>

                    <div className="host-podium-block">
                      <b>{rank + 1}</b>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="host-podium-note">
              {players.length} players · Full leaderboard next.
            </p>
          </section>
        )}

        {/* FINAL RESULTS */}
        {phase === "final" && (
          <section className="host-final-screen">
            <div className="host-final-heading">
              <div>
                <span className="host-eyebrow">QUIZ COMPLETED</span>
                <h1>Final leaderboard.</h1>
              </div>

              <Link
                to={`/admin/host/${gameId}`}
                className="host-primary-button"
              >
                End game →
              </Link>
            </div>

            <div className="host-final-table">
              <div className="host-final-table-heading">
                <span>RANK</span>
                <span>PLAYER</span>
                <span>CORRECT</span>
                <span>SCORE</span>
              </div>

              {rankedPlayers.map((player, index) => (
                <div className="host-final-row" key={player.id}>
                  <span>{index + 1}</span>

                  <span className="host-final-player">
                    <Devu
                      color={player.color}
                      number={player.number}
                      size={42}
                    />
                    <strong>{player.name}</strong>
                  </span>

                  <span>
                    {player.correct}/{totalQuestions}
                  </span>

                  <strong>{player.score.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="host-footer">
        <span className="host-footer-blue" />
        <span className="host-footer-red" />
        <span className="host-footer-yellow" />
        <span className="host-footer-green" />
      </footer>
    </main>
  );
}

export default Game;
