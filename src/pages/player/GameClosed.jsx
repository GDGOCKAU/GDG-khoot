/* Shown on the player screen after the host exits a game early */
import { useNavigate } from 'react-router-dom';
import { css } from '../../lib/constants';
import { UI } from '../../lib/engine';
import { notify } from '../../lib/store';
import { useWide } from '../../lib/ui';
import { Brand, ColorBar, Ico } from '../../components/common/UI';
import { LapShell } from '../../components/layout/Shells';

function GameClosed() {
  const wide = useWide();
  const navigate = useNavigate();
  const c = UI.closed;
  const inner = (
    <div className="center-col">
      <span className="big-ring" style={css('background:var(--red-soft);color:var(--red-txt);width:110px;height:110px')}><Ico n="door" s={52} /></span>
      <h1 style={{ fontSize: wide ? 52 : 34 }}>The host has closed the game</h1>
      <p style={css('margin:0;color:var(--muted);font-size:17px;max-width:30rem')}>&quot;{c.title}&quot; ended before the finish. Thanks for playing, {c.name}! Your points from this game weren&apos;t saved.</p>
      <div style={css('display:flex;gap:10px;flex-wrap:wrap;justify-content:center')}>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => { UI.closed = null; notify(); navigate('/'); }}>Back to home</button>
      </div>
    </div>
  );
  if (wide) return <LapShell center>{inner}</LapShell>;
  return (
    <div className="pl">
      <header className="pl-head"><div className="in"><Brand /><span className="chip">Game closed</span></div></header>
      <main className="pl-in">{inner}</main>
      <ColorBar />
    </div>
  );
}

export default GameClosed;
