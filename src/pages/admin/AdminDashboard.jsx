
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import { apiRequest } from "../../api/client";

const initialQuizzes = [
  {
    id: 1,
    title: "Flutter Basics",
    topic: "Mobile",
    questions: 10,
    lastHosted: "Nov 12",
    status: "Ready",
  },
  {
    id: 2,
    title: "Cloud 101",
    topic: "Cloud",
    questions: 12,
    lastHosted: "Nov 5",
    status: "Ready",
  },
  {
    id: 3,
    title: "AI & Machine Learning",
    topic: "AI",
    questions: 8,
    lastHosted: "Never",
    status: "Draft",
  },
  {
    id: 4,
    title: "Web Dev Essentials",
    topic: "Web",
    questions: 15,
    lastHosted: "Oct 29",
    status: "Ready",
  },
];

function AdminDashboard() {
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest("/api/v1/quizzes")
      .then((items) => {
        setQuizzes(items.map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          topic: "Other",
          questions: quiz.questions?.length ?? 0,
          lastHosted: "Never",
          status: quiz.isPublished ? "Ready" : "Draft",
        })));
      })
      .catch(() => setMessage("Showing demo quizzes; backend is unavailable or sign-in expired."));
  }, []);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      const matchesSearch =
        quiz.title.toLowerCase().includes(search.toLowerCase()) ||
        quiz.topic.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === "All" || quiz.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [quizzes, search, activeFilter]);

  function handleEdit(quiz) {
    navigate(`/admin/edit/${quiz.id}`);
  }

  function handleHost(quiz) {
    navigate(`/admin/host/${quiz.id}`);
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          <span className="admin-brand-mark">
            <i className="brand-blue" />
            <i className="brand-red" />
            <i className="brand-yellow" />
            <i className="brand-green" />
          </span>

          <span>
            <strong>
              GDG KAU <span>Quiz</span>
            </strong>
            <small>ADMIN</small>
          </span>
        </Link>

        <nav className="admin-navigation">
          <Link to="/admin" className="admin-nav-link active">
            <span>▦</span>
            Dashboard
          </Link>

          <Link to="/admin/create" className="admin-nav-link">
            <span>⊕</span>
            Create quiz
          </Link>

          <Link to="/admin/results" className="admin-nav-link">
            <span>▥</span>
            Results
          </Link>
        </nav>

        <div className="admin-session">
          <div className="session-icon">♙</div>
          <div>
            <strong>Admin session</strong>
            <Link to="/">Back to player home</Link>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="dashboard-header">
          <div>
            <h1>Dashboard.</h1>
            <p>
              Create quizzes and host live games for GDG KAU events.
            </p>
          </div>

          <Link to="/admin/create" className="create-quiz-button">
            <span>＋</span> Create quiz
          </Link>
        </header>

        <section className="dashboard-stats">
          <article className="stat-card stat-blue">
            <strong>12</strong>
            <span>Quizzes</span>
          </article>

          <article className="stat-card stat-red">
            <strong>8</strong>
            <span>Games hosted</span>
          </article>

          <article className="stat-card stat-yellow">
            <strong>24</strong>
            <span>Players this month</span>
          </article>

          <article className="stat-card stat-green">
            <strong>92%</strong>
            <span>Average accuracy</span>
          </article>
        </section>

        <section className="quiz-management">
          <div className="quiz-management-header">
            <h2>Your quizzes</h2>

            <div className="quiz-tools">
              <input
                type="search"
                placeholder="Search quizzes..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search quizzes"
              />

              <div className="quiz-filters">
                {["All", "Ready", "Draft"].map((filter) => (
                  <button
                    key={filter}
                    className={
                      activeFilter === filter ? "selected" : ""
                    }
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {message && (
            <div className="dashboard-message" role="status">
              {message}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}

          <div className="quiz-table-wrapper">
            <table className="quiz-table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Topic</th>
                  <th>Questions</th>
                  <th>Last hosted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredQuizzes.map((quiz) => (
                  <tr key={quiz.id}>
                    <td className="quiz-title-cell">
                      {quiz.title}
                    </td>

                    <td>
                      <span
                        className={`topic-tag topic-${quiz.topic.toLowerCase()}`}
                      >
                        {quiz.topic}
                      </span>
                    </td>

                    <td>{quiz.questions}</td>
                    <td>{quiz.lastHosted}</td>

                    <td>
                      <span
                        className={`status-tag ${quiz.status.toLowerCase()}`}
                      >
                        <span />
                        {quiz.status}
                      </span>
                    </td>

                    <td>
                      <div className="quiz-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEdit(quiz)}
                        >
                          Edit
                        </button>

                        {quiz.status === "Ready" ? (
                          <button
                            className="host-button"
                            onClick={() => handleHost(quiz)}
                          >
                            Host live
                          </button>
                        ) : (
                          <button
                            className="continue-button"
                            onClick={() => handleEdit(quiz)}
                          >
                            Continue editing
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredQuizzes.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-table">
                      No quizzes found. Try another search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-quiz-list">
            {filteredQuizzes.map((quiz) => (
              <article className="mobile-quiz-card" key={quiz.id}>
                <div className="mobile-quiz-top">
                  <strong>{quiz.title}</strong>

                  <span
                    className={`status-tag ${quiz.status.toLowerCase()}`}
                  >
                    <span />
                    {quiz.status}
                  </span>
                </div>

                <p>
                  {quiz.topic} · {quiz.questions} questions
                </p>

                <div className="mobile-quiz-actions">
                  <button
                    className="edit-button"
                    onClick={() => handleEdit(quiz)}
                  >
                    Edit
                  </button>

                  {quiz.status === "Ready" && (
                    <button
                      className="host-button"
                      onClick={() => handleHost(quiz)}
                    >
                      Host live
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <p className="dashboard-footer">
          GDG KAU Quiz · Admin workspace
        </p>
      </main>
    </div>
  );
}

export default AdminDashboard;
