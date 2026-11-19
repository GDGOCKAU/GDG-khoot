/* The player's screen for every phase of a game: /play */
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TEAMS, css, fmt, ord } from '../../lib/constants';
import { qType, norm } from '../../lib/questions';
import { G, UI, answer, curQ, hosted, rankOf } from '../../lib/engine';
import { notify, useAppState } from '../../lib/store';
import { toast, useAnims, useWide } from '../../lib/ui';
import { Bounce, Brand, Ico, LiveBar, LiveRing, MePill, Secs, Count, Answered } from '../../components/common/UI';
import { AnswersBlock, Boxes, ChosenPill, FinalBlock, LbBlock, PlayerAnswerArea, PodiumBlock, TeamsBlock } from '../../components/game/Blocks';
import { LapShell, PShell } from '../../components/layout/Shells';
import GameOver from './GameOver';
import GameClosed from './GameClosed';

function PlayerGame() {
  useAppState();
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
      if (m !== undefined && (qq.answers[m] || '').trim()) answer('me', m);
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
  const qLabel = qq ? `Question ${G.qi + 1} of ${n}` : '';
  const T = TEAMS[me.team];
  const av = (size, extra) => <span style={{ position: 'relative', display: 'inline-flex' }}><img className="avatar" src={me.img} alt="" width={size} height={size} style={{ '--team': T.solid, borderWidth: size > 100 ? 6 : 4 }} />{extra}</span>;
  const ringCount = <LiveRing size={wide ? 170 : 140} stroke={12} color="#1a73e8"><span style={{ fontSize: wide ? 72 : 60, color: '#1a73e8' }}><Count /></span></LiveRing>;
  const shell = (children, opts = {}) => <PShell wide={wide} {...opts}>{children}</PShell>;

  switch (G.phase) {
    case 'lobby':
      return shell(
        <div className="center-col">
          {av(wide ? 170 : 140)}
          <h1 style={{ fontSize: wide ? 52 : 38 }}>You&apos;re in<span style={{ color: '#34a853' }}>!</span></h1>
          <p style={css('margin:0;color:var(--muted);font-size:18px;max-width:30rem')}>Your nickname is on the host screen. Waiting for the host to start the game<Bounce /></p>
          <span className={`chip chip-${me.team}`}>Team {T.name}</span>
          <Link className="btn btn-outline" to={`/host/${G.quiz.id}`}>Open the host screen to start</Link>
        </div>, { center: true });
    case 'ready':
      return shell(
        <div className="center-col">
          <span className="chip">Question 1 of {n}</span>
          {av(wide ? 150 : 110)}
          <h1 style={{ fontSize: wide ? 64 : 40 }}>Get ready<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{ringCount}</div>
          <p style={css('margin:0;color:var(--muted)')}>Your answer buttons appear here in a moment.{wide ? ' Keys 1–4 work too.' : ''}</p>
        </div>, { bg: 'var(--bg)', center: true });
    case 'question': {
      if (!G.answers.me) {
        const T2 = qType(qq), qimg = qq.img && (T2 === 'mc' || T2 === 'tf');
        const tip = T2 === 'pic' ? 'Tip: just start typing, Enter submits' : T2 === 'tf' ? 'Tip: press 1 for True, 2 for False' : 'Tip: press 1, 2, 3 or 4 to answer';
        const area = <PlayerAnswerArea qq={qq} wide={wide} typed={typed} onType={setTyped} onSubmitPic={submitPic} onAnswer={(i) => answer('me', i)} showCode={showCode ?? !hosted()} onToggleCode={() => setShowCode(!(showCode ?? !hosted()))} />;
        if (wide) {
          return (
            <LapShell right={<MePill p={me} />}>
              <div style={css('display:flex;justify-content:space-between;align-items:center;gap:16px')}><span className="chip">{qLabel}</span><span style={css('display:flex;align-items:center;gap:12px;width:260px')}><span className="bar"><LiveBar /></span><b className="num" style={{ fontSize: 22 }}><Secs />s</b></span></div>
              <div className="card" style={css('padding:28px 32px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px')}><h1 style={{ fontSize: 'clamp(28px,3vw,40px)' }}>{qq.text}</h1>{qimg && <img src={qq.img} alt="" style={css('max-height:180px;max-width:100%;border-radius:1rem')} />}</div>
              {area}
              <div style={css('display:flex;justify-content:space-between;color:var(--muted);font-size:14px')}><span>{tip}</span><b className="num" style={{ color: 'var(--ink)' }}>{fmt(me.score)} pts</b></div>
            </LapShell>
          );
        }
        return (
          <div className="pl">
            <header className="pl-head"><div className="in"><Brand /><span className="chip">Q{G.qi + 1} of {n}</span></div></header>
            <main className="pl-in">
              <div className="pl-top" style={{ minHeight: 0 }}><span style={{ fontSize: 14, color: 'var(--muted)' }}>{T2 === 'pic' ? 'Guess the word' : T2 === 'tf' ? 'True or false?' : 'Pick an answer'}</span><span className="chip chip-blue"><Ico n="clock" /><span><Secs />s</span></span></div>
              <h1 style={css('font-size:22px;line-height:1.35;font-weight:600')}>{qq.text}</h1>
              {qimg && <img src={qq.img} alt="" style={css('max-height:160px;max-width:100%;border-radius:1rem;align-self:center')} />}
              <div className="bar" style={{ height: 6 }}><LiveBar /></div>
              {area}
            </main>
            <footer className="pl-foot"><div className="in"><span>{me.name}</span><span className="num">{fmt(me.score)} pts</span></div></footer>
          </div>
        );
      }
      const a = G.answers.me;
      return shell(
        <div className="center-col">
          <span className="chip">{qLabel}</span>
          {av(wide ? 150 : 130)}
          <h1 style={{ fontSize: wide ? 56 : 40, display: 'flex', alignItems: 'baseline' }}>Waiting<Bounce /></h1>
          <ChosenPill qq={qq} choice={a.choice} />
          <p style={css('margin:0;color:var(--muted)')}>Waiting for the others… <b style={{ color: 'var(--ink)' }}><Answered /></b> / {G.players.length} answered</p>
          <div style={css('display:flex;align-items:center;gap:12px;width:220px')}><div className="bar"><LiveBar /></div><span className="num" style={css('color:var(--muted);font-size:14px')}><Secs />s</span></div>
          <p style={css('margin:0;font-size:13px;color:var(--muted)')}>The answer shows when time is up.</p>
        </div>, { center: true });
    }
    case 'reveal': {
      const L = me.last || { ok: false, choice: null, pts: 0 }, ok = L.ok, timeUp = !ok && L.choice === null;
      const col = ok ? '#188038' : timeUp ? '#f9ab00' : '#d93025';
      const s = wide ? 52 : 44;
      const badge = <span style={{ position: 'absolute', right: -6, bottom: -6, width: s, height: s, borderRadius: '50%', background: col, color: timeUp ? '#1f2328' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid var(--bg)' }}><Ico n={ok ? 'check' : timeUp ? 'hourglass' : 'x'} s={wide ? 26 : 22} /></span>;
      return shell(
        <div className="center-col">
          <span className="chip">{qLabel}</span>
          {av(wide ? 150 : 130, badge)}
          <h1 style={{ fontSize: wide ? 64 : 42, color: ok ? 'var(--green-txt)' : timeUp ? 'var(--yellow-txt)' : 'var(--red-txt)' }}>{ok ? 'Correct!' : timeUp ? "Time's up!" : 'Not quite!'}</h1>
          {timeUp && <p style={css('margin:-8px 0 0;color:var(--muted)')}>No answer this time. Be quicker on the next one!</p>}
          {ok
            ? <div style={css('display:flex;flex-wrap:wrap;gap:10px;justify-content:center')}><span className="pts-pill num">+{fmt(L.pts)} points</span>{me.streak > 1 && <span className="pts-pill" style={css('font-size:16px;display:flex;align-items:center;gap:6px;color:var(--green-txt)')}><Ico n="flame" />Streak: {me.streak}</span>}</div>
            : <><span style={{ color: 'var(--muted)' }}>The answer was</span>{qType(qq) === 'pic' ? <div className="boxes reveal"><Boxes word={qq.word} mode="reveal" /></div> : <ChosenPill qq={qq} choice={qq.correct} />}</>}
          <div className="stat-card" style={{ width: 'min(380px,100%)' }}><div style={{ textAlign: 'left' }}><small>Your rank</small><strong>{ord(rankOf(me))} place</strong></div><div style={{ textAlign: 'right' }}><small>Total</small><strong className="num">{fmt(me.score)}</strong></div></div>
          <p style={css('margin:0;font-size:13px;color:var(--muted)')}>{hosted() ? 'Answers on the host screen · leaderboard' : 'Answer results'} in <Secs />s</p>
        </div>, { bg: ok ? 'var(--green-soft)' : timeUp ? 'var(--yellow-soft)' : 'var(--red-soft)', center: true });
    }
    case 'answers':
      return shell(<AnswersBlock />, { phoneRight: <span className="chip">Q{G.qi + 1} of {n}</span> });
    case 'next':
      return shell(
        <div className="center-col">
          <span className="chip">Question {G.qi + 2} of {n}</span>
          {av(wide ? 130 : 100)}
          <h1 style={{ fontSize: wide ? 64 : 40 }}>Next question<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{ringCount}</div>
          <p style={css('margin:0;color:var(--muted)')}>You&apos;re {ord(rankOf(me))} with {fmt(me.score)} points. Get ready!</p>
        </div>, { bg: 'var(--bg)', center: true });
    case 'leaderboard':
      return shell(<LbBlock forPlayer />, { phoneRight: <span className="chip">After Q{G.qi + 1} of {n}</span> });
    case 'teams':
      return shell(<TeamsBlock />, { phoneRight: <span className="chip">Game over</span> });
    case 'podium':
      return shell(<PodiumBlock />, { phoneRight: <span className="chip">Game over</span> });
    case 'final':
      return shell(<FinalBlock action={<button type="button" className="btn btn-primary btn-lg" onClick={() => { G.autoOver = true; UI.showOver = true; UI.overTab = null; notify(); }}>My result &amp; share <Ico n="arrow" /></button>} />, { phoneRight: <span className="chip">Game over</span> });
    default:
      return null;
  }
}

export default PlayerGame;
