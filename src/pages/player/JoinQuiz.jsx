
import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import AvatarPicker from "../../components/player/AvatarPicker";
import Devu from "../../components/common/Devu";
import Navbar from "../../components/common/Navbar";
import "./JoinQuiz.css";
import { apiRequest } from "../../api/client";

const randomNames = [
  "CuriousCoder",
  "PixelWizard",
  "CodeNinja",
  "ByteExplorer",
  "CloudChaser",
  "TechSpark",
  "DebugMaster",
  "LogicLegend",
  "CyberFox",
  "DigitalDreamer",
  "QuantumCat",
  "DevExplorer",
];

function JoinQuiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState({
    color: "blue",
    number: 1,
  });
  const [error, setError] = useState("");

  // Optional quiz information passed through navigation state.
  const quizTitle = location.state?.quizTitle || "";
  const gamePin = location.state?.pin || "";

  function generateNickname() {
    const randomName =
      randomNames[Math.floor(Math.random() * randomNames.length)];

    const suffix = Math.floor(10 + Math.random() * 90);

    setNickname(`${randomName}${suffix}`);
    setError("");
  }

  async function handleSubmit(event) {
  event.preventDefault();

  const cleanNickname = nickname.trim();

  if (!cleanNickname) {
    setError("Please enter a nickname.");
    return;
  }

  if (!selectedAvatar) {
    setError("Please choose your Devu avatar.");
    return;
  }

  setError("");
  const pin = String(gamePin || quizId || "").replace(/\D/g, "");
  let participantId = "";
  if (/^\d{6}$/.test(pin)) {
    try {
      const participant = await apiRequest("/api/v1/sessions/join", {
        method: "POST",
        body: JSON.stringify({
          pin,
          name: cleanNickname,
          mascot: `${selectedAvatar.color}-${selectedAvatar.number}`,
          team: selectedAvatar.color,
        }),
      });
      participantId = participant.id;
      localStorage.setItem("gdgParticipantId", participant.id);
      localStorage.setItem("gdgSessionId", participant.sessionId);
    } catch (requestError) {
      setError(requestError.status === 409 ? "That nickname is already taken." : "Could not join the live session.");
      return;
    }
  }

  // Save player information for the gameplay screen
  localStorage.setItem("gdgNickname", cleanNickname);
  localStorage.setItem(
    "gdgAvatar",
    JSON.stringify(selectedAvatar)
  );

  navigate(`/lobby/${quizId}`, {
    state: {
      nickname: cleanNickname,
      avatar: selectedAvatar,
      quizTitle,
      pin: gamePin,
      participantId,
    },
  });
}

  return (
    <div className="join-page">
      <Navbar />

      <main className="join-container">
        <div className="join-heading">
          <span className="eyebrow">YOU'RE ALMOST IN</span>

          <h1>Choose your look</h1>

          <p>
            {quizTitle
              ? `${quizTitle} · Your mascot's color is your team.`
              : "Choose your nickname and find your Devu. Your mascot's color is your team."}
          </p>

          {gamePin && (
            <span className="join-pin">
              PIN {String(gamePin).replace(/(\d{3})(\d{3})/, "$1 $2")}
            </span>
          )}
        </div>

        <form
          id="player-registration"
          className="look-grid"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Player profile */}
          <section className="player-profile-card">
            <div className="player-avatar-preview">
              <Devu
                color={selectedAvatar.color}
                number={selectedAvatar.number}
                size={180}
              />
            </div>

            <span
              className={`team-label team-${selectedAvatar.color}`}
            >
              {selectedAvatar.color} team
            </span>

            <div className="nickname-field">
              <label htmlFor="nickname">Nickname</label>

              <div className="nickname-input-row">
                <input
                  id="nickname"
                  type="text"
                  maxLength={16}
                  autoComplete="off"
                  placeholder="Your nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setError("");
                  }}
                />

                <button
                  type="button"
                  className="random-name-button"
                  onClick={generateNickname}
                  aria-label="Generate random nickname"
                  title="Generate random nickname"
                >

<svg
  aria-hidden="true"
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <rect x="3" y="3" width="18" height="18" rx="4" />
  <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
  <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
  <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
  <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
</svg>
                </button>
              </div>

              <span className="nickname-hint">
                Choose a name your fellow players will recognize.
              </span>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="join-button desktop-join-button"
            >
              Join game <span aria-hidden="true">→</span>
            </button>
          </section>

          {/* Mascot selection */}
          <section className="mascot-selection-card">
            <div className="mascot-section-heading">
              <div>
                <h2>Pick a mascot</h2>
                <p>Your mascot represents you during the game.</p>
              </div>

              <span className="mascot-total">48 mascots</span>
            </div>

            <AvatarPicker
              selectedAvatar={selectedAvatar}
              onSelect={(avatar) => {
                setSelectedAvatar(avatar);
                setError("");
              }}
            />
          </section>
        </form>
      </main>

      {/* Mobile join footer */}
      <footer className="mobile-join-footer">
        <div className="mobile-selected-avatar">
          <Devu
            color={selectedAvatar.color}
            number={selectedAvatar.number}
            size={48}
          />

          <div>
            <strong>{nickname.trim() || "Your avatar"}</strong>
            <span>{selectedAvatar.color} team</span>
          </div>
        </div>

        <button
          type="submit"
          form="player-registration"
          className="join-button mobile-join-button"
        >
          Join game →
        </button>
      </footer>

      <footer className="join-footer">
        <p>Play. Think. Learn. · GDG KAU</p>
        <div className="join-footer-colorbar">
          <span />
          <span />
          <span />
          <span />
        </div>
      </footer>
    </div>
  );
}

export default JoinQuiz;
