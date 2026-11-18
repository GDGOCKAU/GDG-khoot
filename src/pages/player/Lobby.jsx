
import { Link, useLocation } from "react-router-dom";
import Devu from "../../components/common/Devu";
import "./Lobby.css";

function Lobby() {
  const location = useLocation();

  // Retrieve player information from navigation state or localStorage
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

  const teamNames = {
    blue: "Blue",
    red: "Red",
    yellow: "Yellow",
    green: "Green",
  };

  const teamName = teamNames[avatar.color] || "Blue";

  return (
    <main className="lobby-page">
      <header className="lobby-header">
        <Link to="/" className="lobby-brand">
          <span className="brand-dots" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>

          <span className="lobby-brand-name">
            GDG KAU <strong>Quiz</strong>
          </span>
        </Link>
      </header>

      <section className="lobby-content">
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
            {nickname}, you're in! Waiting for the host
            to start the game
            <span className="waiting-ellipsis" aria-label="Loading">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>

          <span className={`lobby-team-chip team-${avatar.color}`}>
            Team {teamName}
          </span>

          <span className="lobby-host-link">
            Open the host screen to start
          </span>
        </div>
      </section>

      <footer className="lobby-footer">
        <div className="lobby-colorbar" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </footer>
    </main>
  );
}

export default Lobby;
