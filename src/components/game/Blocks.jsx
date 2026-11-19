/* Screens and pieces shared by the host and the player views */
import { TEAMS, TEAM_KEYS, LETTERS, ansCls, mascot, fmt, ord, css } from '../../lib/constants';
import { qType, norm, isCorrect, correctLabel, highlight } from '../../lib/questions';
import { G, curQ, ranked, rankOf, teamStats, hosted } from '../../lib/engine';
import { isWide } from '../../lib/ui';
import { Ico, Logo, Dots, TopicChip, Avatar, You, Secs } from '../common/UI';

const tfIco = (i, s) => <Ico n={i === 0 ? 'check' : 'x'} s={s} />;
const CROWN = <svg aria-hidden="true" width="48" height="34" viewBox="0 0 56 40" fill="#f9ab00" stroke="#1f2328" strokeWidth="2.5" strokeLinejoin="round"><path d="M4 12l12 10L28 4l12 18 12-10-4 24H8z" /></svg>;

/* a count-up number, animated by runAnims() */
function Num({ to, from = 0, delay, dur, className, style }) {
  return <span className={className} style={style} data-count={to} data-start={from} data-delay={delay} data-dur={dur}>{fmt(from)}</span>;
}

/* ---------- question pieces ---------- */
export function CodeBlock({ qq, fs }) {
  const code = qq.code || '', n = code.split('\n').length;
  return (
    <div className="codebox" style={{ '--fs': fs + 'px' }}>
      <div className="codebar"><Dots /><span>{(qq.lang || 'Dart').toUpperCase()}</span></div>
      <div className="codebody">
        <pre className="ln" aria-hidden="true">{Array.from({ length: n }, (_, i) => i + 1).join('\n')}</pre>
        <pre className="src" aria-label={`${qq.lang || 'Code'} code`} dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </div>
    </div>
  );
}
/* letter boxes for picture questions. mode: 'reveal' | 'input' | 'empty' */
export function Boxes({ word, typed = '', mode }) {
  let li = 0;
  return [...String(word || '').toUpperCase()].map((ch, k) => {
    if (!/[A-Z0-9]/.test(ch)) return <span key={k} className="lbox gap" aria-hidden="true" />;
    const i = li++;
    const c = mode === 'reveal' ? ch : mode === 'input' ? (typed[i] || '') : '';
    const attrs = mode === 'input' ? { 'data-on': String(i === typed.length), 'data-filled': String(!!typed[i]) }
      : mode === 'reveal' ? { 'data-filled': 'true', style: { animationDelay: `${i * 90}ms` } } : {};
    return <span key={k} className="lbox" data-n={i % 4} {...attrs}>{c}</span>;
  });
}
export function PicsRow({ qq, size }) {
  const pics = qq.pics || [];
  return (
    <div className="pics" role="img" aria-label={`${pics.length} pictures to combine into one word`}>
      {pics.map((src, i) => [
        i ? <span key={'p' + i} className="pplus" aria-hidden="true"><Ico n="plus" /></span> : null,
        <img key={'i' + i} src={src} alt="" style={{ width: `min(${size}px, ${Math.floor(80 / Math.max(1, pics.length))}vw)`, height: 'auto', aspectRatio: '1' }} />,
      ])}
    </div>
  );
}
export function ChosenPill({ qq, choice, big }) {
  const t = qType(qq);
  if (t === 'pic') return <span className={`chosen c-blue${big ? ' big' : ''}`} style={{ letterSpacing: '.12em' }}>{String(choice).toUpperCase()}</span>;
  return <span className={`chosen ${ansCls(choice)}${t === 'code' ? ' mono' : ''}${big ? ' big' : ''}`}><span className="L">{t === 'tf' ? tfIco(choice, 20) : LETTERS[choice]}</span><span>{qq.answers[choice]}</span></span>;
}

export function PlayerAnswerArea({ qq, wide, typed, onType, onSubmitPic, onAnswer, showCode, onToggleCode }) {
  const t = qType(qq);
  if (t === 'pic') {
    const len = norm(qq.word).length;
    return <>
      <PicsRow qq={qq} size={wide ? 200 : 120} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: wide ? 24 : 20 }}>
        <div className="boxes play" id="picBoxes">
          <Boxes word={qq.word} typed={typed} mode="input" />
          <input id="picIn" className="picin" aria-label="Type your answer" autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={len} value={typed} autoFocus={wide}
            onChange={(e) => onType(norm(e.target.value).slice(0, len))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmitPic(); } }} />
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{len} letters · {wide ? 'type the word, press Enter to submit' : 'tap the boxes to type'}</span>
      </div>
      <button type="button" className="btn btn-primary btn-lg" onClick={onSubmitPic} style={{ alignSelf: 'center', minWidth: 'min(260px,100%)', marginTop: 'auto' }}>Submit answer</button>
    </>;
  }
  const idx = t === 'tf' ? [0, 1] : [0, 1, 2, 3];
  const tiles = idx.map((i) => ((qq.answers[i] || '').trim() ? (
    <button key={i} type="button" className={`tile ${ansCls(i)}${t === 'code' ? ' mono' : ''}`} onClick={() => onAnswer(i)}>
      <span className="L">{t === 'tf' ? tfIco(i, 26) : LETTERS[i]}</span><span>{qq.answers[i]}</span>{wide ? <span className="k" aria-hidden="true">{i + 1}</span> : null}
    </button>
  ) : null));
  return <>
    {t === 'code' && <>
      <div style={{ display: 'flex', justifyContent: wide ? 'center' : 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{hosted() ? 'The code is on the big screen' : 'Read the code, then pick what it prints'}</span>
        <button type="button" className="btn btn-tonal btn-sm" onClick={onToggleCode} aria-expanded={showCode}><span style={{ fontFamily: "'Roboto Mono',ui-monospace,monospace" }}>&lt;/&gt;</span>{showCode ? 'Hide code' : 'Show code'}</button>
      </div>
      {showCode && <CodeBlock qq={qq} fs={wide ? 15 : 12} />}
    </>}
    <div className={`tiles${wide ? ' wide' : ''}${t === 'tf' ? ' tf' : ''}${t === 'code' ? ' code' : ''}`}>{tiles}</div>
  </>;
}

export function HostAnswerArea({ qq }) {
  const t = qType(qq);
  if (t === 'pic') return (
    <div style={css('width:100%;display:flex;flex-direction:column;align-items:center;gap:22px;flex:1;justify-content:center')}>
      <PicsRow qq={qq} size={230} />
      <div className="boxes hbig" style={{ width: '100%' }}><Boxes word={qq.word} mode="empty" /></div>
      <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)' }}>{norm(qq.word).length} letters · type the word on your phone</p>
    </div>
  );
  const idx = t === 'tf' ? [0, 1] : [0, 1, 2, 3];
  return <>
    {t === 'code' && <CodeBlock qq={qq} fs={18} />}
    <div className={`htiles${t === 'code' ? ' code' : ''}`}>
      {idx.map((i) => ((qq.answers[i] || '').trim() ? <div key={i} className={`htile ${ansCls(i)}${t === 'code' ? ' mono' : ''}${t === 'tf' ? ' big' : ''}`}><span className="L">{t === 'tf' ? tfIco(i, 28) : LETTERS[i]}</span><span>{qq.answers[i]}</span></div> : null))}
    </div>
  </>;
}

/* ---------- answer results ---------- */
function QHead({ qq }) {
  return <div className="card qcard res"><TopicChip t={G.quiz.topic} /><h1>{qq.text}</h1></div>;
}
function PicAnswersBlock() {
  const qq = curQ(), total = G.players.length, vals = Object.values(G.answers);
  const right = vals.filter((a) => isCorrect(qq, a.choice)).length, wrong = vals.length - right, none = total - vals.length;
  const max = Math.max(1, right, wrong, none);
  const cols = [[3, 'Got it', right, true, 'check'], [1, 'Wrong guess', wrong, false, 'x'], [2, 'No answer', none, false, 'hourglass']];
  return <>
    <QHead qq={qq} />
    <div style={css('display:flex;flex-direction:column;align-items:center;gap:14px')}><PicsRow qq={qq} size={isWide() ? 110 : 76} /><div className="boxes reveal"><Boxes word={qq.word} mode="reveal" /></div></div>
    <div style={css('display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px')}>
      <span className="chip chip-green res-chip"><b data-count={right} data-start="0" data-delay="1500" data-dur="600">0</b>&nbsp;of {total} guessed it</span>
      <span style={{ color: 'var(--muted)', fontSize: 15 }}>Time&apos;s up · Leaderboard in <Secs />s</span>
    </div>
    <div className="achart" style={{ '--n': 3, minHeight: 220 }}>
      {cols.map(([ci, label, n, ok, ic], k) => (
        <div key={label} className={`acol ${ansCls(ci)} ${ok ? 'right' : 'wrong'}`} style={{ '--d': `${k * 150}ms` }}>
          <Num className="acount num" to={n} delay={200 + k * 150} dur={1100} />
          <div className="atrack"><div className="abar" style={{ '--h': `${Math.max(4, 100 * n / max)}%` }} /></div>
          <div className="alabel"><span className="L"><Ico n={ic} s={18} /></span><span className="t">{label}</span></div>
        </div>
      ))}
    </div>
  </>;
}
export function AnswersBlock() {
  const qq = curQ();
  if (qType(qq) === 'pic') return <PicAnswersBlock />;
  const tf = qType(qq) === 'tf', mono = qType(qq) === 'code' ? ' mono' : '';
  const counts = [0, 1, 2, 3].map((i) => Object.values(G.answers).filter((a) => a.choice === i).length);
  const max = Math.max(1, ...counts);
  const right = counts[qq.correct], total = G.players.length;
  return <>
    <QHead qq={qq} />
    <div style={css('display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px')}>
      <span className="chip chip-green res-chip"><b data-count={right} data-start="0" data-delay="1500" data-dur="600">0</b>&nbsp;of {total} got it right</span>
      <span style={{ color: 'var(--muted)', fontSize: 15 }}>Time&apos;s up · Leaderboard in <Secs />s</span>
    </div>
    <div className="achart" style={{ '--n': qq.answers.filter((a) => a.trim()).length }}>
      {qq.answers.map((a, i) => (a.trim() ? (
        <div key={i} className={`acol ${ansCls(i)} ${i === qq.correct ? 'right' : 'wrong'}`} style={{ '--d': `${i * 150}ms` }}>
          <Num className="acount num" to={counts[i]} delay={200 + i * 150} dur={1100} />
          <div className="atrack"><div className="abar" style={{ '--h': `${Math.max(4, 100 * counts[i] / max)}%` }} /></div>
          <div className={`alabel${mono}`}><span className="L">{tf ? tfIco(i, 18) : LETTERS[i]}</span><span className="t">{a}</span>{i === qq.correct && <span className="ok"><Ico n="check" s={20} /></span>}</div>
        </div>
      ) : null))}
    </div>
  </>;
}

/* ---------- leaderboard ---------- */
function LbRow({ p, i, extra, fl }) {
  const t = TEAMS[p.team];
  const attrs = fl ? { 'data-idx': fl.idx, 'data-from': fl.from, ...(fl.off ? { 'data-off': '1' } : {}) } : {};
  return (
    <div className={`lb-row${p.id === 'me' ? ' me' : ''}${i < 3 ? ' top3' : ''}`} style={{ '--c': t.solid, '--txt': t.txt }} {...attrs}>
      {fl ? <span className="rk" data-rankfrom={fl.fromRank} data-rankto={i + 1}>{i + 1}</span> : <span className="rk">{i + 1}</span>}
      <Avatar p={p} size={44} />
      <span className="nm">{p.name}{p.id === 'me' && <You />}</span>
      <span className={`chip chip-${p.team}`}>{t.name}</span>
      {extra}
      {fl ? <Num className="sc num" to={p.score} from={fl.startScore} delay={1000} /> : <span className="sc num">{fmt(p.score)}</span>}
    </div>
  );
}
function TeamsPanel() {
  const ts = teamStats(), max = Math.max(1, ...ts.map((t) => t.avg));
  const prev = G.prevTeams || {};
  const pmax = Math.max(1, ...Object.values(prev).map((x) => x.avg), max);
  return (
    <aside className="card teams-panel">
      <div style={css('display:flex;justify-content:space-between;align-items:baseline;gap:8px')}><b style={{ fontSize: 18 }}>Team standings</b><span style={{ fontSize: 12, color: 'var(--muted)' }}>avg points per player</span></div>
      <div className="trows" data-flipgroup="" data-delay="1000">
        {ts.map((t, i) => {
          const pv = prev[t.key] || { idx: i, avg: 0 };
          return (
            <div key={t.key} className="trow" data-idx={i} data-from={pv.idx}>
              <div className="t1">
                <span style={{ width: 18, color: 'var(--muted)' }} data-rankfrom={pv.idx + 1} data-rankto={i + 1}>{i + 1}</span>
                <Avatar p={{ team: t.key, img: mascot(t.key, 0) }} bw={2} />
                <span style={{ flex: 1 }}>Team {TEAMS[t.key].name}{G.me && G.me.team === t.key && <You />}</span>
                <Num className="num" to={Math.round(t.avg)} from={Math.round(pv.avg)} delay={1000} />
              </div>
              <div className="bar" style={{ '--c': TEAMS[t.key].solid }}><i data-grow={100 * t.avg / pmax} data-gstart={100 * pv.avg / pmax} style={{ width: `${100 * pv.avg / pmax}%` }} /></div>
              <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{t.count} player{t.count > 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
export function LbBlock({ forPlayer }) {
  const qq = curQ(), all = ranked();
  let rows = all.slice(0, 8);
  if (forPlayer && G.me && !rows.includes(G.me)) rows = rows.slice(0, 7).concat(G.me);
  const last = G.qi >= G.qs.length - 1;
  const prevIdx = G.prevIdx || {};
  return <>
    <div style={{ textAlign: 'center' }}>
      <div className="eyebrow">Correct answer · {correctLabel(qq)}</div>
      <h1 className="lb-title" style={{ marginTop: 6 }}>Leaderboard</h1>
      <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>After question {G.qi + 1} of {G.qs.length} · {last ? 'Team results' : 'Next question'} in <Secs />s</p>
    </div>
    <div className="lb">
      <div className="lb-rows" data-flipgroup="" data-delay="1000">
        {rows.map((p, idx) => {
          const gi = all.indexOf(p), pi = prevIdx[p.id] ?? gi;
          const from = Math.min(pi, rows.length);
          return <LbRow key={p.id} p={p} i={gi} extra={<span className="plus num">{p.last && p.last.pts ? '+' + fmt(p.last.pts) : '+0'}</span>} fl={{ idx, from, off: pi >= rows.length, fromRank: pi + 1, startScore: p.prevScore ?? p.score }} />;
        })}
      </div>
      <TeamsPanel />
    </div>
  </>;
}

/* ---------- end of game ---------- */
export function TeamsBlock() {
  const ts = teamStats(), win = ts[0];
  const shown = TEAM_KEYS.map((k) => ts.find((t) => t.key === k)).filter(Boolean);
  const max = Math.max(1, ...ts.map((t) => t.avg));
  const step = 650, last = (ts.length - 1) * step;
  return <>
    <div style={{ textAlign: 'center' }}><div className="eyebrow" style={{ letterSpacing: '.08em' }}>Team results</div><h1 className="big-title" style={{ marginTop: 6 }}>Team <span style={{ color: TEAMS[win.key].solid }}>{TEAMS[win.key].name}</span> wins<span style={{ color: '#34a853' }}>!</span></h1></div>
    <div className="tgrid" style={{ '--n': shown.length }}>
      {shown.map((t) => {
        const r = ts.indexOf(t), T = TEAMS[t.key], d = (ts.length - 1 - r) * step;
        const h = Math.max(120, Math.round(280 * t.avg / max));
        return (
          <div key={t.key} className={`tcol${t.key === 'yellow' ? ' yel' : ''}${r === 0 ? ' win' : ''}`} style={{ '--c': T.solid, '--d': `${d}ms`, '--cd': `${last + 1100}ms` }}>
            {r === 0 ? <span className="crown">{CROWN}</span> : <span className="spacer" />}
            <Avatar p={{ team: t.key, img: mascot(t.key, 0) }} size={r ? 96 : 120} bw={6} />
            <span className="nm">Team {T.name}</span>
            <span className="pt">{t.count} player{t.count > 1 ? 's' : ''}</span>
            <div className="tblk" style={{ '--h': `${h}px` }}><b>{r + 1}</b><span className="avg num"><Num to={Math.round(t.avg)} delay={d} dur={1200} /> avg</span></div>
          </div>
        );
      })}
    </div>
    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15, textAlign: 'center' }}>Ranked by average points per player, so team size doesn&apos;t matter. Top 3 players next.</p>
  </>;
}
export function PodiumBlock() {
  const top = ranked().slice(0, 3), order = [1, 0, 2].filter((i) => top[i]);
  const H = [270, 200, 150], SZ = [168, 132, 120], BW = [7, 6, 6], D = [1500, 750, 0];
  return <>
    <div style={{ textAlign: 'center' }}><div className="eyebrow" style={{ letterSpacing: '.08em' }}>Final results</div><h1 className="big-title" style={{ marginTop: 6 }}>And the winners are<span style={{ color: '#34a853' }}>…</span></h1></div>
    <div className="tgrid pgrid">
      {order.map((i) => {
        const p = top[i], T = TEAMS[p.team];
        return (
          <div key={p.id} className={`tcol${p.team === 'yellow' ? ' yel' : ''}${i === 0 ? ' win' : ''}${i === 2 ? ' third' : ''}`} style={{ '--c': T.solid, '--d': `${D[i]}ms`, '--cd': '2700ms' }}>
            {i === 0 && <span className="crown">{CROWN}</span>}
            <Avatar p={p} size={SZ[i]} bw={BW[i]} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, maxWidth: '100%' }}>
              <span className="nm" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.id === 'me' && <You />}</span>
              <span className="pt num"><Num to={p.score} delay={D[i]} dur={1200} /> pts</span>
            </span>
            <div className="tblk" style={{ '--h': `${H[i]}px` }}><b>{i + 1}</b><span className="lbl">{ord(i + 1)}</span></div>
          </div>
        );
      })}
    </div>
    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>{G.players.length} players · Full leaderboard next.</p>
  </>;
}
export function FinalBlock({ action }) {
  const n = G.qs.length, all = ranked();
  return <>
    <div style={css('display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px')}>
      <div><div className="eyebrow">Final results · {G.quiz.title}</div><h1 className="lb-title" style={{ marginTop: 6 }}>Final leaderboard<span style={{ color: '#f9ab00' }}>.</span></h1></div>
      {action}
    </div>
    <div className="final-grid" style={{ '--rows': Math.ceil(all.length / 2) }}>
      {all.map((p, i) => {
        const t = TEAMS[p.team];
        return (
          <div key={p.id} className={`lb-row frow${i < 3 ? ' top' : ''}${p.id === 'me' ? ' me' : ''}`} style={{ '--c': t.solid, '--txt': t.txt, '--soft': t.soft, animationDelay: `${i * 50}ms` }}>
            <span className="rk">{i + 1}</span><Avatar p={p} size={48} />
            <span className="nm">{p.name}{p.id === 'me' && <You />}</span>
            <span className="plus" style={{ color: 'var(--muted)' }}>{p.correct}/{n}</span>
            <span className="sc num">{fmt(p.score)}</span>
          </div>
        );
      })}
    </div>
    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>{G.players.length} players · {n} questions · Thanks for playing!</p>
  </>;
}

/* ---------- 9:16 story card preview (designed at 540×960, scaled with cqw) ---------- */
const u = (n) => `${(n / 5.4).toFixed(3)}cqw`;
const SOFT = { blue: '#e8f0fe', red: '#fce8e6', yellow: '#fef7e0', green: '#e6f4ea' };
function StoryHead() {
  return <header style={{ position: 'relative', padding: `${u(40)} ${u(36)} 0`, display: 'flex', alignItems: 'center', gap: u(12) }}>
    <span style={{ display: 'flex', width: u(64), height: u(36), flexShrink: 0 }}><Logo /></span>
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><b style={{ fontSize: u(22) }}>GDG KAU<span style={{ color: '#1a73e8' }}>HOOT</span></b><span style={{ fontSize: u(13), color: '#5f6570' }}>Google Developer Group · KAU</span></span>
  </header>;
}
function StoryFoot({ pad = 24 }) {
  return <>
    <footer style={{ position: 'relative', padding: `${u(pad)} ${u(36)} ${u(24)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: u(13), color: '#5f6570' }}><span>@gdgteam_ · @gdgockau</span><b style={{ color: '#1f2328', fontWeight: 600 }}>gdgkau.com</b></footer>
    <div aria-hidden="true" style={{ display: 'flex', height: u(8) }}>{['#4285f4', '#ea4335', '#f9ab00', '#34a853'].map((c) => <span key={c} style={{ flex: 1, background: c }} />)}</div>
  </>;
}
const blob = (size, bg, pos) => <span aria-hidden="true" style={{ position: 'absolute', width: u(size), height: u(size), borderRadius: '50%', background: bg, ...Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, u(v)])) }} />;
const tag = (text) => <span style={{ alignSelf: 'flex-start', padding: `${u(6)} ${u(14)}`, borderRadius: 100, background: '#fff', border: '1px solid #e3e6eb', fontSize: u(13), fontWeight: 600 }}>{text}</span>;

export function Story({ kind }) {
  const me = G.me, all = ranked(), top = all.slice(0, 3), T = TEAMS[me.team], ts = teamStats(), win = ts[0];
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const base = { position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: '9 / 16', background: '#f8f9fe', color: '#1f2328', display: 'flex', flexDirection: 'column', borderRadius: '1.25rem', border: '1px solid #e3e6eb', boxShadow: '0 24px 48px -12px rgb(16 24 40 / .25)', fontFamily: "'Google Sans', 'Plus Jakarta Sans', system-ui, sans-serif" };
  if (kind === 'me') {
    const teamRank = ts.findIndex((t) => t.key === me.team) + 1;
    const stat = (big, small, extra = {}) => <div style={{ background: '#fff', border: '1px solid #e3e6eb', borderRadius: u(16), padding: `${u(12)} ${u(6)}`, display: 'flex', flexDirection: 'column', gap: u(2), ...extra }}><b style={{ fontSize: u(22), ...(extra.color ? { color: extra.color } : {}) }}>{big}</b><span style={{ fontSize: u(12), color: '#5f6570' }}>{small}</span></div>;
    return (
      <div style={base}>
        {blob(380, SOFT[me.team], { top: 160, left: 80 })}{blob(300, '#e2ebfa', { top: -120, right: -120 })}{blob(260, '#e8f3ed', { bottom: 80, left: -140 })}
        <StoryHead />
        <main style={{ position: 'relative', flex: 1, padding: `${u(28)} ${u(36)} 0`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(14), textAlign: 'center' }}>
          <span style={{ alignSelf: 'center', padding: `${u(6)} ${u(14)}`, borderRadius: 100, background: '#fff', border: '1px solid #e3e6eb', fontSize: u(13), fontWeight: 600 }}>{G.quiz.title} · {date}</span>
          <img src={me.img} alt="" style={{ width: u(200), height: u(200), borderRadius: '50%', objectFit: 'cover', background: '#fff', border: `${u(8)} solid ${T.solid}`, marginTop: u(10) }} />
          <b style={{ fontSize: u(32), letterSpacing: '-.02em' }}>{me.name}</b>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: u(8) }}><b style={{ fontSize: u(88), letterSpacing: '-.05em', lineHeight: 1 }}>{ord(rankOf(me))}</b><span style={{ fontSize: u(20), color: '#5f6570' }}>of {all.length}</span></span>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: u(10), marginTop: u(6) }}>
            {stat(fmt(me.score), 'points')}{stat(`${me.correct}/${G.qs.length}`, 'correct')}{stat(T.name, `team · ${ord(teamRank)}`, { background: SOFT[me.team], border: 0, color: T.txtHex })}
          </div>
        </main>
        <div style={{ position: 'relative', margin: `${u(20)} ${u(28)} 0`, background: '#fff', border: '1px solid #e3e6eb', borderRadius: u(20), padding: `${u(14)} ${u(16)}`, display: 'flex', flexDirection: 'column', gap: u(10) }}>
          <span style={{ fontSize: u(12), fontWeight: 600, color: '#5f6570', letterSpacing: '.06em' }}>TOP 3{win ? ` · TEAM ${TEAMS[win.key].name.toUpperCase()} WON` : ''}</span>
          <div style={{ display: 'flex', gap: u(10) }}>{top.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: u(8), flex: '1 1 0', minWidth: 0 }}><b style={{ fontSize: u(14), color: TEAMS[p.team].txtHex }}>{i + 1}</b><img src={p.img} alt="" style={{ width: u(32), height: u(32), flexShrink: 0, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: `${u(2)} solid ${TEAMS[p.team].solid}` }} /><span style={{ fontSize: u(13), fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span></div>
          ))}</div>
        </div>
        <StoryFoot pad={20} />
      </div>
    );
  }
  const order = [1, 0, 2].filter((i) => top[i]);
  const AV = [118, 96, 88], NM = [20, 17, 17], HT = [240, 170, 120], NUM = [52, 40, 40];
  return (
    <div style={base}>
      {blob(360, '#e2ebfa', { top: -120, right: -120 })}{blob(300, '#e8f3ed', { top: 300, left: -170 })}{blob(260, '#f8e8e9', { top: 420, right: -150 })}{blob(280, '#fcf0d6', { bottom: 60, left: -120 })}
      <StoryHead />
      <div style={{ position: 'relative', padding: `${u(36)} ${u(36)} 0`, display: 'flex', flexDirection: 'column', gap: u(10) }}>
        {tag(`${G.quiz.title} · ${date}`)}
        <b style={{ fontSize: u(58), letterSpacing: '-.045em', lineHeight: 1 }}>Top 3<span style={{ color: '#ea4335' }}>.</span></b>
        <div aria-hidden="true" style={{ display: 'flex', gap: u(6), width: u(120), height: u(5) }}>{['#4285f4', '#ea4335', '#f9ab00', '#34a853'].map((c) => <span key={c} style={{ flex: 1, background: c, borderRadius: 4 }} />)}</div>
      </div>
      <div style={{ position: 'relative', flex: 1, padding: `0 ${u(28)}`, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: u(12), alignItems: 'end' }}>
        {order.map((i) => {
          const p = top[i], t = TEAMS[p.team];
          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(8), minWidth: 0 }}>
              {i === 0 && <svg aria-hidden="true" style={{ width: u(40), height: u(28) }} viewBox="0 0 56 40" fill="#f9ab00" stroke="#1f2328" strokeWidth="2.5" strokeLinejoin="round"><path d="M4 12l12 10L28 4l12 18 12-10-4 24H8z" /></svg>}
              <img src={p.img} alt="" style={{ width: u(AV[i]), height: u(AV[i]), borderRadius: '50%', objectFit: 'cover', background: '#fff', border: `${u(5)} solid ${t.solid}` }} />
              <b style={{ fontSize: u(NM[i]), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</b>
              <span style={{ fontSize: u(14), fontWeight: 600, color: '#5f6570' }}>{fmt(p.score)}</span>
              <div style={{ width: '100%', height: u(HT[i]), borderRadius: `${u(20)} ${u(20)} 0 0`, background: t.solid, color: p.team === 'yellow' ? '#1f2328' : '#fff', display: 'flex', justifyContent: 'center', paddingTop: u(14), boxSizing: 'border-box', fontSize: u(NUM[i]), fontWeight: 700 }}>{i + 1}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', margin: `0 ${u(28)}`, background: '#fff', borderRadius: `0 0 ${u(20)} ${u(20)}`, border: '1px solid #e3e6eb', borderTop: 0, padding: `${u(16)} ${u(18)}`, display: 'flex', alignItems: 'center', gap: u(12) }}>
        {win && <img src={mascot(win.key, 1)} alt="" style={{ width: u(44), height: u(44), flexShrink: 0, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: `${u(3)} solid ${TEAMS[win.key].solid}` }} />}
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>{win && <b style={{ fontSize: u(16) }}>Team <span style={{ color: TEAMS[win.key].solid }}>{TEAMS[win.key].name}</span> wins!</b>}<span style={{ fontSize: u(13), color: '#5f6570' }}>{G.players.length} players · {G.qs.length} questions</span></span>
      </div>
      <StoryFoot />
    </div>
  );
}
