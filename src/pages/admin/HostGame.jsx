/* The big screen the host shows at the event: /host/:quizId */
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { LETTERS, TEAMS, ansCls, css, pinFmt } from '../../lib/constants';
import { qType } from '../../lib/questions';
import { G, curQ, endGame, exitGame, skip, startGame, toggleLock } from '../../lib/engine';
import { toast, useAnims } from '../../lib/ui';
import { Answered, ColorBar, Count, Ico, LiveRing, Modal, Secs } from '../../components/common/UI';
import { QKindChip, AnswersBlock, FinalBlock, HostAnswerArea, LbBlock, PodiumBlock, TeamsBlock } from '../../components/game/Blocks';
import { HostShell } from '../../components/layout/Shells';

function PChip({ p }) {
  const t = TEAMS[p.team];
  return <span className="pchip" style={{ '--soft': t.soft, '--txt': t.txt }}><img className="avatar" src={p.img} alt="" style={{ '--team': t.solid, borderWidth: 2 }} />{p.name}{p.id === 'me' ? ' (you)' : ''}</span>;
}
function Swatches({ labels }) {
  return <div className="swatches" aria-hidden="true">{labels.map((l, i) => <span key={i} className={ansCls(i)}>{l}</span>)}</div>;
}
const bigRing = <LiveRing size={220} stroke={17} color="#1a73e8"><span style={{ fontSize: 112, color: '#1a73e8' }}><Count /></span></LiveRing>;

function HostGame() {
  const navigate = useNavigate();
  const [askExit, setAskExit] = useState(false);
  useAnims(`${G.phase}:${G.qi}`);

  const n = G.qs.length, qq = curQ();
  const pinChip = <span className="chip chip-blue">Game PIN {pinFmt(G.pin)}</span>;
  const over = <span className="chip">Game over · {n} of {n} questions</span>;
  const shell = (right, children, main) => <HostShell right={right} main={main} onExit={() => setAskExit(true)}>{children}</HostShell>;

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
        <div><div className="eyebrow">GDG KAUHOOT · Lobby</div><h1 style={{ fontSize: 48, marginTop: 6 }}>{G.quiz.title}</h1></div>
        <div className="lobby">
          <div className="card pinbox">
            <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css('font-size:14px;color:var(--muted)')}>Join on your phone at</span><span className="joinat">{window.location.host}</span></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css('font-size:14px;font-weight:500;color:var(--muted)')}>Game PIN</span><span className="pinbig num">{pinFmt(G.pin)}</span></div>
            <ColorBar gaps />
            <div className="qr">
              <span className="code" role="img" aria-label="QR code to join this game"><QRCodeSVG value={`${window.location.origin}/?pin=${G.pin}`} size={124} level="M" /></span>
              <span style={css('font-size:14px;line-height:1.6;color:var(--muted)')}>Scan to join instantly, then pick a nickname.</span>
            </div>
            {G.me ? <p style={css('margin:0;font-size:14px;color:var(--green-txt);font-weight:600')}>You joined as {G.me.name}.</p> : <Link className="btn btn-tonal" to="/live">Join as a player on this device</Link>}
          </div>
          <div className="card players">
            <div style={css('display:flex;justify-content:space-between;align-items:center')}><h2 style={{ margin: 0 }}>Players</h2><span className="chip chip-blue"><Ico n="users" />{cnt} joined</span></div>
            <div className="pchips" aria-live="polite">{cnt ? G.players.map((p) => <PChip key={p.id} p={p} />) : <span style={{ color: 'var(--muted)' }}>Waiting for players to join…</span>}</div>
            <div className="lobby-actions" style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:16px')}>
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
      view = shell(<><span className="chip">Question {G.qi + 1} of {n}</span>{pinChip}</>, <AnswersBlock />);
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
        <div className="card qcard"><QKindChip qq={qq} />{qq.points === 2 && <span className="chip chip-red">Double points</span>}<h1>{qq.text}</h1>{qq.img && ['mc', 'tf'].includes(qType(qq)) && <img className="qimg" src={qq.img} alt="" />}</div>
        <div className="qbar">
          <div className="tring" style={css('display:flex;align-items:center;gap:16px')}><LiveRing size={104} stroke={10} color="#1a73e8"><span style={{ fontSize: 38 }}><Secs /></span></LiveRing><span className="tlabel" style={{ color: 'var(--muted)', fontSize: 15 }}>seconds left{qType(qq) === 'pic' ? ` · ${qq.word.replace(/[^A-Za-z0-9]/g, '').length} letters` : ''}</span></div>
          <div className="qbar-r" style={css('display:flex;align-items:center;gap:14px')}>
            <span className="ans-in" style={css('display:flex;flex-direction:column;align-items:flex-end')}><span><b className="num"><Answered /></b><span className="of num"> / {G.players.length}</span></span><span style={css('font-size:14px;color:var(--muted)')}>answers in</span></span>
            <button type="button" className="btn btn-tonal" onClick={skip}>Skip</button>
          </div>
        </div>
        <HostAnswerArea qq={qq} />
      </>);
      break;
    case 'leaderboard': view = shell(<span className="chip">After question {G.qi + 1} of {n}</span>, <LbBlock />, 'wide'); break;
    case 'teams': view = shell(over, <TeamsBlock />, 'mid'); break;
    case 'podium': view = shell(over, <PodiumBlock />, 'narrow'); break;
    case 'final': view = shell(over, <FinalBlock action={<button type="button" className="btn btn-primary" onClick={() => { endGame(); navigate('/admin'); }}>End game</button>} />); break;
    default: view = null;
  }
  return <>{view}{exitModal}</>;
}

export default HostGame;
