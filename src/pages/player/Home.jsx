import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { css } from '../../lib/constants';
import { useAppState } from '../../lib/store';
import { UI } from '../../lib/engine';
import { ColorBar, Hang, Ico, Logo, ThemeButton } from '../../components/common/UI';
import SiteFooter from '../../components/common/SiteFooter';
import { apiRequest } from '../../api/client';
import { syncLiveQuiz } from '../../lib/liveQuiz';

function Home() {
  useAppState();
  const navigate = useNavigate();
  const [pin, setPin] = useState(() => {
    const d = (new URLSearchParams(window.location.search).get('pin') || '').replace(/\D/g, '').slice(0, 6);
    return d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
  });
  const [pinError, setPinError] = useState('');
  const pinRef = useRef(null);
  const location = useLocation();

  /* back from a wrong-PIN page: straight to the PIN box */
  useEffect(() => {
    if (!location.state?.focusPin) return;
    document.getElementById('join')?.scrollIntoView();
    pinRef.current?.focus();
  }, [location.state]);

  const goJoin = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pinRef.current) pinRef.current.focus({ preventScroll: true });
  };

  const onPin = (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d); };
  const submitPin = async (e) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) { setPinError('Enter the 6-digit PIN.'); if (pinRef.current) pinRef.current.focus(); return; }
    /* the server says whether a live game with this PIN is open */
    try {
      const live = await apiRequest(`/api/v1/sessions/by-pin/${p}`);
      syncLiveQuiz(live);
      setPinError('');
      UI.look = { key: 'live:' + live.quiz.id, quizId: live.quiz.id, live: true, sessionId: live.sessionId, pin: p, name: UI.look ? UI.look.name : '', team: 'blue', idx: 0 };
      navigate('/join/' + live.quiz.id);
    } catch (error) {
      setPinError(error.body?.error === 'game_locked' ? 'The host has locked this game.' : error.status === 409
        ? 'This game has already started.'
        : error.status === 410
          ? 'This game has ended.'
          : error.status === 404
            ? 'No game with that PIN. Check the number on the big screen.'
            : 'This game is not accepting players yet.');
    }
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
        <span className="hang-lg"><Hang width={120} style="top:0;left:-3px;width:120px;height:360px" /></span>
        <span className="hang-sm"><Hang width={70} style="top:0;right:6px;width:76px;height:215px" /></span>
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
        <SiteFooter />
      </section>
    </main>
  </div>;
}

export default Home;
