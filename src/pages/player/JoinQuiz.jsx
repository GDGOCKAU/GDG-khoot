
import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import AvatarPicker from '../../components/player/AvatarPicker'
import Devu from '../../components/common/Devu'
import './JoinQuiz.css'

function JoinQuiz() {
  const { quizId } = useParams()
  const navigate = useNavigate()

  const [nickname, setNickname] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (!nickname.trim()) {
      setError('Please enter a nickname.')
      return
    }

    if (!selectedAvatar) {
      setError('Please choose your Devu avatar.')
      return
    }

    setError('')

    navigate(`/lobby/${quizId}`, {
      state: {
        nickname: nickname.trim(),
        avatar: selectedAvatar,
      },
    })
  }

  return (
    <div className="join-page">
      <header className="navbar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <i className="dot red" />
            <i className="dot green" />
            <i className="dot blue" />
            <i className="dot yellow" />
          </span>

          <span>
            GDG KAU <strong>Quiz</strong>
          </span>
        </Link>

        <Link to="/" className="back-link">
          ← Back to home
        </Link>
      </header>

      <main className="join-container">
        <div className="join-heading">
          <span className="eyebrow">GDG KAU COMMUNITY</span>
          <h1>Ready to play?</h1>
          <p>Choose your nickname and find your Devu.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <section className="registration-section">
            <label htmlFor="nickname">Your nickname</label>

            <input
              id="nickname"
              type="text"
              placeholder="Enter a nickname..."
              value={nickname}
              maxLength={20}
              onChange={(event) => {
                setNickname(event.target.value)
                setError('')
              }}
            />

            <span className="input-hint">
              Choose a name your fellow players will recognize.
            </span>
          </section>

          <section className="registration-section">
            <div className="avatar-heading">
              <div>
                <h2>Choose your Devu</h2>
                <p>Pick your favorite mascot to represent you.</p>
              </div>

              {selectedAvatar && (
                <div className="selected-preview">
                  <Devu
                    color={selectedAvatar.color}
                    number={selectedAvatar.number}
                    size={55}
                  />
                </div>
              )}
            </div>

            <AvatarPicker
              selectedAvatar={selectedAvatar}
              onSelect={(avatar) => {
                setSelectedAvatar(avatar)
                setError('')
              }}
            />
          </section>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="join-button">
            Join quiz →
          </button>
        </form>
      </main>

      <footer className="home-footer">
        <div className="footer-color-bar" />
        <p>Play. Think. Learn. · GDG KAU</p>
      </footer>
    </div>
  )
}

export default JoinQuiz
