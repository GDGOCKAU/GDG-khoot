
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Devu from "../../components/common/Devu";
import "./Lobby.css";

const mockPlayers = [
  {
    id: 1,
    nickname: "PixelMaster",
    avatar: { color: "blue", number: 3 },
  },
  {
    id: 2,
    nickname: "QuizWizard",
    avatar: { color: "red", number: 7 },
  },
  {
    id: 3,
    nickname: "BrainyBee",
    avatar: { color: "yellow", number: 2 },
  },
  {
    id: 4,
    nickname: "CodeNinja",
    avatar: { color: "green", number: 5 },
  },
];

function Lobby() {
  const { quizId } = useParams();
  const location = useLocation();

  const nickname = location.state?.nickname || "Guest Player";

  const avatar = location.state?.avatar || {
    color: "blue",
    number: 1,
  };

  const [copied, setCopied] = useState(false);

  // Temporary players until backend integration
  const players = [
    {
      id: "you",
      nickname,
      avatar,
      isYou: true,
    },
    ...mockPlayers,
  ];

  const gamePin = "482916";

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(gamePin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard access
      const textArea = document.createElement("textarea");

      textArea.value = gamePin;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert(`Your game PIN is ${gamePin}`);
      }
    }
  }

  return (
    <main className="lobby-page">
      <header className="lobby-header">
        <Link to="/" className="lobby-brand">
          <span className="brand-dots">
            <span />
            <span />
            <span />
            <span />
          </span>

          GDG KAU <span>Quiz</span>
        </Link>

        <span className="demo-label">DEMO LOBBY</span>
      </header>

      <section className="lobby-content">
        {/* Welcome message */}
        <div className="lobby-heading">
          <div className="lobby-success-icon">✓</div>

          <p className="lobby-eyebrow">YOU'RE IN!</p>

          <h1>Waiting for the host</h1>

          <p>
            You're all set, <strong>{nickname}</strong>!
            The quiz will begin when the host starts the game.
          </p>
        </div>

        {/* Game PIN */}
        <section className="pin-card">
          <p className="pin-label">GAME PIN</p>

          <div className="pin-number">{gamePin}</div>

          <button
            className="copy-pin-button"
            onClick={copyPin}
            type="button"
          >
            {copied ? "✓ Copied!" : "Copy PIN"}
          </button>

          <p className="pin-hint">
            Share this PIN with other players to join.
          </p>
        </section>

        {/* Players */}
        <section className="players-section">
          <div className="players-heading">
            <div>
              <h2>Players</h2>
              <p>Everyone who's joined the lobby</p>
            </div>

            <span className="player-count">
              {players.length} players
            </span>
          </div>

          <div className="players-grid">
            {players.map((player) => (
              <article
                className={`player-card ${
                  player.isYou ? "your-player-card" : ""
                }`}
                key={player.id}
              >
                <div className="player-avatar">
                  <Devu
                    color={player.avatar.color}
                    number={player.avatar.number}
                  />
                </div>

                <div className="player-info">
                  <span className="player-name">
                    {player.nickname}
                  </span>

                  {player.isYou && (
                    <span className="you-label">YOU</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Waiting status */}
        <div className="waiting-message" role="status">
          <span className="waiting-dot" />
          Waiting for the host to start the quiz...
        </div>

        <p className="lobby-demo-note">
          Demo mode · Other players shown are sample players.
        </p>
      </section>
    </main>
  );
}

export default Lobby;
