import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { G, UI, hosted, startHost, stopGame } from './lib/engine';
import { isAdmin, notify, quizById, useAppState } from './lib/store';
import { installSpiderDrag } from './lib/ui';
import { toast } from './lib/ui';
import { Bounce, LivePill } from './components/common/UI';
import ErrorBoundary from './components/common/ErrorBoundary';

// Player pages
import Home from './pages/player/Home';
import JoinQuiz from './pages/player/JoinQuiz';
import JoinError from './pages/player/JoinError';
import PlayerGame, { PlayerLobby } from './pages/player/PlayerGame';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateQuiz from './pages/admin/CreateQuiz';
import HostGame from './pages/admin/HostGame';
import ScreenPage from './pages/screen/ScreenPage';
import { apiRequest } from './api/client';
import { syncLiveQuiz } from './lib/liveQuiz';
import { ensureQuiz } from './lib/serverQuizzes';
import { connectLiveHost, leaveLive, rememberHostSession, resumeLiveHost, resumeLivePlayer } from './lib/live';

function Loading() {
  return <main className="loading" aria-busy="true"><h1>Loading<Bounce /></h1></main>;
}

/* /join/:quizId — choose a look for a quiz */
function JoinRoute() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const pin = searchParams.get('pin');
  const sessionId = searchParams.get('session');
  const [liveQuiz, setLiveQuiz] = useState(null);
  const [liveError, setLiveError] = useState('');
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    apiRequest(`/api/v1/sessions/by-pin/${pin}`)
      .then((live) => {
        if (cancelled) return;
        if (live.quiz.id !== quizId) { setLiveError('mismatch'); return; }
        if (sessionId && live.sessionId !== sessionId) { setLiveError('mismatch'); return; }
        setLiveQuiz(syncLiveQuiz(live));
      })
      .catch((error) => {
        if (cancelled) return;
        setLiveError(error.body?.error === 'game_locked' ? 'locked'
          : error.status === 409 ? 'started'
          : error.status === 410 ? 'ended'
          : 'not_found');
      });
    return () => { cancelled = true; };
  }, [pin, sessionId, quizId]);
  if (pin) {
    if (liveError) return <JoinError kind={liveError} />;
    if (!liveQuiz) return <main className="loading" aria-busy="true"><h1>Joining live session<Bounce /></h1></main>;
    return <JoinQuiz key={quizId} quiz={liveQuiz} live />;
  }
  if (UI.look?.live && UI.look.quizId === quizId && UI.liveQuiz?.id === quizId) {
    return <JoinQuiz key={quizId} quiz={UI.liveQuiz} live />;
  }
  const quiz = quizById(quizId);
  if (!quiz) return <Navigate to="/" replace />;
  return <JoinQuiz key={quizId} quiz={quiz} live={false} />;
}
/* /live — join the game this device is hosting */
function LiveRoute() {
  useAppState();
  if (!hosted()) return <Navigate to="/" replace />;
  if (G.liveHost) return <Navigate to={`/host/${G.quiz.id}`} replace />;
  return <JoinQuiz key={'live:' + G.quiz.id} quiz={G.quiz} live />;
}
/* /host/:quizId — the host's big screen. Opening it starts a new game (admins only). */
function HostRoute() {
  useAppState();
  const { quizId } = useParams();
  const quiz = quizById(quizId);
  const running = hosted() && G.quiz.id === quizId;
  const [missing, setMissing] = useState(null);
  /* opened directly (refresh, bookmark): fetch the quiz from the server first */
  useEffect(() => {
    if (!quiz && !running && isAdmin()) ensureQuiz(quizId).then((q) => { if (!q) setMissing(quizId); });
  }, [quizId, quiz, running]);
  useEffect(() => {
    if (!(hosted() && G.quiz.id === quizId) && quiz && isAdmin()) {
      startHost(quiz, { live: true });
      const g = G;
      resumeLiveHost(quizId).then((resumed) => {
        if (resumed || G !== g) return;
        return apiRequest('/api/v1/sessions', {
          method: 'POST',
          body: JSON.stringify({ quizId }),
        }).then((session) => {
          if (G !== g) return;
          G.backendSessionId = session.id;
          G.pin = session.pin;
          rememberHostSession(quizId, session.id);
          connectLiveHost(session.id);
          notify();
        });
      }).catch((error) => {
        toast(error.status === 400
          ? 'This quiz is not published or has no questions.'
          : 'Could not create the live session.');
      });
    }
  }, [quizId, quiz]);
  if (running) return <HostGame />;
  if (quiz && isAdmin()) return null;
  if (isAdmin() && missing !== quizId) return <Loading />;
  return <Navigate to={isAdmin() ? '/admin' : '/'} replace />;
}
/* /admin/* — needs the admin password */
function AdminGate({ children }) {
  useAppState();
  return isAdmin() ? children : <AdminLogin />;
}
/* one element for /admin/new and /admin/edit/:quizId, so saving a new quiz
   (which swaps the URL) keeps the editor and your cursor in place */
function EditorRoute() {
  useAppState();
  const { quizId } = useParams();
  const quiz = quizId ? quizById(quizId) : null;
  const [missing, setMissing] = useState(null);
  /* opened directly (refresh, bookmark): fetch the quiz from the server */
  useEffect(() => {
    if (quizId && !quiz) ensureQuiz(quizId).then((q) => { if (!q) setMissing(quizId); });
  }, [quizId, quiz]);
  if (!quizId) return <CreateQuiz />;
  if (quiz) return <CreateQuiz quiz={quiz} />;
  if (missing === quizId) return <Navigate to="/admin" replace />;
  return <Loading />;
}

function App() {
  const location = useLocation();
  const [booted, setBooted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setBooted(true), 1400); return () => clearTimeout(t); }, []);
  /* a refreshed phone on /lobby or /play rejoins its live game */
  useEffect(() => {
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    if (first === 'lobby' || first === 'play') resumeLivePlayer();
  }, []);
  useEffect(() => installSpiderDrag(), []);

  /* leaving the player screen ends a practice game; every page starts at the top */
  useEffect(() => {
    const first = location.pathname.split('/').filter(Boolean)[0];
    if (G && G.mode === 'player' && first !== 'play' && !(G.live && first === 'lobby')) { leaveLive(); stopGame(); }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!booted) return <Loading />;

  return <ErrorBoundary resetKey={location.pathname}>
    <Routes>
      {/* Player routes */}
      <Route path="/" element={<Home />} />
      <Route path="/join/:quizId" element={<JoinRoute />} />
      <Route path="/live" element={<LiveRoute />} />
      <Route path="/lobby" element={<PlayerLobby />} />
      <Route path="/play" element={<PlayerGame />} />

      {/* Audience screen: public, read-only, follows the live game */}
      <Route path="/screen" element={<ScreenPage />} />

      {/* Host + admin routes */}
      <Route path="/host/:quizId" element={<HostRoute />} />
      <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
      <Route path="/admin/new" element={<AdminGate><EditorRoute /></AdminGate>} />
      <Route path="/admin/edit/:quizId" element={<AdminGate><EditorRoute /></AdminGate>} />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <LivePill />
  </ErrorBoundary>;
}

export default App;
