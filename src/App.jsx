
import { Routes, Route, Navigate } from "react-router-dom";

// Player pages
import Home from "./pages/player/Home";
import JoinQuiz from "./pages/player/JoinQuiz";
import Lobby from "./pages/player/Lobby";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CreateQuiz from "./pages/admin/CreateQuiz";
import AdminHostLobby from "./pages/admin/AdminHostLobby";
import Game from "./pages/player/Game";
import PlayerGame from "./pages/player/PlayerGame";

function ResultsPlaceholder() {
  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Quiz Results</h1>
      <p>The results dashboard is coming soon.</p>
    </main>
  );
}

function App() {
  return (
    <Routes>
      {/* Player routes */}
      <Route path="/" element={<Home />} />

      <Route
        path="/join/:quizId"
        element={<JoinQuiz />}
      />

      <Route
        path="/lobby/:quizId"
        element={<Lobby />}
      />

      {/* Admin routes */}
      <Route
        path="/admin/login"
        element={<AdminLogin />}
      />

      <Route
        path="/admin"
        element={<AdminDashboard />}
      />

      <Route
        path="/admin/create"
        element={<CreateQuiz />}
      />

      <Route
        path="/admin/host/:quizId"
        element={<AdminHostLobby />}
      />

      <Route
        path="/admin/results"
        element={<ResultsPlaceholder />}
      />

      {/* Redirect unknown routes */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

      <Route path="/game/:gameId" element={<Game />} />
      <Route path="/play/:gameId" element={<PlayerGame />} />
    </Routes>
  );
}

export default App;
