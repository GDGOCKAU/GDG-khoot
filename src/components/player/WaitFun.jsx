/* Things to do while waiting for the others: poke Devu, read a code snack */
import { useEffect, useState } from 'react';
import { mascot } from '../../lib/constants';
import { highlight } from '../../lib/questions';

/* ---------- Poke Devu ---------- */
let pokes = 0; // kept for the whole game, so the count carries over between questions

const pokeLine = (n) =>
  n === 0 ? 'Tap Devu while you wait 👆'
  : n < 5 ? 'Hehe, that tickles!'
  : n < 10 ? "Okay okay, I'm awake 😅"
  : n < 20 ? 'Devu is getting dizzy 😵'
  : n < 40 ? 'You really like poking, huh?'
  : n < 75 ? 'Devu has filed a complaint 📝'
  : 'Legendary poker 🏆';

export function PokeDevu({ me, team, size }) {
  const [state, setState] = useState({ n: pokes, img: me.img });
  const poke = () => {
    pokes += 1;
    let img;
    do { img = mascot(me.team, Math.floor(Math.random() * 12)); } while (img === state.img);
    setState({ n: pokes, img });
  };
  return (
    <div className="poke">
      <button type="button" className="poke-btn" onClick={poke} aria-label={`Poke Devu. Poked ${state.n} times`}>
        <img key={state.n} className={`avatar${state.n ? ' poke-pop' : ''}`} src={state.img} alt="" width={size} height={size}
          style={{ '--team': team.solid, borderWidth: size > 100 ? 7 : 4 }} />
        {state.n > 0 && <span key={`f${state.n}`} className="poke-float" aria-hidden="true">+1</span>}
        {state.n > 0 && <span className="poke-count num" style={{ background: team.solid }}>{state.n}</span>}
      </button>
      <p className="poke-line" aria-live="polite">{pokeLine(state.n)}</p>
    </div>
  );
}

/* ---------- Code snack ---------- */
const SNACKS = [
  'while (waiting) { stretch(); }',
  'if (answer === correct) celebrate(); // fingers crossed',
  'const patience = Infinity;',
  'await others.answer();',
  'try { win(); } catch { tryAgain(); }',
  'console.log("is it time yet?");',
  'devu.mood = "focused";',
  'setTimeout(reveal, timeLeft);',
  'streak++; // hopefully',
  'brain.cache.clear(); // ready for the next one',
  'return confidence * 100;',
  'for (const s of seconds) wait(s);',
  'throw new Error("too easy");',
  'print("Hello, GDG KAU!")',
  '// It works on my machine 🤷',
  '// TODO: answer even faster next time',
  '$ git commit -m "locked in my answer"',
  '$ npm install luck',
  '$ flutter run --release',
  '$ sudo make me-a-winner',
  'let coffee = 3; // cups so far',
  'if (!sure) { trustGut(); }',
];
let snackAt = Math.floor(Math.random() * SNACKS.length);

function SnackLine({ s }) {
  if (s.startsWith('$ ')) return <><span className="snack-prompt">$</span> {s.slice(2)}</>;
  const i = s.indexOf('//');
  const code = i < 0 ? s : s.slice(0, i), note = i < 0 ? '' : s.slice(i);
  return <><span dangerouslySetInnerHTML={{ __html: highlight(code) }} />{note && <span className="snack-note">{note}</span>}</>;
}

export function CodeSnack() {
  const [i, setI] = useState(() => (snackAt = (snackAt + 1) % SNACKS.length));
  const next = () => setI(() => (snackAt = (snackAt + 1) % SNACKS.length));
  useEffect(() => { const t = setInterval(next, 4500); return () => clearInterval(t); }, []);
  return (
    <button type="button" className="codebox snack" onClick={next} aria-label="Code snack. Tap for another one">
      <span className="codebar"><span className="snack-dots" aria-hidden="true"><i /><i /><i /></span><span>CODE SNACK</span><span className="snack-tap">tap for more</span></span>
      <span key={i} className="snack-body" aria-live="polite"><SnackLine s={SNACKS[i]} /><span className="snack-cursor" aria-hidden="true" /></span>
    </button>
  );
}
