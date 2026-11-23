/* The big screen the host shows at the event: /host/:quizId */
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { LETTERS, TEAMS, ansCls, css, pinFmt } from '../../lib/constants';
import { qType } from '../../lib/questions';
import { G, curQ, endGame, exitGame, skip, hostNext, startGame, toggleLock, waitsForHost, live } from '../../lib/engine';
import { toast, useAnims } from '../../lib/ui';
import { Answered, ColorBar, Count, Ico, LiveRing, Modal, Secs } from '../../components/common/UI';
import { QKindChip, qSize, AnswersBlock, FinalBlock, HostAnswerArea, LbBlock, PodiumBlock, SuspenseBlock, TeamsBlock } from '../../components/game/Blocks';
import { HostShell } from '../../components/layout/Shells';
import { setSettings } from '../../lib/live';
import ScreenLinkButton from '../../components/common/ScreenLinkButton';
import PlayerChips from '../../components/game/PlayerChips';

function PChip({ p, onRemove }) {
  const t = TEAMS[p.team];
  return <span className="pchip" style={{ '--soft': t.soft, '--txt': t.txt }}><img className="avatar" src={p.img} alt="" style={{ '--team': t.solid, borderWidth: 2 }} />{p.name}{p.id === 'me' ? ' (you)' : ''}
    {onRemove && <button type="button" className="pchip-x" onClick={onRemove} aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`}><Ico n="x" s={14} /></button>}</span>;
}
/* during the game: everyone in it, each with Remove */
function PlayersPanel({ onRemove, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const list = G.players.filter((p) => p.id !== 'me');
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="plT" style={{ width: 'min(520px, 100%)', maxHeight: '80vh' }}>
        <div className="imp-head"><h2 id="plT" style={{ margin: 0 }}>Players <span className="chip chip-blue" style={{ verticalAlign: 'middle' }}>{list.length}</span></h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Ico n="x" /></button></div>
        <ul className="kick-list">
          {list.length ? list.map((p) => {
            const t = TEAMS[p.team];
            return <li key={p.id}><img className="avatar" src={p.img} alt="" width="36" height="36" style={{ '--team': t.solid, borderWidth: 2 }} /><span className="kick-name">{p.name}</span><span className={`chip chip-${p.team}`}>Team {t.name}</span><button type="button" className="btn btn-danger btn-sm" onClick={() => onRemove(p)}>Remove</button></li>;
          }) : <li style={{ color: 'var(--muted)' }}>No players in the game.</li>}
        </ul>
      </div>
    </div>
  );
}
function Swatches({ labels }) {
  return <div className="swatches" aria-hidden="true">{labels.map((l, i) => <span key={i} className={ansCls(i)}>{l}</span>)}</div>;
}
const bigRing = <LiveRing size={220} stroke={17} color="#1a73e8"><span style={{ fontSize: 112, color: '#1a73e8' }}><Count /></span></LiveRing>;

function HostGame() {
  const navigate = useNavigate();
  const [askExit, setAskExit] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [showPlayers, setShowPlayers] = useState(false);
  useAnims(`${G.phase}:${G.qi}:${G.liveHost && G.hostRevealIdx === G.qi ? 'counts' : ''}`);
  /* auto-advance off: → or PageDown (what presentation clickers send) works like the Next button */
  useEffect(() => {
    const onKey = (e) => {
      if (askExit || !G || !G.liveHost || !waitsForHost() || e.repeat) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); hostNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [askExit]);

  const n = G.qs.length, qq = curQ();
  const pinChip = <span className="chip chip-blue">Game PIN {pinFmt(G.pin)}</span>;
  const over = <span className="chip">Game over · {n} of {n} questions</span>;
  /* in a live game the host can open the player list (to remove someone) from any in-game screen */
  const inGame = G.liveHost && !['lobby', 'teams', 'podium', 'final'].includes(G.phase);
  const playersBtn = inGame && <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPlayers(true)}><Ico n="users" s={16} />Players</button>;
  const shell = (right, children, main) => <HostShell right={<>{right}{playersBtn}</>} main={main} onExit={() => setAskExit(true)}>{children}</HostShell>;
  const kickModal = kickTarget && (
    <Modal id="kickT" icon="door" title={`Remove ${kickTarget.name} from the game?`} onClose={() => setKickTarget(null)}>
      <p>{kickTarget.name} leaves right away and can&apos;t rejoin this game from the same device. Their answers and points are removed from the results.</p>
      <div style={css('display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap')}>
        <button type="button" className="btn btn-outline" onClick={() => setKickTarget(null)} autoFocus>Cancel</button>
        <button type="button" className="btn btn-danger-solid" onClick={() => { const p = kickTarget; setKickTarget(null); setShowPlayers(false); if (live.kick) live.kick(p.id).then((ok) => { if (ok) toast(`${p.name} was removed from the game.`); }); }}>Remove player</button>
      </div>
    </Modal>
  );
  const joinUrl = `${window.location.origin}/join/${G.quiz.id}?pin=${encodeURIComponent(G.pin)}${G.backendSessionId ? `&session=${encodeURIComponent(G.backendSessionId)}` : ''}`;

  const exitModal = askExit && (
    <Modal id="exitT" icon="door" title="Are you sure you want to exit the game?" onClose={() => setAskExit(false)}>
      <p>{G.phase === 'lobby' ? 'The game hasn\'t started yet. Everyone in the lobby will be sent out.' : 'The game ends for everyone right away. Players will see that the host closed the game, and this game won\'t count in your stats.'}</p>
      <div style={css('display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap')}>
        <button type="button" className="btn btn-outline" onClick={() => setAskExit(false)} autoFocus>Keep playing</button>
        <button type="button" className="btn btn-danger-solid" onClick={() => { const hadMe = exitGame(); navigate('/admin'); toast(hadMe ? 'Game closed. Players now see that the host closed the game.' : 'Game closed.'); }}>Exit game</button>
      </div>
    </Modal>
  );

  let view;
  switch (G.phase) {
    case 'lobby': {
      const cnt = G.players.length;
      view = shell(<><span className="chip"><i style={css('width:8px;height:8px;border-radius:50%;background:#34a853')} />Host view</span><ScreenLinkButton className="btn btn-outline btn-sm" /></>, <>
        <div><div className="eyebrow">GDG KAUHOOT · Lobby</div><h1 style={{ fontSize: 48, marginTop: 6 }}>{G.quiz.title}</h1></div>
        <div className="lobby">
          <div className="card pinbox">
            <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css('font-size:14px;color:var(--muted)')}>Join on your device at</span><span className="joinat">{window.location.host}</span></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css('font-size:14px;font-weight:500;color:var(--muted)')}>Game PIN</span><span className="pinbig num">{pinFmt(G.pin)}</span></div>
            <ColorBar gaps />
            <div className="qr">
              <span className="code" role="img" aria-label="QR code to join this game"><QRCodeSVG value={joinUrl} size={124} level="M" /></span>
              <span style={css('font-size:14px;line-height:1.6;color:var(--muted)')}>Scan to join instantly, then pick a nickname.</span>
            </div>
            {G.liveHost ? null : G.me ? <p style={css('margin:0;font-size:14px;color:var(--green-txt);font-weight:600')}>You joined as {G.me.name}.</p> : <Link className="btn btn-tonal" to="/live">Join as a player on this device</Link>}
          </div>
          <div className="card players">
            <div style={css('display:flex;justify-content:space-between;align-items:center')}><h2 style={{ margin: 0 }}>Players</h2><span className="chip chip-blue"><Ico n="users" />{cnt} joined</span></div>
            <PlayerChips players={G.players} renderChip={(p) => <PChip key={p.id} p={p} onRemove={G.liveHost && p.id !== 'me' ? () => setKickTarget(p) : null} />} empty={<span style={{ color: 'var(--muted)' }}>Waiting for players to join…</span>} />
            <div className="lobby-actions" style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:16px')}>
              <span style={css('color:var(--muted);font-size:14px;flex:1')}>{G.locked ? 'Game locked. No one else can join.' : cnt ? 'Start when everyone is in.' : 'Waiting for players to join…'}</span>
              <button type="button" className="btn btn-outline btn-sm btn-outline-red" onClick={() => setAskExit(true)}>Cancel game</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={toggleLock} aria-pressed={G.locked}><Ico n="lock" />{G.locked ? 'Unlock game' : 'Lock game'}</button>
              {G.liveHost && <button type="button" className="btn btn-outline btn-sm" onClick={() => setSettings({ powerUps: !G.powerUps })} aria-pressed={!!G.powerUps}><Ico n="star" />{G.powerUps ? 'Power-ups on' : 'Power-ups off'}</button>}
              <button type="button" className="btn btn-primary" onClick={startGame} disabled={!cnt}>Start game <Ico n="arrow" /></button>
            </div>
          </div>
        </div>
      </>, 'lobby-main');
      break;
    }
    case 'ready': {
      const t1 = qType(G.qs[0]);
      view = shell(<span className="chip chip-blue">{G.players.length} {G.players.length === 1 ? 'player' : 'players'} ready</span>,
        <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
          <span className="chip">QUESTION 1 OF {n}</span>
          <h1 className="countdown-h1">Are you ready<span style={{ color: '#ea4335' }}>?</span></h1>
          <div>{bigRing}</div>
          <p className="countdown-p" style={css('margin:0;color:var(--muted)')}>Phones out, fingers ready. The first question starts in a moment.</p>
          <Swatches labels={t1 === 'tf' ? ['T', 'F'] : t1 === 'pic' ? ['', '', '', ''] : LETTERS} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ textDecoration: 'underline', fontSize: 14 }} onClick={skip}>Skip countdown</button>
        </div>);
      break;
    }
    case 'reveal':
      view = shell(<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>, <AnswersBlock />, 'fit');
      break;
    case 'next':
      view = shell(pinChip,
        <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
          <span className="chip">QUESTION {G.qi + 2} OF {n}</span>
          <h1 className="countdown-h1">Next question<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{bigRing}</div>
          <p className="countdown-p" style={css('margin:0;color:var(--muted)')}>{G.qs[G.qi + 1].points === 2 ? 'Double points on this one! ' : ''}Eyes on the screen, fingers ready.</p>
          <Swatches labels={LETTERS} />
        </div>);
      break;
    case 'question':
      view = shell(<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>, <>
        <div className="card qcard"><QKindChip qq={qq} />{qq.points === 2 && <span className="chip chip-red">Double points</span>}<h1 className={qSize(qq.text)} dir="auto">{qq.text}</h1>{qq.img && ['mc', 'tf'].includes(qType(qq)) && <img className="qimg" src={qq.img} alt="" />}</div>
        <div className="qbar">
          <div className="tring" style={css('display:flex;align-items:center;gap:16px')}><LiveRing size={104} stroke={10} color="#1a73e8"><span style={{ fontSize: 38 }}><Secs /></span></LiveRing><span className="tlabel" style={{ color: 'var(--muted)', fontSize: 15 }}>seconds left{qType(qq) === 'pic' ? ` · ${qq.word.replace(/[^A-Za-z0-9]/g, '').length} letters` : ''}</span></div>
          <div className="qbar-r" style={css('display:flex;align-items:center;gap:14px')}>
            <span className="ans-in" style={css('display:flex;flex-direction:column;align-items:flex-end')}><span><b className="num"><Answered /></b><span className="of num"> / {G.players.length}</span></span><span style={css('font-size:14px;color:var(--muted)')}>answers in</span></span>
            <button type="button" className="btn btn-tonal" onClick={skip}>Skip</button>
          </div>
        </div>
        <HostAnswerArea qq={qq} />
      </>, 'fit');
      break;
    case 'leaderboard': view = shell(<span className="chip">After question {G.qi + 1} of {n}</span>, <LbBlock />, 'wide'); break;
    case 'suspense': view = shell(<span className="chip">After question {G.qi + 1} of {n}</span>, <SuspenseBlock />); break;
    case 'teams': view = shell(over, <TeamsBlock />, 'mid'); break;
    case 'podium': view = shell(over, <PodiumBlock />, 'narrow'); break;
    case 'final': view = shell(over, <FinalBlock action={<button type="button" className="btn btn-primary" onClick={() => { endGame(); navigate('/admin'); }}>End game</button>} />); break;
    default: view = null;
  }
  return <>{view}{exitModal}{showPlayers && !kickTarget && <PlayersPanel onRemove={(p) => setKickTarget(p)} onClose={() => setShowPlayers(false)} />}{kickModal}</>;
}

export default HostGame;
