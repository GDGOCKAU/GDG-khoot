import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TEAMS, TOPICS, css } from '../../lib/constants';
import { DB, ready, topicNames, useAppState } from '../../lib/store';
import { G, UI, hosted } from '../../lib/engine';
import { toast } from '../../lib/ui';
import { ColorBar, Hang, Ico, Logo, ThemeButton, TopicChip, TopicIcon } from '../../components/common/UI';
import SiteFooter from '../../components/common/SiteFooter';
import { apiRequest } from '../../api/client';
import { syncLiveQuiz } from '../../lib/liveQuiz';

const SECTIONS = ['join', 'quizzes', 'how'];

function Home() {
  useAppState();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(UI.homeFilter);
  const [pin, setPin] = useState(() => {
    const d = (new URLSearchParams(window.location.search).get('pin') || '').replace(/\D/g, '').slice(0, 6);
    return d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
  });
  const [pinError, setPinError] = useState('');
  const [active, setActive] = useState('join');
  const holdRef = useRef(0);
  const pinRef = useRef(null);
  const location = useLocation();

  /* back from a wrong-PIN page: straight to the PIN box */
  useEffect(() => {
    if (!location.state?.focusPin) return;
    document.getElementById('join')?.scrollIntoView();
    pinRef.current?.focus();
  }, [location.state]);

  /* scroll spy for the nav pills */
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      if (Date.now() < holdRef.current) return;
      const secs = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
      if (secs.length < 3) return;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 8) { setActive('how'); return; }
      let cur = 'join';
      secs.forEach((el) => { if (el.getBoundingClientRect().top <= innerHeight * 0.4) cur = el.id; });
      setActive(cur);
    };
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; calc(); }); };
    calc();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  const scrollTo = (e, id) => {
    e.preventDefault();
    setActive(id); holdRef.current = Date.now() + 900;
    const t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: 'smooth' });
  };
  const pickFilter = (f) => { UI.homeFilter = f; setFilter(f); document.getElementById('quizzes').scrollIntoView(); };

  const onPin = (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d); };
  const submitPin = async (e) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) { setPinError('Enter the 6-digit PIN.'); if (pinRef.current) pinRef.current.focus(); return; }
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
            ? 'No live session with that PIN. Wait until the host opens the lobby.'
            : 'This game is not accepting players yet.');
    }
    if (pinRef.current) pinRef.current.focus();
  };

  const filters = ['All', ...topicNames()];
  const list = DB.quizzes.filter(ready).filter((x) => filter === 'All' || x.topic === filter);

  return <>
    <header className="site-head"><nav className="site-nav" aria-label="Main">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}><Logo /><span>GDG KAU<b>HOOT</b></span></Link>
      <div className="links">
        {[['join', 'Join'], ['quizzes', 'Quizzes'], ['how', 'How it works']].map(([id, label]) => (
          <a key={id} className={`pill${active === id ? ' on' : ''}`} href={`#${id}`} aria-current={active === id ? 'true' : undefined} onClick={(e) => scrollTo(e, id)}>{label}</a>
        ))}
        <ThemeButton />
        <button type="button" className="btn btn-outline btn-sm" lang="ar" onClick={() => toast('Arabic version is coming soon.')}>عربي</button>
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
          </form>
        </div>
      </section>
      <section style={{ background: 'var(--canvas)' }} id="quizzes"><div className="section">
        <div className="sec-head">
          <div><span className="sec-tag" style={{ '--c': '#ea4335' }}>LEARN SOMETHING NEW</span><h2>Explore quizzes</h2></div>
          <div className="seg filters" role="tablist" aria-label="Filter by topic">
            {filters.map((f) => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => pickFilter(f)}>{f}</button>)}
          </div>
        </div>
        <div className="quiz-grid">
          {list.length ? list.map((x) => {
            const T = TEAMS[(TOPICS[x.topic] || TOPICS.Other).c];
            return (
              <article key={x.id} className="quiz-card" style={{ '--acc': T.bright, '--acc-soft': T.soft, '--acc-txt': T.txt }}>
                <div className="glow" aria-hidden="true" />
                <span className="ico"><TopicIcon t={x.topic} /></span>
                <h3>{x.title}</h3>
                <p>{x.desc || ''}</p>
                <div className="meta"><span className="chip">{x.questions.length} questions</span><TopicChip t={x.topic} /></div>
                <Link className="btn btn-tonal btn-sm play" to={`/join/${x.id}`} onClick={() => { UI.look = null; }}>Play <Ico n="arrow" /></Link>
              </article>
            );
          }) : <div className="empty">No quizzes in this topic yet.</div>}
        </div>
      </div></section>
      <section id="how" style={{ background: 'var(--bg)' }}><div className="section">
        <div className="sec-head"><div><span className="sec-tag" style={{ '--c': '#34a853' }}>HOW IT WORKS</span><h2>Three steps to play</h2></div></div>
        <div className="steps">
          <div className="step" style={{ '--soft': 'var(--blue-soft)', '--txt': 'var(--blue-txt)' }}><b>1</b><h3>Get the PIN</h3><p>The host shows it on the big screen at the event.</p></div>
          <div className="step" style={{ '--soft': 'var(--red-soft)', '--txt': 'var(--red-txt)' }}><b>2</b><h3>Pick a nickname</h3><p>Keep it fun, it shows on the leaderboard.</p></div>
          <div className="step" style={{ '--soft': 'var(--yellow-soft)', '--txt': 'var(--yellow-txt)' }}><b>3</b><h3>Answer fast</h3><p>Right and quick answers earn the most points.</p></div>
        </div>
      </div></section>
    </main>
    <SiteFooter />
  </>;
}

export default Home;
