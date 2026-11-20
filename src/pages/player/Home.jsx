import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { css } from '../../lib/constants';
import { DB, ready, useAppState } from '../../lib/store';
import { G, UI, hosted } from '../../lib/engine';
import { ColorBar, Hang, Ico, Logo, ThemeButton } from '../../components/common/UI';
import SiteFooter from '../../components/common/SiteFooter';

function Home() {
  useAppState();
  const navigate = useNavigate();
  const [pin, setPin] = useState(() => {
    const d = (new URLSearchParams(window.location.search).get('pin') || '').replace(/\D/g, '').slice(0, 6);
    return d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
  });
  const [pinError, setPinError] = useState('');
  const pinRef = useRef(null);

  const goJoin = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pinRef.current) pinRef.current.focus({ preventScroll: true });
  };

  const onPin = (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d); };
  const submitPin = (e) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    const qz = DB.quizzes.find((x) => x.pin === p && ready(x));
    if (hosted() && p === G.pin) { setPinError(''); UI.look = null; navigate('/live'); return; }
    if (p.length !== 6) setPinError('Enter the 6-digit PIN.');
    else if (!qz) setPinError('No game with that PIN. Check the number on the big screen.');
    else { setPinError(''); UI.look = null; navigate('/join/' + qz.id); return; }
    if (pinRef.current) pinRef.current.focus();
  };

  return <div className="home-page">
    <header className="site-head"><nav className="site-nav" aria-label="Main">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}><Logo /><span>GDG KAU<b>HOOT</b></span></Link>
      <div className="links">
        <a className="pill on" href="#join" aria-current="true" onClick={goJoin}>Join</a>
        <ThemeButton />
      </div>
    </nav></header>
    <main>
      <section className="hero" id="join">
        <Hang width={120} style="top:0;left:-3px;width:120px;height:360px" />
        <div className="grid-bg" aria-hidden="true" />
        <div className="orb" aria-hidden="true" style={css('background:#4285f4;top:-60px;left:-120px')} />
        <div className="orb" aria-hidden="true" style={css('background:#34a853;bottom:-120px;right:-100px')} />
        <div className="hero-in">
          <div className="hero-text">
            <span className="chip" style={css('align-self:flex-start;letter-spacing:.06em;color:var(--muted)')}><i style={css('width:8px;height:8px;border-radius:50%;background:#34a853;box-shadow:0 0 0 3px var(--green-soft)')} />GOOGLE DEVELOPER GROUPS · KAU</span>
            <h1>Play<span style={{ color: '#4285f4' }}>.</span> Think<span style={{ color: '#ea4335' }}>.</span><br />Learn<span style={{ color: '#f9ab00' }}>.</span></h1>
            <p className="lead">Got what it takes? Jump into a live GDG KAU quiz, race your friends, and learn something new.</p>
            <div className="ticks"><span style={{ '--c': '#4285f4' }}>No account needed</span><span style={{ '--c': '#ea4335' }}>Works on any phone</span><span style={{ '--c': '#34a853' }}>Free for everyone</span></div>
          </div>
          <form className="join-card" onSubmit={submitPin} noValidate>
            <div><h2>Join a game</h2><p style={css('margin:6px 0 0;color:var(--muted);font-size:14px')}>Enter the PIN shown on the big screen.</p></div>
            <label className="field"><span>Game PIN</span><input ref={pinRef} className="input pin num" id="pinIn" inputMode="numeric" autoComplete="off" maxLength={7} placeholder="000 000" aria-describedby="pinErr" value={pin} onChange={onPin} /></label>
            {pinError ? <p className="err" id="pinErr" role="alert">{pinError}</p> : <span id="pinErr" />}
            <button className="btn btn-primary btn-lg" type="submit">Enter game <Ico n="arrow" /></button>
            <ColorBar />
            <p style={css('margin:0;text-align:center;font-size:13px;color:var(--muted)')}>Can't see a PIN? Ask the host to open the game.</p>
          </form>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}

export default Home;
