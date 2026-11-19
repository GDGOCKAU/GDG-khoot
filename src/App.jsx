import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { G, hosted, startHost, stopGame } from './lib/engine';
import { isAdmin, quizById, useAppState } from './lib/store';
import { installSpiderDrag } from './lib/ui';
import { Bounce, LivePill } from './components/common/UI';

// Player pages
import Home from './pages/player/Home';
import JoinQuiz from './pages/player/JoinQuiz';
import PlayerGame from './pages/player/PlayerGame';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateQuiz from './pages/admin/CreateQuiz';
import HostGame from './pages/admin/HostGame';

function Loading() {
  return <main className="loading" aria-busy="true"><h1>Loading<Bounce /></h1></main>;
}

/* /join/:quizId — choose a look for a quiz */
function JoinRoute() {
  const { quizId } = useParams();
  const quiz = quizById(quizId);
  if (!quiz) return <Navigate to="/" replace />;
  return <JoinQuiz key={quizId} quiz={quiz} live={false} />;
}
/* /live — join the game this device is hosting */
function LiveRoute() {
  useAppState();
  if (!hosted()) return <Navigate to="/" replace />;
  return <JoinQuiz key={'live:' + G.quiz.id} quiz={G.quiz} live />;
}
/* /host/:quizId — the host's big screen. Opening it starts a new game (admins only). */
function HostRoute() {
  useAppState();
  const { quizId } = useParams();
  const quiz = quizById(quizId);
  const running = hosted() && G.quiz.id === quizId;
  useEffect(() => {
    if (!(hosted() && G.quiz.id === quizId) && quiz && isAdmin()) startHost(quiz);
  }, [quizId, quiz]);
  if (running) return <HostGame />;
  if (quiz && isAdmin()) return null;
  return <Navigate to="/" replace />;
}
/* /admin/* — needs the admin password */
function AdminGate({ children }) {
  useAppState();
  return isAdmin() ? children : <AdminLogin />;
}
/* one element for /admin/new and /admin/edit/:quizId, so saving a new quiz
   (which swaps the URL) keeps the editor and your cursor in place */
function EditorRoute() {
  const { quizId } = useParams();
  if (!quizId) return <CreateQuiz />;
  const quiz = quizById(quizId);
  if (!quiz) return <Navigate to="/admin" replace />;
  return <CreateQuiz quiz={quiz} />;
}

function App() {
  const location = useLocation();
  const [booted, setBooted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setBooted(true), 1400); return () => clearTimeout(t); }, []);
  useEffect(() => installSpiderDrag(), []);

  /* leaving the player screen ends a practice game; every page starts at the top */
  useEffect(() => {
    const first = location.pathname.split('/').filter(Boolean)[0];
    if (G && G.mode === 'player' && first !== 'play') stopGame();
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!booted) return <Loading />;

  return <>
    <Routes>
      {/* Player routes */}
      <Route path="/" element={<Home />} />
      <Route path="/join/:quizId" element={<JoinRoute />} />
      <Route path="/live" element={<LiveRoute />} />
      <Route path="/play" element={<PlayerGame />} />

      {/* Host + admin routes */}
      <Route path="/host/:quizId" element={<HostRoute />} />
      <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
      <Route path="/admin/new" element={<AdminGate><EditorRoute /></AdminGate>} />
      <Route path="/admin/edit/:quizId" element={<AdminGate><EditorRoute /></AdminGate>} />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <LivePill />
  </>;
}

export default App;
