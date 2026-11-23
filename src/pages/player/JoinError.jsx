/* Shown on /join when a PIN or QR link can't open a live game (wrong PIN, started, ended, locked).
   Same look as GameClosed; the button takes the player back to the PIN box on the home page. */
import { useNavigate } from 'react-router-dom';
import { css } from '../../lib/constants';
import { useWide } from '../../lib/ui';
import { Brand, ColorBar, Ico } from '../../components/common/UI';
import { LapShell } from '../../components/layout/Shells';

const COPY = {
  not_found: { title: 'No game with this PIN', text: 'Check the PIN on the big screen and try again. If the host hasn’t opened the lobby yet, wait a moment.', chip: 'Wrong PIN', tone: 'yellow', icon: 'hourglass' },
  started: { title: 'This game has already started', text: 'New players can only join while the host is still in the lobby.', chip: 'Game started', tone: 'red', icon: 'clock' },
  ended: { title: 'This game has ended', text: 'Ask the host for the PIN of the next game.', chip: 'Game over', tone: 'red', icon: 'door' },
  locked: { title: 'The host has locked this game', text: 'No one else can join right now. Ask the host to unlock it.', chip: 'Locked', tone: 'red', icon: 'lock' },
  kicked: { title: 'You were removed from the game', text: 'The host removed you from this game, so you can’t rejoin it. You can still join the next game with its PIN.', chip: 'Removed', tone: 'red', icon: 'door' },
  mismatch: { title: 'This link is for another game', text: 'Enter the PIN shown on the big screen instead.', chip: 'Wrong link', tone: 'yellow', icon: 'x' },
};

function JoinError({ kind }) {
  const wide = useWide();
  const navigate = useNavigate();
  const c = COPY[kind] || COPY.not_found;
  const inner = (
    <div className="center-col">
      <span className="big-ring" style={css(`background:var(--${c.tone}-soft);color:var(--${c.tone}-txt);width:110px;height:110px`)}><Ico n={c.icon} s={52} /></span>
      <h1 style={{ fontSize: wide ? 52 : 34 }}>{c.title}</h1>
      <p style={css('margin:0;color:var(--muted);font-size:17px;max-width:30rem')}>{c.text}</p>
      <div style={css('display:flex;gap:10px;flex-wrap:wrap;justify-content:center')}>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/', { state: { focusPin: true } })}>Enter the PIN again <Ico n="arrow" /></button>
      </div>
    </div>
  );
  if (wide) return <LapShell center>{inner}</LapShell>;
  return (
    <div className="pl">
      <header className="pl-head"><div className="in"><Brand /><span className="chip">{c.chip}</span></div></header>
      <main className="pl-in">{inner}</main>
      <ColorBar />
    </div>
  );
}

export default JoinError;
