
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Devu from "../../components/common/Devu";
import "./AdminHostLobby.css";

const mockPlayers = [
  { id: 1, nickname: "PixelMaster", avatar: { color: "blue", number: 3 } },
  { id: 2, nickname: "QuizWizard", avatar: { color: "red", number: 7 } },
  { id: 3, nickname: "BrainyBee", avatar: { color: "yellow", number: 2 } },
  { id: 4, nickname: "CodeNinja", avatar: { color: "green", number: 5 } },
];

function AdminHostLobby() {
  const { quizId } = useParams();

  const [players] = useState(mockPlayers);
  const [copied, setCopied] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState("");

  const gamePin = "482916";
  const joinUrl = `http://192.168.3.29:5173/join/${quizId}`;
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setMessage(`${label} copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(`Copy wasn't available. You can copy this manually: ${text}`);
    }
  }

  function handleStartGame() {
    if (players.length === 0) {
      setMessage("You need at least one player to start the game.");
      return;
    }

    setGameStarted(true);
    setMessage("Demo mode: the live quiz screen will be connected next.");
  }

  return (
    <div className="host-lobby-page">
      <header className="host-header">
        <Link to="/admin" className="host-brand">
          <span className="host-brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>GDG KAU <strong>Quiz</strong></span>
        </Link>

        <div className="host-header-right">
          <span className="host-status">
            <span />
            {gameStarted ? "Game started" : "Lobby open"}
          </span>
          <Link to="/admin" className="host-exit-link">
            Exit lobby
          </Link>
        </div>
      </header>

      <main className="host-lobby-content">
        <div className="host-page-heading">
          <div>
            <span className="host-eyebrow">HOST CONTROL CENTER</span>
            <h1>{gameStarted ? "Game is starting!" : "Your lobby is ready."}</h1>
            <p>
              {gameStarted
                ? "The live quiz screen will be available in the next stage."
                : "Invite players to join. The game begins when you're ready."}
            </p>
          </div>

          <span className="host-demo-badge">DEMO MODE</span>
        </div>

        <section className="host-invite-grid">
          <div className="host-pin-card">
            <span className="host-card-eyebrow">GAME PIN</span>
            <div className="host-pin-number">482 916</div>
            <p>Players can enter this PIN to join your quiz.</p>

            <button
              className="host-copy-pin"
              onClick={() => copyText(gamePin, "Game PIN")}
            >
              {copied ? "Copied!" : "Copy game PIN"}
            </button>
          </div>

          <div className="host-qr-card">
            <div className="host-qr-image">
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="H"
                includeMargin
              />
            </div>

            <div className="host-qr-text">
              <h2>Scan to join</h2>
              <p>Players can scan this QR code with their phone camera.</p>
              <button
                className="host-copy-link"
                onClick={() => copyText(joinUrl, "Join link")}
              >
                Copy join link ↗
              </button>
            </div>
          </div>
        </section>

        <section className="host-players-card">
          <div className="host-players-heading">
            <div>
              <span className="host-eyebrow">THE LOBBY</span>
              <h2>Players joined</h2>
              <p>These players are waiting for the quiz to begin.</p>
            </div>

            <div className="host-player-count">
              <strong>{players.length}</strong>
              <span>Players</span>
            </div>
          </div>

          {players.length > 0 ? (
            <div className="host-player-grid">
              {players.map((player, index) => (
                <article className="host-player-card" key={player.id}>
                  <div className="host-player-avatar">
                    <Devu
                      color={player.avatar.color}
                      number={player.avatar.number}
                    />
                  </div>

                  <div className="host-player-details">
                    <strong>{player.nickname}</strong>
                    <span>Player {index + 1}</span>
                  </div>

                  <span className="host-player-check">✓</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="host-empty-players">
              <span>♙</span>
              <h3>Waiting for players</h3>
              <p>Share your PIN or QR code to invite people into the lobby.</p>
            </div>
          )}

          <div className="host-lobby-footer">
            <div className="host-waiting-indicator">
              <span />
              Waiting for players to join...
            </div>

            <button
              className="host-start-button"
              onClick={handleStartGame}
              disabled={gameStarted || players.length === 0}
            >
              {gameStarted ? "Game started ✓" : "Start game →"}
            </button>
          </div>
        </section>

        {message && (
          <div className="host-message" role="status">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        <p className="host-demo-note">
          Demo mode · Sample players are displayed until real-time backend
          integration.
        </p>
      </main>
    </div>
  );
}

export default AdminHostLobby;
