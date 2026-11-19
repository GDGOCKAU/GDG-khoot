/* The big screen the host shows at the event: /host/:quizId */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LETTERS, TEAMS, ansCls, css, pinFmt } from '../../lib/constants';
import { qType } from '../../lib/questions';
import { G, curQ, endGame, exitGame, skip, startGame, toggleLock } from '../../lib/engine';
import { toast, useAnims } from '../../lib/ui';
import { Answered, ColorBar, Count, Ico, LiveRing, Modal, Secs, TopicChip } from '../../components/common/UI';
import { AnswersBlock, FinalBlock, HostAnswerArea, LbBlock, PodiumBlock, TeamsBlock } from '../../components/game/Blocks';
import { HostShell } from '../../components/layout/Shells';
import { QRCodeSVG } from 'qrcode.react';

function PChip({ p }) {
  const t = TEAMS[p.team];
  return <span className="pchip" style={{ '--soft': t.soft, '--txt': t.txt }}><img className="avatar" src={p.img} alt="" style={{ '--team': t.solid, borderWidth: 2 }} />{p.name}{p.id === 'me' ? ' (you)' : ''}</span>;
}
function Swatches({ labels }) {
  return <div style={{ display: 'flex', gap: 12 }}>{labels.map((l, i) => <span key={i} className={`htile ${ansCls(i)}`} style={css('min-height:0;width:64px;height:64px;padding:0;justify-content:center;font-size:28px')}>{l}</span>)}</div>;
}
const bigRing = <LiveRing size={190} stroke={14} color="#1a73e8"><span style={{ fontSize: 96, color: '#1a73e8' }}><Count /></span></LiveRing>;

function HostGame() {
  const navigate = useNavigate();
  const [askExit, setAskExit] = useState(false);
  useAnims(`${G.phase}:${G.qi}`);

  const n = G.qs.length, qq = curQ();
  const pinChip = <span className="chip chip-blue">Game PIN {pinFmt(G.pin)}</span>;
  const over = <span className="chip">Game over · {n} of {n} questions</span>;
  const shell = (right, children) => <HostShell right={right} onExit={() => setAskExit(true)}>{children}</HostShell>;
  const hostName = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.hostname
    : window.location.hostname;
  const joinUrl = `${window.location.protocol}//${hostName}:${window.location.port || '5173'}/join/${G.quiz.id}?pin=${encodeURIComponent(G.pin)}${G.backendSessionId ? `&session=${encodeURIComponent(G.backendSessionId)}` : ''}`;

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
      view = shell(<span className="chip"><i style={css('width:8px;height:8px;border-radius:50%;background:#34a853')} />Host view</span>, <>
        <div><div className="eyebrow">GDG KAUHOOT · Lobby</div><h1 style={{ fontSize: 'clamp(36px,4vw,56px)', marginTop: 6 }}>{G.quiz.title}</h1></div>
        <div className="lobby">
          <div className="card pinbox">
            <div style={css('font-size:14px;color:var(--muted)')}>Join on the home page with</div>
            <div><div style={css('font-size:14px;color:var(--muted)')}>Game PIN</div><div className="pinbig num">{G.pin.slice(0, 3)}<br />{G.pin.slice(3)}</div></div>
            <QRCodeSVG value={joinUrl} size={160} level="H" includeMargin />
            <p style={css('margin:0;font-size:12px;color:var(--muted);text-align:center')}>{joinUrl}</p>
            <ColorBar />
            {G.me ? <p style={css('margin:0;font-size:14px;color:var(--green-txt);font-weight:600')}>You joined as {G.me.name}.</p> : <Link className="btn btn-tonal" to="/live">Join as a player on this device</Link>}
            <p style={css('margin:0;font-size:13px;color:var(--muted);line-height:1.6')}>Practice players join by themselves in this demo. You can also go to the home page and enter the PIN.</p>
          </div>
          <div className="card players">
            <div style={css('display:flex;justify-content:space-between;align-items:center')}><h2 style={css('margin:0;font-size:22px')}>Players</h2><span className="chip chip-blue"><Ico n="users" />{cnt} joined</span></div>
            <div className="pchips" aria-live="polite">{cnt ? G.players.map((p) => <PChip key={p.id} p={p} />) : <span style={{ color: 'var(--muted)' }}>Waiting for players to join…</span>}</div>
            <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:16px')}>
              <span style={css('color:var(--muted);font-size:14px;flex:1')}>{G.locked ? 'Game locked. No one else can join.' : cnt ? 'Start when everyone is in.' : 'Waiting for players to join…'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAskExit(true)}>Cancel game</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={toggleLock} aria-pressed={G.locked}><Ico n="lock" />{G.locked ? 'Unlock game' : 'Lock game'}</button>
              <button type="button" className="btn btn-primary" onClick={startGame} disabled={!cnt}>Start game <Ico n="arrow" /></button>
            </div>
          </div>
        </div>
      </>);
      break;
    }
    case 'ready': {
      const t1 = qType(G.qs[0]);
      view = shell(<span className="chip chip-blue">{G.players.length} players ready</span>,
        <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
          <span className="chip">QUESTION 1 OF {n}</span>
          <h1 style={{ fontSize: 'clamp(48px,7vw,96px)' }}>Are you ready<span style={{ color: '#ea4335' }}>?</span></h1>
          <div>{bigRing}</div>
          <p style={css('margin:0;font-size:20px;color:var(--muted)')}>Phones out, fingers ready. The first question starts in a moment.</p>
          <Swatches labels={t1 === 'tf' ? ['T', 'F'] : t1 === 'pic' ? ['', '', '', ''] : LETTERS} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ textDecoration: 'underline' }} onClick={skip}>Skip countdown</button>
        </div>);
      break;
    }
    case 'reveal':
      view = shell(<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>, <AnswersBlock />);
      break;
    case 'next':
      view = shell(pinChip,
        <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center')}>
          <span className="chip">QUESTION {G.qi + 2} OF {n}</span>
          <h1 style={{ fontSize: 'clamp(48px,7vw,96px)' }}>Next question<span style={{ color: '#ea4335' }}>!</span></h1>
          <div>{bigRing}</div>
          <p style={css('margin:0;font-size:20px;color:var(--muted)')}>{G.qs[G.qi + 1].points === 2 ? 'Double points on this one! ' : ''}Eyes on the screen, fingers ready.</p>
          <Swatches labels={LETTERS} />
        </div>);
      break;
    case 'question':
      view = shell(<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>, <>
        <div className="card qcard"><TopicChip t={G.quiz.topic} />{qq.points === 2 && <span className="chip chip-red">Double points</span>}<h1>{qq.text}</h1>{qq.img && ['mc', 'tf'].includes(qType(qq)) && <img className="qimg" src={qq.img} alt="" />}</div>
        <div className="qbar">
          <div style={css('display:flex;align-items:center;gap:14px')}><LiveRing size={76} stroke={8} color="#1a73e8"><span style={{ fontSize: 28 }}><Secs /></span></LiveRing><span style={{ color: 'var(--muted)' }}>seconds left</span></div>
          <div style={css('display:flex;align-items:center;gap:14px')}>
            <span style={{ textAlign: 'right' }}><b className="num" style={{ fontSize: 32 }}><Answered /></b><span style={{ color: 'var(--muted)' }}> / {G.players.length}</span><br /><span style={css('font-size:13px;color:var(--muted)')}>answers in</span></span>
            <button type="button" className="btn btn-tonal btn-sm" onClick={skip}>Skip</button>
          </div>
        </div>
        <HostAnswerArea qq={qq} />
      </>);
      break;
    case 'leaderboard': view = shell(<span className="chip">After question {G.qi + 1} of {n}</span>, <LbBlock />); break;
    case 'teams': view = shell(over, <TeamsBlock />); break;
    case 'podium': view = shell(over, <PodiumBlock />); break;
    case 'final': view = shell(over, <FinalBlock action={<button type="button" className="btn btn-primary" onClick={() => { endGame(); navigate('/admin'); }}>End game</button>} />); break;
    default: view = null;
  }
  return <>{view}{exitModal}</>;
}

export default HostGame;
