
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Devu from "../../components/common/Devu";
import ThemeToggle from "../../components/common/ThemeToggle";
import "./AdminHostLobby.css";
import { apiRequest } from "../../api/client";
import { connectSocket } from "../../api/socket";

const mockPlayers = [
  { id: 1, nickname: "PixelMaster", avatar: { color: "blue", number: 3 } },
  { id: 2, nickname: "QuizWizard", avatar: { color: "red", number: 7 } },
  { id: 3, nickname: "BrainyBee", avatar: { color: "yellow", number: 2 } },
  { id: 4, nickname: "CodeNinja", avatar: { color: "green", number: 5 } },
];

function AdminHostLobby() {
  const { quizId } = useParams();

  const [players, setPlayers] = useState([]);
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState("LOBBY");

  const [gamePin, setGamePin] = useState("482916");
  const joinUrl = `http://192.168.3.29:5173/join/${quizId}`;

  useEffect(() => {
    let socket;
    apiRequest("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ quizId }),
    }).then((created) => {
      setSession(created);
      setGamePin(created.pin);
      socket = connectSocket();
      socket.emit("game:join", created.id, "host", () => {});
      socket.on("player_joined", ({ participant }) => {
        setPlayers((previous) => previous.some((player) => player.id === participant.id)
          ? previous
          : [...previous, { id: participant.id, nickname: participant.name, avatar: { color: participant.team.toLower?.() || participant.team, number: 1 } }]);
      });
      socket.on("player_left", ({ participantId }) => {
        setPlayers((previous) => previous.filter((player) => player.id !== participantId));
      });
      socket.on("phase", ({ phase: nextPhase }) => setPhase(nextPhase));
    }).catch(() => setPlayers(mockPlayers));
    return () => socket?.disconnect();
  }, [quizId]);

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

  async function handleStartGame() {
    if (players.length === 0) {
      setMessage("You need at least one player to start the game.");
      return;
    }
    if (!session) {
      setMessage("Demo mode: no live backend session is available.");
      setGameStarted(true);
      return;
    }
    try {
      await apiRequest(`/api/v1/sessions/${session.id}/start`, {
        method: "POST",
        body: JSON.stringify({ quizId }),
      });
      setGameStarted(true);
      setMessage("Live game started.");
    } catch {
      setGameStarted(true);
      setMessage("Demo mode: backend session unavailable.");
    }
  }

  async function handleReveal() {
    if (!session) return;
    try {
      await apiRequest(`/api/v1/sessions/${session.id}/reveal`, {
        method: "POST",
        body: JSON.stringify({ quizId }),
      });
    } catch {
      setMessage("Could not reveal the answer.");
    }
  }

  async function handleNext() {
    if (!session) return;
    try {
      await apiRequest(`/api/v1/sessions/${session.id}/next`, {
        method: "POST",
        body: JSON.stringify({ quizId }),
      });
    } catch {
      setMessage("Could not advance the game.");
    }
  }

  return (
    <div className="host-lobby-page">
      <header className="host-header">
        <Link to="/admin" className="host-brand">
          <span className="host-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            GDG KAU <strong>Quiz</strong>
          </span>
        </Link>

        <div className="host-header-right">
          <span className="host-status">
            <span />
            {gameStarted ? "Game started" : "Lobby open"}
          </span>

          <Link to="/admin" className="host-exit-link">
            Exit lobby
          </Link>

          <ThemeToggle />
        </div>
      </header>

      <main className="host-lobby-content">
        <div className="host-page-heading">
          <div>
            <span className="host-eyebrow">HOST CONTROL CENTER</span>
            <h1>
              {gameStarted ? "Game is starting!" : "Your lobby is ready."}
            </h1>
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
              type="button"
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
              <p>
                Players can scan this QR code with their phone camera.
              </p>
              <button
                type="button"
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
              <p>
                Share your PIN or QR code to invite people into the lobby.
              </p>
            </div>
          )}

          <div className="host-lobby-footer">
            <div className="host-waiting-indicator">
              <span />
              Waiting for players to join...
            </div>

            <button
              type="button"
              className="host-start-button"
              onClick={handleStartGame}
              disabled={gameStarted || players.length === 0}
            >
              {gameStarted ? "Game started ✓" : "Start game →"}
            </button>
            {gameStarted && phase === "ACTIVE" && (
              <button type="button" className="host-start-button" onClick={handleReveal}>
                Reveal answer
              </button>
            )}
            {gameStarted && phase === "REVEAL" && (
              <button type="button" className="host-start-button" onClick={handleNext}>
                Next question
              </button>
            )}
          </div>
        </section>

        {message && (
          <div className="host-message" role="status">
            {message}
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
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
