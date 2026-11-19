
import { useLocation, useParams, Link } from "react-router-dom";

import Devu from "../../components/common/Devu";
import Navbar from "../../components/common/Navbar";
import "./Lobby.css";

function Lobby() {
  const location = useLocation();
  const { quizId } = useParams();

  const nickname =
    location.state?.nickname ||
    localStorage.getItem("gdgNickname") ||
    "Guest Player";

  let savedAvatar = { color: "blue", number: 1 };

  try {
    savedAvatar = JSON.parse(
      localStorage.getItem("gdgAvatar") ||
        '{"color":"blue","number":1}'
    );
  } catch {
    savedAvatar = { color: "blue", number: 1 };
  }

  const avatar = location.state?.avatar || savedAvatar;
  const quizTitle = location.state?.quizTitle || "";
  const gamePin = location.state?.pin || "";

  const teamNames = {
    blue: "Blue",
    red: "Red",
    yellow: "Yellow",
    green: "Green",
  };

  const teamName = teamNames[avatar.color] || "Blue";

  return (
    <div className="lobby-page">
      <Navbar />

      <main className="lobby-content">
        <div className="lobby-center">
          <div className="lobby-avatar">
            <Devu
              color={avatar.color}
              number={avatar.number}
              size={170}
            />
          </div>

          <h1 className="lobby-title">
            You're in<span>!</span>
          </h1>

          <p className="lobby-message">
            <strong>{nickname}</strong>, you're in! Waiting for the host
            to start the game
            <span className="waiting-ellipsis" aria-label="Loading">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>

          {quizTitle && (
            <p className="lobby-quiz-title">{quizTitle}</p>
          )}

          {gamePin && (
            <div className="lobby-pin">
              Game PIN: <strong>{gamePin}</strong>
            </div>
          )}

          <span className={`lobby-team-chip team-${avatar.color}`}>
            Team {teamName}
          </span>

          <div className="lobby-status">
            <span className="lobby-status-dot" />
            Waiting for host
          </div>

          <Link to="/" className="lobby-home-link">
            Leave game
          </Link>
        </div>
      </main>

      <footer className="lobby-footer">
        <div className="lobby-colorbar" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </footer>
    </div>
  );
}

export default Lobby;
