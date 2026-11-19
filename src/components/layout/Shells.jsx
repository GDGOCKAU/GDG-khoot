/* Page frames: laptop player, phone player, host big screen, admin */
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { css, lsGet, lsSet } from '../../lib/constants';
import { G } from '../../lib/engine';
import { setAdmin } from '../../lib/store';
import { Brand, ColorBar, ThemeButton, Hang, Ico, MePill } from '../common/UI';

export function LapShell({ right, bg, center, children }) {
  return (
    <div className="lap" style={bg ? { '--pbg': bg } : undefined}>
      <div className="orb" aria-hidden="true" style={css('background:#4285f4;top:-160px;right:6%;opacity:.10')} />
      <header className="lap-head"><Link to="/" style={{ textDecoration: 'none' }}><Brand /></Link><div style={css('display:flex;align-items:center;gap:10px')}>{right}<ThemeButton /></div></header>
      <main className={`lap-main${center ? ' lap-center' : ''}`}>{children}</main>
      <ColorBar />
    </div>
  );
}

/* player screen frame: laptop layout when wide, phone layout otherwise */
export function PShell({ wide, bg, center, wideRight, phoneRight, children }) {
  if (wide) return <LapShell right={wideRight ?? <MePill p={G.me} />} bg={bg} center={center}>{children}</LapShell>;
  return (
    <div className="pl" style={bg ? { '--pbg': bg } : undefined}>
      <header className="pl-head"><div className="in"><Brand />{phoneRight ?? <span className="chip">{G.me.name}</span>}</div></header>
      <main className="pl-in">{children}</main>
      <ColorBar />
    </div>
  );
}

export function HostShell({ right, onExit, children }) {
  const done = G.phase === 'final' || G.ended;
  return (
    <div className="host">
      <div className="orb" aria-hidden="true" style={css('background:#4285f4;top:-120px;right:10%')} />
      <div className="orb" aria-hidden="true" style={css('background:#ea4335;bottom:-160px;left:-80px;opacity:.08')} />
      <div className="orb" aria-hidden="true" style={css('background:#34a853;bottom:-160px;right:-120px;opacity:.08')} />
      <header className="host-top"><Brand />
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end')}>
          {right}<ThemeButton />
          {done ? <Link className="btn btn-ghost btn-sm" to="/admin">Dashboard</Link> : <button type="button" className="btn btn-danger btn-sm" onClick={onExit}>Exit game</button>}
        </div>
      </header>
      <main className="host-main">{children}</main>
      <div className="host-bottom" aria-hidden="true">{['#4285f4', '#ea4335', '#f9ab00', '#34a853'].map((c) => <span key={c} style={{ background: c }} />)}</div>
    </div>
  );
}

export function AdminShell({ children }) {
  const navigate = useNavigate();
  const [sideClosed, setSideClosed] = useState(() => lsGet('kauhoot.side') === '1');
  const onToggleSide = () => { const v = !sideClosed; setSideClosed(v); lsSet('kauhoot.side', v ? '1' : '0'); };
  return (
    <div className="adm">
      <aside className={`adm-side${sideClosed ? ' closed' : ''}`}>
        <div className="top">
          <Link to="/admin" style={{ textDecoration: 'none' }} aria-label="GDG KAUHOOT admin"><Brand sub="ADMIN" /></Link>
          <button type="button" className="icon-btn side-tog" onClick={onToggleSide} aria-label={`${sideClosed ? 'Open' : 'Close'} sidebar`} aria-expanded={!sideClosed} title={`${sideClosed ? 'Open' : 'Close'} sidebar`}><Ico n="sidebar" /></button>
        </div>
        <nav aria-label="Admin">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'on' : '')} title="Dashboard"><Ico n="grid" /><span className="lbl">Dashboard</span></NavLink>
          <NavLink to="/admin/new" className={({ isActive }) => (isActive ? 'on' : '')} title="Create quiz"><Ico n="plusc" /><span className="lbl">Create quiz</span></NavLink>
        </nav>
        {!sideClosed && <Hang width={190} style="top:50px;left:-48px;width:190px;height:calc(100vh - 190px);min-height:420px" />}
        <div style={{ flexGrow: 1 }} />
        <div className="sess" style={{ background: 'var(--bg)' }}>
          <span className="lock"><Ico n="lock" /></span>
          <span className="lbl" style={css('flex:1;display:flex;flex-direction:column;line-height:1.3')}><b style={{ fontSize: 14 }}>Admin session</b><button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setAdmin(false); navigate('/'); }}>Sign out</button></span>
          <ThemeButton />
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
