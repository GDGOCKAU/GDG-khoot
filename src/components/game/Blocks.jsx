/* Screens and pieces shared by the host and the player views */
import { TEAMS, TEAM_KEYS, LETTERS, ansCls, mascot, fmt, ord, css } from '../../lib/constants';
import { qType, norm, isCorrect, correctLabel, highlight } from '../../lib/questions';
import { G, curQ, ranked, rankOf, teamStats, hosted } from '../../lib/engine';
import { isWide } from '../../lib/ui';
import { Ico, Logo, Dots, Bounce, TopicChip, Avatar, You, Secs } from '../common/UI';

const tfIco = (i, s) => <Ico n={i === 0 ? 'check' : 'x'} s={s} />;
const CROWN = <svg aria-hidden="true" width="44" height="36" viewBox="0 0 24 20"><path d="M2 6l5 4 5-7 5 7 5-4-2 12H4z" fill="#f9ab00" stroke="#1f2328" strokeWidth="1.4" strokeLinejoin="round" /></svg>;

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
export function ChosenPill({ qq, choice }) {
  const t = qType(qq);
  if (t === 'pic') return <span className="chosen c-blue" style={{ letterSpacing: '.12em' }}>{String(choice).toUpperCase()}</span>;
  return <span className={`chosen ${ansCls(choice)}${t === 'code' ? ' mono' : ''}`}><span className="L">{t === 'tf' ? tfIco(choice, 20) : LETTERS[choice]}</span><span>{qq.answers[choice]}</span></span>;
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
  return <div className="card qcard" style={{ padding: '22px 28px' }}><TopicChip t={G.quiz.topic} /><h1 style={{ fontSize: 'clamp(24px,2.6vw,36px)' }}>{qq.text}</h1></div>;
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
      <span className="chip chip-green" style={{ fontSize: 15, padding: '10px 16px' }}><b data-count={right} data-start="0" data-delay="1500" data-dur="600">0</b>&nbsp;of {total} guessed it</span>
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>Leaderboard in <Secs />s</span>
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
      <span className="chip chip-green" style={{ fontSize: 15, padding: '10px 16px' }}><b data-count={right} data-start="0" data-delay="1500" data-dur="600">0</b>&nbsp;of {total} got it right</span>
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>Leaderboard in <Secs />s</span>
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
    <div className={`lb-row${p.id === 'me' ? ' me' : ''}`} style={{ '--c': t.solid, '--txt': t.txt }} {...attrs}>
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
      <h1 style={{ fontSize: 'clamp(32px,4vw,56px)', marginTop: 6 }}>Leaderboard</h1>
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
  const H = [300, 240, 190, 150];
  const step = 650, last = (ts.length - 1) * step;
  return <>
    <div style={{ textAlign: 'center' }}><div className="eyebrow">Team results</div><h1 style={{ fontSize: 'clamp(36px,5vw,64px)', marginTop: 6 }}>Team <span style={{ color: TEAMS[win.key].solid }}>{TEAMS[win.key].name}</span> wins<span style={{ color: '#ea4335' }}>!</span></h1></div>
    <div className="podium">
      {shown.map((t) => {
        const r = ts.indexOf(t), T = TEAMS[t.key], d = (ts.length - 1 - r) * step;
        return (
          <div key={t.key} className={`pod${t.key === 'yellow' ? ' yel' : ''}${r === 0 ? ' win' : ''}`} style={{ '--c': T.solid, '--d': `${d}ms`, '--cd': `${last + 1100}ms` }}>
            {r === 0 && <span className="crown">{CROWN}</span>}
            <Avatar p={{ team: t.key, img: mascot(t.key, 0) }} size={r ? 80 : 100} bw={4} />
            <span className="nm">Team {T.name}</span><span className="pt">{t.count} player{t.count > 1 ? 's' : ''}</span>
            <div className="blk" style={{ '--h': `${H[r]}px` }}><b>{r + 1}</b><span className="num"><Num to={Math.round(t.avg)} delay={d} dur={1200} /> avg</span></div>
          </div>
        );
      })}
    </div>
    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>Ranked by average points per player, so team size doesn&apos;t matter. Top 3 players next.</p>
  </>;
}
export function PodiumBlock() {
  const top = ranked().slice(0, 3), order = [1, 0, 2].filter((i) => top[i]), H = [320, 240, 180];
  const D = [1500, 750, 0];
  return <>
    <div style={{ textAlign: 'center' }}><div className="eyebrow">Final results</div><h1 style={{ fontSize: 'clamp(36px,5vw,64px)', marginTop: 6 }}>And the winners are<Bounce /></h1></div>
    <div className="podium">
      {order.map((i) => {
        const p = top[i], T = TEAMS[p.team];
        return (
          <div key={p.id} className={`pod${p.team === 'yellow' ? ' yel' : ''}${i === 0 ? ' win' : ''}`} style={{ '--c': T.solid, '--d': `${D[i]}ms`, '--cd': '2700ms' }}>
            {i === 0 && <span className="crown">{CROWN}</span>}
            <Avatar p={p} size={i ? 110 : 150} bw={5} />
            <span className="nm">{p.name}{p.id === 'me' && <You />}</span>
            <span className="pt num"><Num to={p.score} delay={D[i]} dur={1200} /> pts</span>
            <div className="blk" style={{ '--h': `${H[i]}px` }}><b>{i + 1}</b><span>{ord(i + 1)}</span></div>
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
      <div><div className="eyebrow">Final results · {G.quiz.title}</div><h1 style={{ fontSize: 'clamp(32px,4vw,56px)', marginTop: 6 }}>Final leaderboard<span style={{ color: '#f9ab00' }}>.</span></h1></div>
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

/* ---------- 9:16 story card preview ---------- */
export function Story({ kind }) {
  const me = G.me, top = ranked().slice(0, 3), T = TEAMS[me.team], win = teamStats()[0];
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const head = <div className="sb"><Logo /><span>GDG KAU<b style={{ color: '#1a73e8' }}>HOOT</b><small>Google Developer Group · KAU</small></span></div>;
  const foot = <>
    <div className="foot"><span>Instagram · TikTok @GDGteam_</span><b style={{ color: '#1f2328' }}>gdgkau.com</b></div>
    <div className="stripe">{['#4285f4', '#ea4335', '#f9ab00', '#34a853'].map((c) => <span key={c} style={{ background: c }} />)}</div>
  </>;
  if (kind === 'me') {
    return (
      <div className="story"><span className="blob" style={{ width: 200, height: 200, background: T.softHex, top: -60, right: -70 }} />{head}
        <span className="stag">{G.quiz.title} · {date}</span>
        <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center')}>
          <img src={me.img} alt="" className="s-av" style={{ borderColor: T.solid }} />
          <b className="s-name">{me.name}</b>
          <b className="s-rank" style={{ color: T.txtHex }}>{ord(rankOf(me))}</b>
          <span className="s-sub">{fmt(me.score)} points · {me.correct}/{G.qs.length} correct</span>
          <span className="s-team" style={{ background: T.softHex, color: T.txtHex }}>Team {T.name}</span>
        </div>{foot}
      </div>
    );
  }
  const order = [1, 0, 2].filter((i) => top[i]);
  const hts = [36, 26, 20];
  return (
    <div className="story"><span className="blob" style={{ width: 200, height: 200, background: '#e2ebfa', top: -60, right: -70 }} />{head}
      <span className="stag">{G.quiz.title} · {date}</span>
      <b className="s-title">Top 3<span style={{ color: '#ea4335' }}>.</span></b>
      <div style={css('flex:1;display:flex;align-items:flex-end;justify-content:center;gap:6px')}>
        {order.map((i) => {
          const p = top[i], t = TEAMS[p.team];
          return (
            <div key={p.id} style={css('flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px')}>
              <img src={p.img} alt="" className={i ? 's-pav' : 's-pav first'} style={{ borderColor: t.solid }} />
              <b className="s-pn">{p.name}</b><span className="s-ps">{fmt(p.score)}</span>
              <div className="s-blk" style={{ height: `${hts[i]}cqw`, background: t.solid, color: p.team === 'yellow' ? '#1f2328' : '#fff' }}>{i + 1}</div>
            </div>
          );
        })}
      </div>
      {win && <div className="s-win"><b>Team <span style={{ color: TEAMS[win.key].solid }}>{TEAMS[win.key].name}</span> wins!</b><br /><span>{G.players.length} players · {G.qs.length} questions</span></div>}
      {foot}
    </div>
  );
}
