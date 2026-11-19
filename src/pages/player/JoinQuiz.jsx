/* "Choose your look": nickname + mascot, then join. Used for /join/:quizId and /live (the hosted game). */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NICK_A, NICK_B, TEAMS, css, mascot, pick, pinFmt, rnd } from '../../lib/constants';
import { G, UI, joinGame } from '../../lib/engine';
import { toast, useWide } from '../../lib/ui';
import { Ico } from '../../components/common/UI';
import { MascotGrid, TeamTabs } from '../../components/player/AvatarPicker';
import { LapShell } from '../../components/layout/Shells';
import { apiRequest } from '../../api/client';
import { connectSocket } from '../../api/socket';

function JoinQuiz({ quiz, live }) {
  const navigate = useNavigate();
  const wide = useWide();
  const key = (live ? 'live:' : '') + quiz.id;
  const [look, setLookState] = useState(() => {
    if (!UI.look || UI.look.key !== key) UI.look = { key, quizId: quiz.id, live, name: UI.look ? UI.look.name : '', team: 'blue', idx: 0 };
    return UI.look;
  });
  const setLook = (patch) => { const n = { ...look, ...patch }; UI.look = n; setLookState(n); };
  const T = TEAMS[look.team];
  const pin = live ? G.pin : quiz.pin;

  const join = async (e) => {
    if (e) e.preventDefault();
    if (!live) {
      toast('Open this quiz from a live host session PIN.');
      return;
    }
    const name = (look.name || '').trim();
    if (!name) { toast('Pick a nickname first.'); document.getElementById('nickIn')?.focus(); return; }
    try {
      const participant = await apiRequest('/api/v1/sessions/join', {
        method: 'POST',
        body: JSON.stringify({
          pin,
          name,
          mascot: `${look.team}-${look.idx}`,
          team: look.team,
        }),
      });
      localStorage.setItem('gdgParticipantId', participant.id);
      localStorage.setItem('gdgSessionId', participant.sessionId);
      UI.look = { ...look, participantId: participant.id, sessionId: participant.sessionId };
      const socket = connectSocket();
      socket.emit('game:join', participant.sessionId, participant.id, () => {});
      UI.liveSocket = socket;
    } catch (error) {
      toast(error.status === 409
        ? 'That nickname is already in this session. Choose another.'
        : error.status === 404
          ? 'This live session no longer exists.'
          : 'Could not join the live session.');
      return;
    }
    const err = joinGame(look, quiz);
    if (err) { toast(err); return; }
    navigate('/play');
  };

  const nick = (
    <label className="field"><span>Nickname</span>
      <span style={{ display: 'flex', gap: 10 }}>
        <input className="input" id="nickIn" maxLength={16} autoComplete="off" placeholder="Your nickname" value={look.name} onChange={(e) => setLook({ name: e.target.value })} autoFocus={!('ontouchstart' in window)} />
        <button type="button" className="icon-btn" style={css('width:48px;height:48px;background:var(--blue-soft);border-color:transparent;color:var(--blue-txt)')} onClick={() => setLook({ name: pick(NICK_A) + pick(NICK_B) + Math.floor(rnd(1, 99)) })} aria-label="Random nickname"><Ico n="dice" /></button>
      </span>
    </label>
  );
  const onTeam = (k) => setLook({ team: k });
  const onPick = (i) => setLook({ idx: i });

  if (wide) {
    return (
      <LapShell right={<span className="chip chip-blue">PIN {pinFmt(pin)}</span>}>
        <div><div className="eyebrow">You&apos;re almost in</div><h1 style={{ fontSize: 44, marginTop: 6 }}>Choose your look</h1><p style={css('margin:6px 0 0;color:var(--muted)')}>{quiz.title} · Your mascot shows in the lobby, on the leaderboard and on the podium. Its color is your team.</p></div>
        <form className="look-grid" onSubmit={join} noValidate>
          <div className="card" style={css('padding:28px;display:flex;flex-direction:column;gap:18px;align-items:stretch')}>
            <img className="avatar" src={mascot(look.team, look.idx)} alt="" width="180" height="180" style={{ '--team': T.solid, borderWidth: 6, alignSelf: 'center' }} />
            <span className={`chip chip-${look.team}`} style={{ alignSelf: 'center' }}>{T.name} team</span>
            {nick}
            <button type="submit" className="btn btn-primary btn-lg">Join game <Ico n="arrow" /></button>
          </div>
          <div className="card" style={css('padding:28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={css('display:flex;justify-content:space-between;align-items:baseline')}><b style={{ fontSize: 18 }}>Pick a mascot</b><span style={{ fontSize: 13, color: 'var(--muted)' }}>48 mascots</span></div>
            <TeamTabs team={look.team} onTeam={onTeam} style={{ maxWidth: 520 }} />
            <MascotGrid team={look.team} idx={look.idx} onPick={onPick} six />
          </div>
        </form>
      </LapShell>
    );
  }
  return (
    <div className="pl">
      <main className="pl-in">
        <div className="pl-top"><Link className="icon-btn" to="/" aria-label="Back"><Ico n="back" /></Link><span className="chip chip-blue">PIN {pinFmt(pin)}</span></div>
        <div><div className="eyebrow">You&apos;re almost in</div><h1 style={{ fontSize: 30, marginTop: 6 }}>Choose your look</h1><p style={css('margin:6px 0 0;color:var(--muted)')}>{quiz.title}</p></div>
        <form onSubmit={join} style={css('display:flex;flex-direction:column;gap:18px')} noValidate>
          {nick}
          <div style={css('display:flex;justify-content:space-between;align-items:baseline')}><span className="label">Pick a mascot</span><span style={{ fontSize: 13, color: 'var(--muted)' }}>48 mascots</span></div>
          <TeamTabs team={look.team} onTeam={onTeam} />
          <p style={css('margin:-8px 0 0;font-size:13px;color:var(--muted)')}>Your mascot&apos;s color is your team on the leaderboard.</p>
          <MascotGrid team={look.team} idx={look.idx} onPick={onPick} />
          <button type="submit" className="sr">Join game</button>
        </form>
      </main>
      <footer className="pl-foot"><div className="in">
        <img className="avatar" src={mascot(look.team, look.idx)} alt="" width="52" height="52" style={{ '--team': T.solid }} />
        <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => join()}>Join game</button>
      </div></footer>
    </div>
  );
}

export default JoinQuiz;
