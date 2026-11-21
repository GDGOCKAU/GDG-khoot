/* Small building blocks used on every screen */
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ICONS, LOGO_SRC } from '../../lib/icons';
import { TEAMS, TOPICS, SPIDER, css, pinFmt } from '../../lib/constants';
import { isDark, toggleTheme } from '../../lib/theme';
import { G, UI, hosted, liveTime, useTick } from '../../lib/engine';
import { useAppState } from '../../lib/store';

/* an SVG icon from ICONS, optionally resized */
export function Ico({ n, s }) {
  let svg = ICONS[n] || '';
  if (s) svg = svg.replace(/width="\d+" height="\d+"/, `width="${s}" height="${s}"`);
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
export function Logo() { return <img className="gdg-logo" src={LOGO_SRC} alt="GDG logo" />; }

export function Brand({ sub }) {
  return <span className="brand"><Logo /><span>GDG KAU<b>HOOT</b>{sub ? <small>{sub}</small> : null}</span></span>;
}
const G4 = ['#4285f4', '#ea4335', '#f9ab00', '#34a853'];
export function ColorBar({ h = 4, gaps }) {
  return <div className={`colorbar${gaps ? ' gaps' : ''}`} style={{ height: h }}>{G4.map((c) => <span key={c} style={{ background: c }} />)}</div>;
}
export function Dots() { return <span className="dots-g" aria-hidden="true">{G4.map((c) => <i key={c} style={{ background: c }} />)}</span>; }
export function Bounce() { return <span className="bounce" aria-hidden="true">{G4.map((c) => <i key={c} style={{ background: c }} />)}</span>; }
export function Dot({ c }) { return <span style={{ color: c }}>.</span>; }

export function ThemeButton() {
  useAppState();
  return isDark()
    ? <button type="button" className="icon-btn sun" onClick={toggleTheme} aria-label="Switch to light mode" title="Switch to light mode"><Ico n="sun" /></button>
    : <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Switch to dark mode" title="Switch to dark mode"><Ico n="moon" /></button>;
}

export function Ring({ size, stroke, frac, color, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <span className="ring-wrap" style={{ width: size, height: size }}>
      {/* the circles are turned inside the SVG (not the SVG itself with CSS): iPad Safari drew a box around a CSS-rotated SVG */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
        </g>
      </svg>
      <span className="n num">{children}</span>
    </span>
  );
}

/* live timer widgets: they re-render 10× a second, nothing else does */
export function Secs() { useTick(); return <>{liveTime().secs}</>; }
export function Count() { useTick(); return <>{Math.max(1, liveTime().secs)}</>; }
export function Answered() { useTick(); return <>{G ? Object.keys(G.answers).length : 0}</>; }
export function LiveBar({ style }) { useTick(); return <i style={{ ...style, width: (100 * liveTime().frac) + '%' }} />; }
export function LiveRing(props) { useTick(); return <Ring {...props} frac={liveTime().frac} />; }

/* the hanging spider mascot (drag it!) */
export function Hang({ width, style }) {
  return (
    <div className="hang" aria-hidden="true" style={css(style)}>
      <div className="drop"><div className="bob"><span className="thread" />
        <img className="spider" src={SPIDER} alt="" title="Drag me" draggable="false" style={{ width }} onError={(e) => { e.currentTarget.closest('.hang').style.display = 'none'; }} />
      </div></div>
    </div>
  );
}

export function TopicIcon({ t }) { return <Ico n={(TOPICS[t] || TOPICS.Other).icon} />; }
export function TopicChip({ t }) { return <span className={`chip chip-${(TOPICS[t] || TOPICS.Other).c}`}>{t}</span>; }

export function Avatar({ p, size, bw, style, className = '' }) {
  const t = TEAMS[p.team];
  return <img className={`avatar ${className}`.trim()} src={p.img} alt="" width={size} height={size} style={{ '--team': t.solid, ...(bw ? { borderWidth: bw } : {}), ...style }} />;
}
export function MePill({ p }) {
  const t = TEAMS[p.team];
  return <span className="me-pill" style={{ '--soft': t.soft, '--txt': t.txt }}><Avatar p={p} bw={2} />{p.name}</span>;
}
export function You() { return <> <span className="you">You</span></>; }

const PHASE_LABEL = { lobby: 'In the lobby', ready: 'Starting', question: 'Question live', reveal: 'Showing answers', answers: 'Showing answers', next: 'Next question', leaderboard: 'Leaderboard', teams: 'Team results', podium: 'Top 3', final: 'Final leaderboard' };

/* floating pill that links the host screen and the player screen */
export function LivePill() {
  useAppState();
  const loc = useLocation();
  const navigate = useNavigate();
  const r = loc.pathname.split('/').filter(Boolean)[0] || '';
  if (!G && UI.closed && r !== 'play') {
    return <div className="live-pill" role="region" aria-label="Closed game"><span className="live-dot" aria-hidden="true" style={{ animation: 'none', background: 'var(--muted)', boxShadow: 'none' }} /><span><b>Game closed</b> · {UI.closed.title}</span><Link className="btn btn-primary btn-sm" to="/play">See the player screen <Ico n="arrow" /></Link></div>;
  }
  if (!hosted()) return null;
  if (G.ended) {
    if (r === 'play') return null;
    return <div className="live-pill" role="region" aria-label="Finished game"><span><b>Game over</b> · {G.quiz.title}</span><button type="button" className="btn btn-primary btn-sm" onClick={() => { UI.showOver = true; UI.overTab = null; navigate('/play'); }}>Share my results <Ico n="arrow" /></button></div>;
  }
  /* the host lobby already has its own "Join as a player" button */
  if (r === 'host' && G.phase === 'lobby' && !G.me) return null;
  let label, btn;
  if (r === 'host') {
    label = <b>You&apos;re the host</b>;
    btn = G.me ? <Link className="btn btn-primary btn-sm" to="/play">My player screen <Ico n="arrow" /></Link> : (G.phase === 'final' ? null : <Link className="btn btn-primary btn-sm" to="/live">Join as a player <Ico n="arrow" /></Link>);
  } else if (r === 'play' && G.me) {
    label = <b>Playing as {G.me.name}</b>;
    btn = <Link className="btn btn-primary btn-sm" to={`/host/${G.quiz.id}`}>Host screen <Ico n="arrow" /></Link>;
  } else {
    label = <><b>Live game</b> · PIN {pinFmt(G.pin)} · <span>{PHASE_LABEL[G.phase] || ''}</span></>;
    btn = <><Link className="btn btn-outline btn-sm" to={`/host/${G.quiz.id}`}>Host screen</Link>{G.me ? <Link className="btn btn-primary btn-sm" to="/play">My player screen</Link> : <Link className="btn btn-primary btn-sm" to="/live">Join</Link>}</>;
  }
  return <div className="live-pill" role="region" aria-label="Live game"><span className="live-dot" aria-hidden="true" /><span>{label}</span>{btn}</div>;
}

/* confirm dialog shell */
export function Modal({ id, icon, title, children, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <span className="sess" style={{ border: 0, padding: 0, margin: 0 }}><span className="lock" style={{ background: 'var(--red-soft)', color: 'var(--red-txt)', width: 48, height: 48 }}><Ico n={icon} /></span></span>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
