
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CreateQuiz.css";

const createQuestion = (number = 1) => ({
  id: crypto.randomUUID(),
  title: `Question ${number}`,
  text: "",
  answers: ["", "", "", ""],
  correctAnswer: 0,
  timeLimit: 20,
  points: 1000,
});

function CreateQuiz() {
  const navigate = useNavigate();

  const [quizTitle, setQuizTitle] = useState("");
  const [quizId] = useState(() => crypto.randomUUID());
  const [topic, setTopic] = useState("Technology");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([createQuestion()]);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [message, setMessage] = useState("");

  const currentQuestion = questions[activeQuestion];

  function updateQuestion(field, value) {
    setQuestions((previous) =>
      previous.map((question, index) =>
        index === activeQuestion
          ? { ...question, [field]: value }
          : question
      )
    );
  }

  function updateAnswer(answerIndex, value) {
    setQuestions((previous) =>
      previous.map((question, index) =>
        index === activeQuestion
          ? {
              ...question,
              answers: question.answers.map((answer, i) =>
                i === answerIndex ? value : answer
              ),
            }
          : question
      )
    );
  }

  function addQuestion() {
    const newQuestion = createQuestion(questions.length + 1);

    setQuestions((previous) => [...previous, newQuestion]);
    setActiveQuestion(questions.length);
    setMessage("");
  }

  function duplicateQuestion() {
    const copy = {
      ...currentQuestion,
      id: crypto.randomUUID(),
      title: `Question ${questions.length + 1}`,
      answers: [...currentQuestion.answers],
    };

    const updated = [...questions];
    updated.splice(activeQuestion + 1, 0, copy);

    setQuestions(updated);
    setActiveQuestion(activeQuestion + 1);
    setMessage("");
  }

  function deleteQuestion() {
    if (questions.length === 1) {
      setMessage("A quiz must have at least one question.");
      return;
    }

    const updated = questions.filter(
      (_, index) => index !== activeQuestion
    );

    setQuestions(updated);
    setActiveQuestion(Math.max(0, activeQuestion - 1));
    setMessage("");
  }

  function validateQuiz() {
    if (!quizTitle.trim()) {
      return "Please enter a quiz title.";
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (!question.text.trim()) {
        return `Please write the question for Question ${i + 1}.`;
      }

      if (question.answers.some((answer) => !answer.trim())) {
        return `Please complete all four answers in Question ${i + 1}.`;
      }
    }

    return "";
  }

  function saveDraft() {
  const quizData = {
    id: quizId,
    title: quizTitle.trim() || "Untitled Quiz",
    topic,
    description,
    questions,
    status: "Draft",
    lastHosted: "Never",
    updatedAt: new Date().toISOString(),
  };

  const savedQuizzes = JSON.parse(
    localStorage.getItem("gdgQuizzes") || "[]"
  );

  const updatedQuizzes = [
    ...savedQuizzes.filter((quiz) => quiz.id !== quizId),
    quizData,
  ];

  localStorage.setItem("gdgQuizzes", JSON.stringify(updatedQuizzes));

  setMessage("Your draft has been saved successfully!");
}

  function publishQuiz() {
  const validationError = validateQuiz();

  if (validationError) {
    setMessage(validationError);
    return;
  }

  const quizData = {
    id: quizId,
    title: quizTitle.trim(),
    topic,
    description,
    questions,
    status: "Ready",
    lastHosted: "Never",
    updatedAt: new Date().toISOString(),
  };

  const savedQuizzes = JSON.parse(
    localStorage.getItem("gdgQuizzes") || "[]"
  );

  const updatedQuizzes = [
    ...savedQuizzes.filter((quiz) => quiz.id !== quizId),
    quizData,
  ];

  localStorage.setItem("gdgQuizzes", JSON.stringify(updatedQuizzes));

  setMessage("Your quiz has been published successfully!");
}

  return (
    <div className="create-quiz-page">
      <header className="editor-header">
        <Link to="/admin" className="editor-brand">
          <span className="editor-brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>GDG KAU <strong>Quiz</strong></span>
        </Link>

        <div className="editor-header-actions">
          <span className="draft-indicator">
            <span />
            Unsaved changes
          </span>

          <button className="save-draft-button" onClick={saveDraft}>
            Save draft
          </button>

          <button className="publish-button" onClick={publishQuiz}>
            Publish quiz →
          </button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="question-sidebar">
          <Link to="/admin" className="editor-back-link">
            ← Back to dashboard
          </Link>

          <div className="question-sidebar-heading">
            <div>
              <h2>Questions</h2>
              <p>{questions.length} questions</p>
            </div>
            <span className="question-count">{questions.length}</span>
          </div>

          <div className="question-list">
            {questions.map((question, index) => (
              <button
                key={question.id}
                className={`question-list-item ${
                  activeQuestion === index ? "active" : ""
                }`}
                onClick={() => {
                  setActiveQuestion(index);
                  setMessage("");
                }}
              >
                <span className="question-number">{index + 1}</span>
                <span className="question-list-text">
                  {question.text.trim()
                    ? question.text
                    : `Question ${index + 1}`}
                </span>
                <span className="question-menu-dot">···</span>
              </button>
            ))}
          </div>

          <button className="add-question-button" onClick={addQuestion}>
            + Add question
          </button>

          <div className="sidebar-bottom">
            <span>QUIZ OVERVIEW</span>
            <p>{questions.length} questions added</p>
          </div>
        </aside>

        <section className="editor-main">
          <div className="editor-page-heading">
            <div>
              <span className="editor-eyebrow">QUIZ BUILDER</span>
              <h1>Create your quiz.</h1>
              <p>Build your questions and get ready to challenge your players.</p>
            </div>

            <span className="editor-step-label">
              Question {activeQuestion + 1} of {questions.length}
            </span>
          </div>

          <section className="quiz-details-card">
            <div className="section-heading">
              <div>
                <h2>Quiz details</h2>
                <p>Give your quiz a name and a little context.</p>
              </div>
              <span className="section-icon">✦</span>
            </div>

            <div className="quiz-details-fields">
              <div className="editor-field">
                <label htmlFor="quiz-title">Quiz title</label>
                <input
                  id="quiz-title"
                  type="text"
                  placeholder="e.g. Introduction to AI"
                  value={quizTitle}
                  onChange={(event) => setQuizTitle(event.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="editor-field">
                <label htmlFor="quiz-topic">Topic</label>
                <select
                  id="quiz-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                >
                  <option>Technology</option>
                  <option>Programming</option>
                  <option>Artificial Intelligence</option>
                  <option>Cloud Computing</option>
                  <option>Cybersecurity</option>
                  <option>General Knowledge</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="editor-field full-width">
                <label htmlFor="quiz-description">Description</label>
                <textarea
                  id="quiz-description"
                  placeholder="What is this quiz about?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={180}
                />
              </div>
            </div>
          </section>

          <section className="question-editor-card">
            <div className="section-heading question-editor-heading">
              <div>
                <span className="editor-eyebrow">QUESTION {activeQuestion + 1}</span>
                <h2>Edit question</h2>
                <p>Write your question and configure the answer choices.</p>
              </div>

              <div className="question-tools">
                <button
                  className="icon-action"
                  onClick={duplicateQuestion}
                  title="Duplicate question"
                >
                  Duplicate
                </button>
                <button
                  className="icon-action delete-action"
                  onClick={deleteQuestion}
                  title="Delete question"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="editor-field">
              <label htmlFor="question-text">Question text</label>
              <textarea
                id="question-text"
                className="question-text-input"
                placeholder="Type your question here..."
                value={currentQuestion.text}
                onChange={(event) =>
                  updateQuestion("text", event.target.value)
                }
                rows={3}
                maxLength={250}
              />
            </div>

            <div className="answers-heading">
              <div>
                <h3>Answer choices</h3>
                <p>Select the correct answer by clicking its circle.</p>
              </div>
              <span>4 OPTIONS</span>
            </div>

            <div className="answer-grid">
              {currentQuestion.answers.map((answer, index) => (
                <div
                  key={index}
                  className={`answer-option answer-option-${index + 1} ${
                    currentQuestion.correctAnswer === index ? "correct" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="correct-selector"
                    onClick={() => updateQuestion("correctAnswer", index)}
                    aria-label={`Mark answer ${index + 1} as correct`}
                    title="Mark as correct answer"
                  >
                    {currentQuestion.correctAnswer === index ? "✓" : ""}
                  </button>

                  <span className="answer-letter">
                    {String.fromCharCode(65 + index)}
                  </span>

                  <input
                    type="text"
                    placeholder={`Answer option ${index + 1}`}
                    value={answer}
                    onChange={(event) =>
                      updateAnswer(index, event.target.value)
                    }
                    aria-label={`Answer option ${index + 1}`}
                    maxLength={100}
                  />

                  {currentQuestion.correctAnswer === index && (
                    <span className="correct-label">Correct</span>
                  )}
                </div>
              ))}
            </div>

            <div className="question-settings">
              <div className="answers-heading">
                <div>
                  <h3>Question settings</h3>
                  <p>Adjust the time and points for this question.</p>
                </div>
              </div>

              <div className="settings-grid">
                <div className="editor-field">
                  <label htmlFor="time-limit">Time limit</label>
                  <select
                    id="time-limit"
                    value={currentQuestion.timeLimit}
                    onChange={(event) =>
                      updateQuestion("timeLimit", Number(event.target.value))
                    }
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={20}>20 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={90}>90 seconds</option>
                    <option value={120}>120 seconds</option>
                  </select>
                </div>

                <div className="editor-field">
                  <label htmlFor="points">Points</label>
                  <select
                    id="points"
                    value={currentQuestion.points}
                    onChange={(event) =>
                      updateQuestion("points", Number(event.target.value))
                    }
                  >
                    <option value={500}>500 points</option>
                    <option value={1000}>1000 points</option>
                    <option value={1500}>1500 points</option>
                    <option value={2000}>2000 points</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {message && (
            <div className="editor-message" role="status">
              {message}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}

          <div className="editor-bottom-actions">
            <button
              className="previous-question-button"
              onClick={() => setActiveQuestion(Math.max(0, activeQuestion - 1))}
              disabled={activeQuestion === 0}
            >
              ← Previous
            </button>

            <button className="next-question-button" onClick={() => {
              if (activeQuestion < questions.length - 1) {
                setActiveQuestion(activeQuestion + 1);
                setMessage("");
              } else {
                addQuestion();
              }
            }}>
              {activeQuestion === questions.length - 1
                ? "Add next question +"
                : "Next question →"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default CreateQuiz;
