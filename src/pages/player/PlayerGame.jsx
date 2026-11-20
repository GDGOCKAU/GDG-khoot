/* The player's screen for every phase of a game: /play */
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TEAMS, css, fmt, ord } from '../../lib/constants';
import { qType, norm } from '../../lib/questions';
import { G, UI, answer, curQ, hosted, rankOf } from '../../lib/engine';
import { notify, useAppState } from '../../lib/store';
import { toast, useAnims, useWide } from '../../lib/ui';
import { Bounce, Ico, LiveBar, LiveRing, MePill, Secs, Count, Answered } from '../../components/common/UI';
import { AnswersBlock, Boxes, ChosenPill, FinalBlock, LbBlock, PlayerAnswerArea, PodiumBlock, TeamsBlock } from '../../components/game/Blocks';
import { LapShell, PShell } from '../../components/layout/Shells';
import { CodeSnack, PokeDevu } from '../../components/player/WaitFun';
import GameOver from './GameOver';
import GameClosed from './GameClosed';
import { activatePowerUp } from '../../lib/live';

function PlayerGame() {
  useAppState();
  /* live game: nothing to play until the server has sent a question */
  if (G && G.live && G.me && G.phase === 'lobby') return <Navigate to="/lobby" replace />;
  if (G && G.me) return <PlayerView />;
  if (UI.closed) return <GameClosed />;
  return <Navigate to="/" replace />;
}

function PlayerView() {
  const wide = useWide();
  /* typed word and code toggle belong to one question */
  const [typedS, setTypedS] = useState({ qi: -1, v: '' });
  const [codeS, setCodeS] = useState({ qi: -1, v: undefined });
  const typed = typedS.qi === G.qi ? typedS.v : '';
  const showCode = codeS.qi === G.qi ? codeS.v : undefined;
  const setTyped = (v) => setTypedS({ qi: G.qi, v });
  const setShowCode = (v) => setCodeS({ qi: G.qi, v });
  const qKey = `${G.phase}:${G.qi}`;
  useAnims(UI.showOver ? 'over' : qKey);

  const submitPic = () => {
    const qq = curQ(), len = norm(qq.word).length;
    if (!typed) { toast('Type your answer first.'); document.getElementById('picIn')?.focus(); return; }
    if (typed.length < len) { toast(`Fill all ${len} boxes.`); document.getElementById('picIn')?.focus(); return; }
    answer('me', typed);
  };

  /* keys 1–4 (or A–D, T/F) answer; typing jumps to the word boxes */
  useEffect(() => {
    const k = (e) => {
      if (!G || !G.me || G.phase !== 'question' || G.answers.me || e.target.closest('input,textarea,select')) return;
      const qq = curQ(), t = qType(qq);
      if (t === 'pic') { if (/^[a-z0-9]$/i.test(e.key)) document.getElementById('picIn')?.focus(); return; }
      const m = (t === 'tf' ? { 1: 0, 2: 1, t: 0, f: 1 } : { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 })[e.key.toLowerCase()];
      if (m !== undefined && (qq.answers[m] || '').trim() && !(G.removed || []).includes(qq.optionIds?.[m])) answer('me', m);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  /* the final leaderboard moves on to "my result" after 7 s (once) */
  useEffect(() => {
    if (G.phase !== 'final' || G.autoOver || UI.showOver) return undefined;
    const g = G;
    const t = setTimeout(() => { if (G === g && G.phase === 'final') { G.autoOver = true; UI.showOver = true; UI.overTab = null; notify(); } }, 7000);
    return () => clearTimeout(t);
  }, [qKey]);

  if (UI.showOver) return <GameOver />;

  const me = G.me, qq = curQ(), n = G.qs.length;
  /* 50/50: the options the server removed simply don't render, like empty answer slots */
  const removed = G.live ? (G.removed || []) : [];
  const qqView = qq && removed.length ? { ...qq, answers: qq.answers.map((a, i) => (removed.includes(qq.optionIds?.[i]) ? '' : a)) } : qq;
  const powers = G.live && G.power && G.power.enabled && G.phase === 'question' && !G.answers.me ? <PowerUps qq={qq} /> : null;
  const qLabel = qq ? `Question ${G.qi + 1} of ${n}` : '';
  const T = TEAMS[me.team];
  const av = (size, extra) => <span style={{ position: 'relative', display: 'inline-flex' }}><img className="avatar" src={me.img} alt="" width={size} height={size} style={{ '--team': T.solid, borderWidth: size > 100 ? 7 : 4 }} />{extra}</span>;
  const ringCount = <LiveRing size={wide ? 150 : 140} stroke={12} color="#1a73e8"><span style={{ fontSize: wide ? 72 : 60, color: '#1a73e8' }}><Count /></span></LiveRing>;
  const shell = (children, opts = {}) => <PShell wide={wide} {...opts}>{children}</PShell>;
  /* centred state screens on a laptop: narrow column with a soft glow behind the mascot */
  const stateOpts = (glow, extra = {}) => ({ center: true, main: 'state', glow: wide ? glow : undefined, ...extra });

  switch (G.phase) {
    case 'lobby':
      return shell(
        <div className="center-col">
          {av(wide ? 170 : 140)}
          <h1 style={{ fontSize: wide ? 60 : 38 }}>You&apos;re in<span style={{ color: '#34a853' }}>!</span></h1>
          <p style={css('margin:0;color:var(--muted);font-size:18px;max-width:30rem')}>Your nickname is on the host screen. Waiting for the host to start the game<Bounce /></p>
          <span className={`chip chip-${me.team}`}>Team {T.name}</span>
          <Link className="btn btn-outline" to={`/host/${G.quiz.id}`}>Open the host screen to start</Link>
        </div>, stateOpts(TEAMS[me.team].bright));
    case 'ready':
      return shell(
        <div className="center-col">
          <span className="chip">Question 1 of {n}</span>
          {av(wide ? 170 : 110)}
          <h1 style={{ fontSize: wide ? 64 : 40 }}>Get ready<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{ringCount}</div>
          <p style={css('margin:0;color:var(--muted)')} className={wide ? 'lead18' : ''}>{wide ? 'Look at the big screen. Your answer buttons appear here in a moment. Keys 1–4 work too.' : 'Your answer buttons appear here in a moment.'}</p>
        </div>, stateOpts('#4285f4'));
    case 'question': {
      if (!G.answers.me) {
        const T2 = qType(qq), qimg = qq.img && (T2 === 'mc' || T2 === 'tf');
        const tip = T2 === 'pic' ? 'Tip: just start typing, Enter submits' : T2 === 'tf' ? 'Tip: press 1 for True, 2 for False' : 'Tip: press 1, 2, 3 or 4 to answer';
        const area = <PlayerAnswerArea qq={qqView} wide={wide} typed={typed} onType={setTyped} onSubmitPic={submitPic} onAnswer={(i) => answer('me', i)} showCode={showCode ?? !hosted()} onToggleCode={() => setShowCode(!(showCode ?? !hosted()))} />;
        if (wide) {
          return (
            <LapShell right={<MePill p={me} />} main="q">
              <div style={css('display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px')}><span className="chip" style={css('font-size:14px;padding:8px 16px')}>{qLabel}</span><span style={css('display:flex;align-items:center;gap:12px')}><span className="tbar"><LiveBar /></span><b className="num" style={{ fontSize: 22 }}><Secs />s</b></span></div>
              <div className="card lap-q" style={css('text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px')}><h1>{qq.text}</h1>{qimg && <img src={qq.img} alt="" style={css('max-height:180px;max-width:100%;border-radius:1rem')} />}</div>
              {powers}
              {area}
              <div style={css('display:flex;justify-content:space-between;color:var(--muted);font-size:14px')}><span>{tip}</span><b className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(me.score)} pts</b></div>
            </LapShell>
          );
        }
        return (
          <div className="pq">
            <div className="pq-top"><span className="chip" style={css('font-size:13px;padding:6px 14px')}>Q{G.qi + 1} of {n}</span><span className="chip chip-blue" style={css('font-size:13px;padding:6px 14px')}><Ico n="clock" s={14} /><span><Secs />s</span></span></div>
            <p className="pq-text">{qq.text}</p>
            <main className="pq-main">
              {qimg && <img src={qq.img} alt="" style={css('max-height:160px;max-width:100%;border-radius:1rem;align-self:center')} />}
              {powers}
              {area}
            </main>
            <footer className="pq-foot"><span>{me.name}</span><span className="num" style={{ fontWeight: 700 }}>{fmt(me.score)} pts</span></footer>
          </div>
        );
      }
      const a = G.answers.me;
      return shell(
        <div className="center-col">
          <span className="chip">{qLabel}</span>
          <PokeDevu me={me} team={T} size={wide ? 170 : 130} />
          <ChosenPill qq={qq} choice={a.choice} big={wide} />
          <CodeSnack />
          <p style={css('margin:0;color:var(--muted)')} className={wide ? 'lead18' : ''}>{G.live ? <>Waiting for the others…{G.power && G.power.doubleActive ? ' Double points is on.' : ''}</> : <>Waiting for the others… <b style={{ color: 'var(--ink)' }}><Answered /></b> / {G.players.length} answered</>}</p>
          <div style={css('display:flex;align-items:center;gap:12px')}><div className="tbar"><LiveBar /></div><span className="num" style={css('color:var(--muted);font-size:16px;font-weight:600')}><Secs />s</span></div>
          <p style={css('margin:0;font-size:15px;color:var(--muted)')}>{wide ? 'Look at the big screen. The answer shows when time is up.' : 'The answer shows when time is up.'}</p>
        </div>, stateOpts(TEAMS[me.team].bright));
    }
    case 'reveal': {
      const L = me.last || { ok: false, choice: null, pts: 0 }, ok = L.ok, timeUp = !ok && L.choice === null;
      const col = ok ? '#188038' : timeUp ? '#f9ab00' : '#d93025';
      const s = wide ? 60 : 44;
      const badge = <span className="state-badge" style={{ width: s, height: s, background: col, color: timeUp ? '#1f2328' : '#fff', bottom: wide ? 6 : -6 }}><Ico n={ok ? 'check' : timeUp ? 'hourglass' : 'x'} s={wide ? 30 : 22} /></span>;
      return shell(
        <div className="center-col">
          <span className="chip">{qLabel}</span>
          {av(wide ? 180 : 130, badge)}
          <h1 style={{ fontSize: wide ? 64 : 42, color: ok ? 'var(--green-txt)' : timeUp ? 'var(--yellow-txt)' : 'var(--red-txt)' }}>{ok ? 'Correct!' : timeUp ? "Time's up!" : 'Not quite!'}</h1>
          {timeUp && <p style={css('margin:-8px 0 0;color:var(--muted)')}>No answer this time. Be quicker on the next one!</p>}
          {ok
            ? <div style={css('display:flex;flex-wrap:wrap;gap:10px;justify-content:center')}><span className="pts-pill num">+{fmt(L.pts)} points</span>{L.doubled && <span className="pts-pill" style={css('font-size:16px;display:flex;align-items:center;gap:6px;color:var(--blue-txt)')}><Ico n="star" />Double points</span>}{me.streak > 1 && <span className="pts-pill" style={css('font-size:16px;display:flex;align-items:center;gap:6px;color:var(--green-txt)')}><Ico n="flame" />Streak: {me.streak}</span>}</div>
            : <><span style={{ color: 'var(--muted)' }}>The answer was</span>{qType(qq) === 'pic' ? <div className="boxes reveal"><Boxes word={qq.word} mode="reveal" /></div> : <ChosenPill qq={qq} choice={qq.correct} />}</>}
          <div className={`stat-card${wide ? ' big' : ''}`} style={{ width: 'min(380px,100%)', ...(wide ? { width: '100%' } : {}) }}><div style={{ textAlign: 'left' }}><small>Your rank</small><strong>{ord(rankOf(me))} place</strong></div><div style={{ textAlign: 'right' }}><small>Total</small><strong className="num">{fmt(me.score)}</strong></div></div>
          <p style={css('margin:0;font-size:13px;color:var(--muted)')}>{wide ? 'Look at the big screen for the leaderboard.' : <>{hosted() || G.live ? 'Answers on the host screen · leaderboard' : 'Answer results'} in <Secs />s</>}</p>
        </div>, stateOpts(ok ? '#34a853' : timeUp ? '#f9ab00' : '#ea4335', { bg: ok ? 'var(--green-soft)' : timeUp ? 'var(--yellow-soft)' : 'var(--red-soft)' }));
    }
    case 'answers':
      return shell(<AnswersBlock />, { phoneRight: <span className="chip">Q{G.qi + 1} of {n}</span> });
    case 'next':
      return shell(
        <div className="center-col">
          <span className="chip">Question {G.qi + 2} of {n}</span>
          {av(wide ? 170 : 100)}
          <h1 style={{ fontSize: wide ? 64 : 40 }}>Next question<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{ringCount}</div>
          <p style={css('margin:0;color:var(--muted)')}>You&apos;re {ord(rankOf(me))} with {fmt(me.score)} points. Get ready!</p>
        </div>, stateOpts('#4285f4'));
    case 'leaderboard':
      return shell(<LbBlock forPlayer />, { phoneRight: <span className="chip">After Q{G.qi + 1} of {n}</span> });
    case 'teams':
      return shell(<TeamsBlock />, { phoneRight: <span className="chip">Game over</span> });
    case 'podium':
      return shell(<PodiumBlock />, { phoneRight: <span className="chip">Game over</span> });
    case 'final':
      return shell(<FinalBlock action={<button type="button" className="btn btn-primary btn-lg" onClick={() => { G.autoOver = true; UI.showOver = true; UI.overTab = null; notify(); }}>Share my results <Ico n="arrow" /></button>} />, { phoneRight: <span className="chip">Game over</span> });
    default:
      return null;
  }
}

/* /lobby — a live player waits here. It moves to /play only when the server opens a question. */
export function PlayerLobby() {
  useAppState();
  const wide = useWide();
  useAnims('lobby');
  if (!G || !G.live || !G.me) return UI.closed ? <GameClosed /> : <Navigate to="/" replace />;
  if (G.phase !== 'lobby') return <Navigate to="/play" replace />;
  const me = G.me, T = TEAMS[me.team];
  return (
    <PShell wide={wide} center main="state" glow={wide ? T.bright : undefined}>
      <div className="center-col">
        <img className="avatar" src={me.img} alt="" width={wide ? 170 : 140} height={wide ? 170 : 140} style={{ '--team': T.solid, borderWidth: 7 }} />
        <h1 style={{ fontSize: wide ? 60 : 38 }}>You&apos;re in<span style={{ color: '#34a853' }}>!</span></h1>
        <p style={css('margin:0;color:var(--muted);font-size:18px;max-width:30rem')}>Your nickname is on the host screen. Waiting for the host to start the game<Bounce /></p>
        <span className={`chip chip-${me.team}`}>Team {T.name}</span>
      </div>
    </PShell>
  );
}

/* live power-ups (only when the host switched them on): each one once per game, checked on the server */
function PowerUps({ qq }) {
  const p = G.power || {};
  return (
    <div className="powerups" role="group" aria-label="Power-ups" style={css('display:flex;gap:10px;justify-content:center;flex-wrap:wrap')}>
      <button type="button" className={`btn btn-sm ${p.doubleActive ? 'btn-primary' : 'btn-tonal'}`} disabled={!!p.doubleUsed || qq.points === 0} aria-pressed={!!p.doubleActive} onClick={() => activatePowerUp('double')}><Ico n="star" s={16} />{p.doubleActive ? 'Double points on' : 'Double points'}</button>
      {qType(qq) === 'mc' && <button type="button" className="btn btn-sm btn-tonal" disabled={!!p.fiftyUsed} onClick={() => activatePowerUp('fifty')}>50/50</button>}
    </div>
  );
}

export default PlayerGame;
