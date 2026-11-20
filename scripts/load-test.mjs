// Load / pre-flight test: a host + N simulated players play a full game through the web origin
// (the same path phones use). Creates a throwaway quiz and deletes it at the end.
// usage: ADMIN_PASSWORD=... node scripts/load-test.mjs http://localhost:5173 150 5
import { createRequire } from "node:module";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { io } = require("socket.io-client");
const WEB = process.argv[2] ?? "http://127.0.0.1:5173";
const N = Number(process.argv[3] ?? 150), QN = Number(process.argv[4] ?? 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (c, m) => { if (!c) { fails.push(m); console.log("  FAIL", m); } };
async function call(method, path, body, token) {
  const headers = { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const r = await fetch(WEB + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}
const connect = () => new Promise((res, rej) => { const s = io(WEB, { transports: ["websocket"], forceNew: true, reconnection: false }); s.once("connect", () => res(s)); s.once("connect_error", rej); });
const ack = (s, ...a) => new Promise((r) => s.emit(...a, r));
async function waitAll(pred, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(20); }
  check(false, `timeout: ${label}`); return false;
}

const t0 = Date.now();
const token = (await call("POST", "/api/v1/auth/login", { email: "admin@gdg-kauhoot.local", password: process.env.ADMIN_PASSWORD })).json?.token;
check(!!token, "admin login");
const questions = Array.from({ length: QN }, (_, i) => ({ text: `Load question ${i + 1}?`, order: i, timeLimitSecs: 20, type: "mc", points: 1,
  options: [{ text: "Right", isCorrect: true }, { text: "Wrong A", isCorrect: false }, { text: "Wrong B", isCorrect: false }, { text: "Wrong C", isCorrect: false }] }));
const quiz = (await call("POST", "/api/v1/quizzes/save", { title: `Load ${N}p`, isPublished: true, questions }, token)).json;
const session = (await call("POST", "/api/v1/sessions", { quizId: quiz.id, powerUps: true }, token)).json;
console.log(`session pin ${session.pin}, power-ups ${session.powerUps}`);
const host = await connect();
check((await ack(host, "host:join", session.id, token)).ok, "host:join");
const hostEvents = [];
host.onAny((e, p) => hostEvents.push({ e, p, at: Date.now() }));

const tJoin = Date.now();
const players = await Promise.all(Array.from({ length: N }, async (_, i) => {
  const r = await call("POST", "/api/v1/sessions/join", { pin: session.pin, name: `P${i}`, mascot: "blue-0", team: ["blue", "red", "yellow", "green"][i % 4] });
  check(r.status === 201, `join ${i} (${r.status} ${r.text.slice(0, 60)})`);
  const s = await connect();
  const events = [];
  s.onAny((e, p) => events.push({ e, p, at: Date.now() }));
  const j = await ack(s, "game:join", session.id, r.json.id);
  check(j.ok && j.state.phase.phase === "lobby" && !j.state.question, `player ${i} lobby`);
  return { i, id: r.json.id, s, events };
}));
console.log(`joined ${N} in ${Date.now() - tJoin} ms`);
await waitAll(() => hostEvents.filter((e) => e.e === "player_joined").length >= N, 5000, "host saw all joins");
await sleep(300);
check(players.every((p) => !p.events.some((e) => e.e === "question")), "no question before Start");

check(!!process.env.ADMIN_PASSWORD, "set ADMIN_PASSWORD");
const st = await call("POST", `/api/v1/sessions/${session.id}/start`, {}, token);
check(st.status === 200, `start ${st.status}`);
for (let qi = 0; qi < QN; qi++) {
  const got = () => players.filter((p) => p.events.some((e) => e.e === "question" && e.p.order === qi));
  await waitAll(() => got().length === N, 15000, `Q${qi + 1} to all`);
  const arrivals = got().map((p) => p.events.find((e) => e.e === "question" && e.p.order === qi).at);
  const spread = Math.max(...arrivals) - Math.min(...arrivals);
  const q = players[0].events.find((e) => e.e === "question" && e.p.order === qi).p;
  // power-ups: 10% double, 10% 50/50 on the first two questions
  if (qi < 2) {
    const pu = await Promise.all(players.filter((p) => p.i % 10 === qi).map((p) => call("POST", `/api/v1/sessions/${session.id}/powerups`, { participantId: p.id, kind: qi === 0 ? "double" : "fifty" })));
    check(pu.every((r) => r.status === 200), `power-ups on Q${qi + 1}: ${pu.filter((r) => r.status === 200).length}/${pu.length}`);
  }
  const tA = Date.now();
  const res = await Promise.all(players.map((p) => call("POST", `/api/v1/sessions/${session.id}/answers`, { participantId: p.id, questionId: q.questionId, optionId: q.options[p.i % 4 === 3 ? 1 : 0].id })));
  const answerMs = Date.now() - tA;
  check(res.every((r) => r.status === 201), `answers ${res.filter((r) => r.status === 201).length}/${N} (${[...new Set(res.filter((r) => r.status !== 201).map((r) => r.status + r.text.slice(0, 40)))]})`);
  // everyone answered -> server closes early -> reveal + one result per phone
  const results = () => players.filter((p) => p.events.some((e) => e.e === "result" && e.p.questionId === q.questionId));
  await waitAll(() => results().length === N, 10000, `Q${qi + 1} results`);
  const resultAt = results().map((p) => p.events.find((e) => e.e === "result" && e.p.questionId === q.questionId).at);
  const closeMs = Math.max(...resultAt) - (tA + answerMs);
  check(players.every((p) => p.events.filter((e) => e.e === "result" && e.p.questionId === q.questionId).length === 1), `Q${qi + 1}: exactly one result per phone`);
  console.log(`Q${qi + 1}: question reached all ${N} within ${spread} ms of each other | ${N} answers in ${answerMs} ms | every phone had its result ${closeMs} ms after the last answer`);
  // host skips reveal, leaderboard and the next countdown to keep the test short
  for (let k = 0; k < (qi === QN - 1 ? 2 : 3); k++) { await call("POST", `/api/v1/sessions/${session.id}/skip`, {}, token); await sleep(150); }
}
await waitAll(() => players.every((p) => p.events.some((e) => e.e === "final")), 10000, "final to all");
const final = players[0].events.find((e) => e.e === "final").p;
check(final.ranking.length === N && final.top3.length === 3 && final.teams.length === 4, "final has teams, top 3 and ranking");
const leaked = players.filter((p) => p.events.some((e) => ["reveal_host", "answer_count", "leaderboard", "player_joined"].includes(e.e) || JSON.stringify(e.p ?? "").includes("isCorrect")));
check(leaked.length === 0, `no host-only data on phones (${leaked.length} leaked)`);
const doubled = players.filter((p) => p.i % 10 === 0).map((p) => p.events.find((e) => e.e === "result" && e.p.questionId === players[0].events.find((x) => x.e === "question" && x.p.order === 0).p.questionId).p);
check(doubled.every((r) => r.doubled === r.correct), "double points applied to correct answers only");
console.log(`final: top3 ${final.top3.map((p) => `${p.name}=${p.score}`).join(", ")} | teams ${final.teams.map((t) => `${t.team}=${t.score}`).join(", ")}`);
[host, ...players.map((p) => p.s)].forEach((s) => s.disconnect());
await call("DELETE", `/api/v1/quizzes/${quiz.id}`, null, token);
console.log(`\n${fails.length ? `FAILED ${fails.length}` : "ALL CHECKS PASSED"} in ${Date.now() - t0} ms`);
process.exit(fails.length ? 1 : 0);
