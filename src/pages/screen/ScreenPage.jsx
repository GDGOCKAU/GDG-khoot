/* The audience screen: /screen. Public and read-only. It waits until a quiz opens, then follows it
   (lobby with the QR, questions, answers, leaderboard, podium) with no controls. */
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LETTERS, TEAMS, ansCls, css, pinFmt } from '../../lib/constants';
import { qType } from '../../lib/questions';
import { G, curQ } from '../../lib/engine';
import { connectScreen, disconnectScreen } from '../../lib/live';
import { useAppState } from '../../lib/store';
import { useAnims } from '../../lib/ui';
import { Answered, Bounce, Brand, ColorBar, Count, Ico, LiveRing, Secs, ThemeButton } from '../../components/common/UI';
import { QKindChip, AnswersBlock, FinalBlock, HostAnswerArea, LbBlock, PodiumBlock, SuspenseBlock, TeamsBlock } from '../../components/game/Blocks';

const bigRing = <LiveRing size={220} stroke={17} color="#1a73e8"><span style={{ fontSize: 112, color: '#1a73e8' }}><Count /></span></LiveRing>;

function Swatches({ labels }) {
  return <div className="swatches" aria-hidden="true">{labels.map((l, i) => <span key={i} className={ansCls(i)}>{l}</span>)}</div>;
}
function PChip({ p }) {
  const t = TEAMS[p.team];
  return <span className="pchip" style={{ '--soft': t.soft, '--txt': t.txt }}><img className="avatar" src={p.img} alt="" style={{ '--team': t.solid, borderWidth: 2 }} />{p.name}</span>;
}

function FullscreenButton() {
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-pressed={full}>{full ? 'Exit full screen' : 'Full screen'}</button>;
}

function Shell({ right, main = '', children }) {
  return (
    <div className="host screen-mode">
      <div className="orb" aria-hidden="true" style={css('background:#4285f4;top:-120px;right:10%')} />
      <div className="orb" aria-hidden="true" style={css('background:#ea4335;bottom:-160px;left:-80px;opacity:.08')} />
      <div className="orb" aria-hidden="true" style={css('background:#34a853;bottom:-160px;right:-120px;opacity:.08')} />
      <header className="host-top"><Brand />
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end')}>{right}<FullscreenButton /><ThemeButton /></div>
      </header>
      <main className={`host-main screen-main${main ? ' ' + main : ''}`}>{children}</main>
      <div className="host-bottom" aria-hidden="true">{['#4285f4', '#ea4335', '#f9ab00', '#34a853'].map((c) => <span key={c} style={{ background: c }} />)}</div>
    </div>
  );
}

function Waiting() {
  return (
    <Shell>
      <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
        <span className="chip chip-blue">Audience screen</span>
        <h1 className="countdown-h1">Waiting for a quiz<span style={{ color: '#ea4335' }}>…</span></h1>
        <Bounce />
        <p className="countdown-p" style={css('margin:0;color:var(--muted)')}>This screen starts by itself when the host opens a game.</p>
      </div>
    </Shell>
  );
}

function Game() {
  const n = G.qs.length, qq = curQ();
  useAnims(`${G.phase}:${G.qi}:${G.hostRevealIdx === G.qi ? 'counts' : ''}`);
  const pinChip = <span className="chip chip-blue">Game PIN {pinFmt(G.pin)}</span>;
  const over = <span className="chip">Game over · {n} of {n} questions</span>;
  const joinUrl = `${window.location.origin}/join/${G.quiz.id}?pin=${encodeURIComponent(G.pin)}&session=${encodeURIComponent(G.backendSessionId)}`;
  const countdown = (label, big, note, labels) => (
    <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
      <span className="chip">{label}</span>
      <h1 className="countdown-h1">{big}<span style={{ color: '#ea4335' }}>{big.startsWith('Next') ? '!' : '?'}</span></h1>
      <div>{bigRing}</div>
      <p className="countdown-p" style={css('margin:0;color:var(--muted)')}>{note}</p>
      <Swatches labels={labels} />
    </div>
  );

  switch (G.phase) {
    case 'lobby': {
      const cnt = G.players.length;
      return <Shell right={<span className="chip"><i style={css('width:8px;height:8px;border-radius:50%;background:#34a853')} />Live</span>}>
        <div><div className="eyebrow">GDG KAUHOOT · Lobby</div><h1 style={{ fontSize: 48, marginTop: 6 }}>{G.quiz.title}</h1></div>
        <div className="lobby">
          <div className="card pinbox">
            <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css('font-size:14px;color:var(--muted)')}>Join on your device at</span><span className="joinat">{window.location.host}</span></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css('font-size:14px;font-weight:500;color:var(--muted)')}>Game PIN</span><span className="pinbig num">{pinFmt(G.pin)}</span></div>
            <ColorBar gaps />
            <div className="qr">
              <span className="code" role="img" aria-label="QR code to join this game"><QRCodeSVG value={joinUrl} size={160} level="M" /></span>
              <span style={css('font-size:14px;line-height:1.6;color:var(--muted)')}>Scan to join instantly, then pick a nickname.</span>
            </div>
          </div>
          <div className="card players">
            <div style={css('display:flex;justify-content:space-between;align-items:center')}><h2 style={{ margin: 0 }}>Players</h2><span className="chip chip-blue"><Ico n="users" />{cnt} joined</span></div>
            <div className="pchips" aria-live="polite">{cnt ? G.players.map((p) => <PChip key={p.id} p={p} />) : <span style={{ color: 'var(--muted)' }}>Waiting for players to join…</span>}</div>
            <span style={css('color:var(--muted);font-size:14px')}>{G.locked ? 'Game locked. No one else can join.' : cnt ? 'The host starts the game when everyone is in.' : 'Waiting for players to join…'}</span>
          </div>
        </div>
      </Shell>;
    }
    case 'ready': {
      const t1 = qType(G.qs[0] || {});
      return <Shell right={<span className="chip chip-blue">{G.players.length} {G.players.length === 1 ? 'player' : 'players'} ready</span>}>
        {countdown(`QUESTION 1 OF ${n}`, 'Are you ready', 'Phones out, fingers ready. The first question starts in a moment.', t1 === 'tf' ? ['T', 'F'] : t1 === 'pic' ? ['', '', '', ''] : LETTERS)}
      </Shell>;
    }
    case 'next':
      return <Shell right={pinChip}>
        {countdown(`QUESTION ${G.qi + 2} OF ${n}`, 'Next question', `${G.qs[G.qi + 1] && G.qs[G.qi + 1].points === 2 ? 'Double points on this one! ' : ''}Eyes on the screen, fingers ready.`, LETTERS)}
      </Shell>;
    case 'question':
      if (!qq) return null;
      return <Shell right={<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>}>
        <div className="card qcard"><QKindChip qq={qq} />{qq.points === 2 && <span className="chip chip-red">Double points</span>}<h1>{qq.text}</h1>{qq.img && ['mc', 'tf'].includes(qType(qq)) && <img className="qimg" src={qq.img} alt="" />}</div>
        <div className="qbar">
          <div className="tring" style={css('display:flex;align-items:center;gap:16px')}><LiveRing size={104} stroke={10} color="#1a73e8"><span style={{ fontSize: 38 }}><Secs /></span></LiveRing><span className="tlabel" style={{ color: 'var(--muted)', fontSize: 15 }}>seconds left{qType(qq) === 'pic' ? ` · ${qq.word.replace(/[^A-Za-z0-9]/g, '').length} letters` : ''}</span></div>
          <div className="qbar-r" style={css('display:flex;align-items:center;gap:14px')}>
            <span className="ans-in" style={css('display:flex;flex-direction:column;align-items:flex-end')}><span><b className="num"><Answered /></b><span className="of num"> / {G.players.length}</span></span><span style={css('font-size:14px;color:var(--muted)')}>answers in</span></span>
          </div>
        </div>
        <HostAnswerArea qq={qq} />
      </Shell>;
    case 'reveal':
      return <Shell right={<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>}><AnswersBlock /></Shell>;
    case 'leaderboard': return <Shell right={<span className="chip">After question {G.qi + 1} of {n}</span>} main="wide"><LbBlock /></Shell>;
    case 'suspense': return <Shell right={<span className="chip">After question {G.qi + 1} of {n}</span>}><SuspenseBlock /></Shell>;
    case 'teams': return <Shell right={over} main="mid"><TeamsBlock /></Shell>;
    case 'podium': return <Shell right={over} main="narrow"><PodiumBlock /></Shell>;
    case 'final': return <Shell right={over}><FinalBlock /></Shell>;
    default: return <Waiting />;
  }
}

export default function ScreenPage() {
  useAppState();
  useEffect(() => { connectScreen(); return () => disconnectScreen(); }, []);
  return G && G.mode === 'screen' ? <Game /> : <Waiting />;
}
