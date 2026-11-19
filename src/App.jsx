import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { G, UI, hosted, startHost, stopGame } from './lib/engine';
import { isAdmin, notify, quizById, useAppState } from './lib/store';
import { installSpiderDrag } from './lib/ui';
import { toast } from './lib/ui';
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
import { apiRequest } from './api/client';
import { syncLiveQuiz } from './lib/liveQuiz';
import { connectSocket } from './api/socket';
import { mascot } from './lib/constants';

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
        if (live.quiz.id !== quizId) { setLiveError('This QR link belongs to another quiz.'); return; }
        if (sessionId && live.sessionId !== sessionId) { setLiveError('This QR link is for a different live session.'); return; }
        setLiveQuiz(syncLiveQuiz(live));
      })
      .catch((error) => {
        if (cancelled) return;
        setLiveError(error.status === 409
          ? 'This game has already started.'
          : error.status === 410
            ? 'This game has ended.'
            : 'No live session with this PIN. Wait until the host opens the lobby.');
      });
    return () => { cancelled = true; };
  }, [pin, sessionId, quizId]);
  if (pin) {
    if (liveError) return <main className="loading" aria-busy="true"><h1>{liveError}</h1></main>;
    if (!liveQuiz) return <main className="loading" aria-busy="true"><h1>Joining live session<Bounce /></h1></main>;
    return <JoinQuiz key={quizId} quiz={liveQuiz} live />;
  }
  if (UI.look?.live && UI.look.quizId === quizId) {
    const liveQuiz = quizById(quizId);
    if (liveQuiz) return <JoinQuiz key={quizId} quiz={liveQuiz} live />;
  }
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
    if (!(hosted() && G.quiz.id === quizId) && quiz && isAdmin()) {
      startHost(quiz);
      apiRequest('/api/v1/sessions', {
        method: 'POST',
        body: JSON.stringify({ quizId }),
      }).then((session) => {
        G.backendSessionId = session.id;
        G.pin = session.pin;
        if (G.joinTimer) clearTimeout(G.joinTimer);
        const socket = connectSocket();
        socket.emit('game:join', session.id, 'host', () => {});
        socket.on('player_joined', ({ participant }) => {
          if (!G || G.phase !== 'lobby') return;
          if (G.players.some((player) => player.id === participant.id)) return;
          G.players.push({
            id: participant.id,
            name: participant.name,
            team: participant.team,
            img: mascot(participant.team, 0),
            bot: false,
            score: 0,
            streak: 0,
            correct: 0,
            last: null,
            prevRank: 0,
          });
          notify();
        });
        notify();
      }).catch((error) => {
        toast(error.status === 400
          ? 'This quiz is not published or has no questions.'
          : 'Could not create the live session.');
      });
    }
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
