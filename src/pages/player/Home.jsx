
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Devu from '../../components/common/Devu'
import './Home.css'

function Home() {
  const [mascot] = useState(() => {
    const colors = ['blue', 'red', 'yellow', 'green']

    const color = colors[Math.floor(Math.random() * colors.length)]
    const number = Math.floor(Math.random() * 12) + 1

    return { color, number }
  })

  return (
    <div className="home-page">
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

        <nav className="nav-links">
          <a href="#quizzes">Quizzes</a>

          <Link to="/admin/login" className="admin-link">
            Admin
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">
            GOOGLE DEVELOPER GROUPS · KAU
          </span>

          <h1>
            Play. Think.
            <br />
            <span>Learn.</span>
          </h1>

          <p>
            Think you know your tech?
            <br />
            Take on a challenge and learn with the GDG KAU community.
          </p>

          <a href="#quizzes" className="primary-button">
            Explore quizzes <span>→</span>
          </a>

          <div className="hero-mascot">
            <Devu
              color={mascot.color}
              number={mascot.number}
              size={140}
            />
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <span className="decoration-dot blue" />
            <span className="decoration-dot red" />
            <span className="decoration-dot yellow" />
            <span className="decoration-dot green" />
          </div>
        </section>

        <section className="quiz-section" id="quizzes">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">
                LEARN SOMETHING NEW
              </span>

              <h2>Explore quizzes</h2>
            </div>
          </div>

          <div className="empty-state">
            <h3>Something exciting is coming.</h3>

            <p>
              Quizzes created by the GDG KAU community
              will show up here. Stay curious!
            </p>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-color-bar" />
        <p>Play. Think. Learn. · GDG KAU</p>
      </footer>
    </div>
  )
}

export default Home
