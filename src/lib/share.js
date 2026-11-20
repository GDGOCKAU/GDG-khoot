/* Game-over sharing: text, links and the 1080×1920 story image */
import { SHARE_URL, TEAMS, fmt, ord, mascot } from './constants';
import { LOGO_SRC } from './icons';
import { G, ranked, rankOf, teamStats } from './engine';
import { toast, copyText } from './ui';

export function shareText(kind) {
  const me = G.me;
  if (kind === 'me') return `I finished ${ord(rankOf(me))} with ${fmt(me.score)} points in "${G.quiz.title}" on GDG KAUHOOT!`;
  const t = ranked().slice(0, 3).map((p, i) => `${i + 1}. ${p.name}`).join(', ');
  return `Top 3 in "${G.quiz.title}" on GDG KAUHOOT: ${t}`;
}
/* the phone's share menu only exists on secure (https) pages */
export const canNativeShare = () => typeof navigator !== 'undefined' && !!navigator.share && window.isSecureContext !== false;
export { SHARE_URL };
export function shareLink(where, kind) {
  const text = shareText(kind);
  return where === 'x'
    ? 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL)
    : 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + SHARE_URL);
}

function offerFile(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const SOFT = { blue: '#e8f0fe', red: '#fce8e6', yellow: '#fef7e0', green: '#e6f4ea' };
/* draws the same card as <Story>, at 2× its 540×960 design size */
async function drawStory(kind) {
  const S = 2, W = 540 * S, H = 960 * S, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const F = (w, s) => `${w} ${s * S}px "Google Sans", "Plus Jakarta Sans", system-ui, sans-serif`;
  const circle = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx * S, cy * S, r * S, 0, 7); x.fill(); };
  const text = (t, px, py, font, col, align = 'left') => { x.font = font; x.fillStyle = col; x.textAlign = align; x.fillText(t, px * S, py * S); };
  const avatar = async (src, cx, cy, d, bw, col) => {
    const r = d / 2; circle(cx, cy, r, col); circle(cx, cy, r - bw, '#fff');
    const img = await loadImg(src);
    if (img) { x.save(); x.beginPath(); x.arc(cx * S, cy * S, (r - bw) * S, 0, 7); x.clip(); x.drawImage(img, (cx - r + bw) * S, (cy - r + bw) * S, (d - 2 * bw) * S, (d - 2 * bw) * S); x.restore(); }
  };
  const pill = (t, cx, cy, font, align) => { x.font = font; const w = x.measureText(t).width / S + 28; const left = align === 'center' ? cx - w / 2 : cx; x.fillStyle = '#fff'; rr(x, left * S, (cy - 15) * S, w * S, 30 * S, 15 * S); x.fill(); x.strokeStyle = '#e3e6eb'; x.lineWidth = S; x.stroke(); text(t, left + 14, cy + 5, font, '#1f2328'); };
  x.fillStyle = '#f8f9fe'; x.fillRect(0, 0, W, H);
  const me = G.me, all = ranked(), top = all.slice(0, 3), T = TEAMS[me.team], ts = teamStats(), win = ts[0];
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (kind === 'me') { circle(270, 350, 190, SOFT[me.team]); circle(510, 30, 150, '#e2ebfa'); circle(-10, 750, 130, '#e8f3ed'); }
  else { circle(480, 60, 180, '#e2ebfa'); circle(-20, 450, 150, '#e8f3ed'); circle(520, 550, 130, '#f8e8e9'); circle(20, 760, 140, '#fcf0d6'); }
  /* header */
  const logo = await loadImg(LOGO_SRC);
  if (logo) x.drawImage(logo, 36 * S, 40 * S, 64 * S, 36 * S);
  x.font = F(700, 22); const w1 = x.measureText('GDG KAU').width / S;
  text('GDG KAU', 112, 58, F(700, 22), '#1f2328'); text('HOOT', 112 + w1, 58, F(700, 22), '#1a73e8');
  text('Google Developer Group · KAU', 112, 76, F(400, 13), '#5f6570');
  if (kind === 'me') {
    pill(`${G.quiz.title} · ${date}`, 270, 128, F(600, 13), 'center');
    await avatar(me.img, 270, 268, 200, 8, T.solid);
    text(me.name, 270, 412, F(700, 32), '#1f2328', 'center');
    x.font = F(700, 88); const rk = ord(rankOf(me)), rw = x.measureText(rk).width / S; x.font = F(400, 20); const ow = x.measureText(`of ${all.length}`).width / S;
    const sx = 270 - (rw + 8 + ow) / 2; text(rk, sx, 506, F(700, 88), '#1f2328'); text(`of ${all.length}`, sx + rw + 8, 506, F(400, 20), '#5f6570');
    const teamRank = ts.findIndex((t) => t.key === me.team) + 1;
    const boxes = [[fmt(me.score), 'points', '#fff', '#1f2328'], [`${me.correct}/${G.qs.length}`, 'correct', '#fff', '#1f2328'], [T.name, `team · ${ord(teamRank)}`, SOFT[me.team], T.txtHex]];
    boxes.forEach(([b, sm, bg, col], i) => { const bx = 36 + i * (156 + 10); x.fillStyle = bg; rr(x, bx * S, 530 * S, 156 * S, 66 * S, 16 * S); x.fill(); if (bg === '#fff') { x.strokeStyle = '#e3e6eb'; x.lineWidth = S; x.stroke(); } text(b, bx + 78, 562, F(700, 22), col, 'center'); text(sm, bx + 78, 582, F(400, 12), '#5f6570', 'center'); });
    x.fillStyle = '#fff'; rr(x, 28 * S, 770 * S, 484 * S, 92 * S, 20 * S); x.fill(); x.strokeStyle = '#e3e6eb'; x.lineWidth = S; x.stroke();
    text(`TOP 3${win ? ` · TEAM ${TEAMS[win.key].name.toUpperCase()} WON` : ''}`, 44, 796, F(600, 12), '#5f6570');
    for (let i = 0; i < top.length; i++) {
      const p = top[i], bx = 44 + i * 156;
      text(String(i + 1), bx, 834, F(700, 14), TEAMS[p.team].txtHex);
      await avatar(p.img, bx + 30, 829, 32, 2, TEAMS[p.team].solid);
      text(p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name, bx + 52, 834, F(600, 13), '#1f2328');
    }
  } else {
    pill(`${G.quiz.title} · ${date}`, 36, 130, F(600, 13));
    text('Top 3', 36, 214, F(700, 58), '#1f2328'); x.font = F(700, 58); text('.', 36 + x.measureText('Top 3').width / S, 214, F(700, 58), '#ea4335');
    ['#4285f4', '#ea4335', '#f9ab00', '#34a853'].forEach((col, i) => { x.fillStyle = col; rr(x, (36 + i * 31.5) * S, 228 * S, 25.5 * S, 5 * S, 2 * S); x.fill(); });
    const colW = (484 - 24) / 3, base = 790, HT = [240, 170, 120], AV = [118, 96, 88], NM = [20, 17, 17], NUM = [52, 40, 40];
    for (const [slot, i] of [[0, 1], [1, 0], [2, 2]]) {
      const p = top[i]; if (!p) continue;
      const t = TEAMS[p.team], bx = 28 + slot * (colW + 12), cx = bx + colW / 2, by = base - HT[i];
      x.fillStyle = t.solid; rr(x, bx * S, by * S, colW * S, (HT[i] + 20) * S, 20 * S); x.fill();
      text(String(i + 1), cx, by + 14 + NUM[i] * 0.85, F(700, NUM[i]), p.team === 'yellow' ? '#1f2328' : '#fff', 'center');
      text(fmt(p.score), cx, by - 10, F(600, 14), '#5f6570', 'center');
      text(p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name, cx, by - 32, F(700, NM[i]), '#1f2328', 'center');
      await avatar(p.img, cx, by - 52 - AV[i] / 2, AV[i], 5, t.solid);
    }
    x.fillStyle = '#fff'; x.fillRect(28 * S, base * S, 484 * S, 76 * S); rr(x, 28 * S, (base + 40) * S, 484 * S, 36 * S, 20 * S); x.fill();
    if (win) { await avatar(mascot(win.key, 1), 68, base + 38, 44, 3, TEAMS[win.key].solid); x.font = F(700, 16); const tw = x.measureText('Team ').width / S, nw = x.measureText(TEAMS[win.key].name).width / S; text('Team ', 102, base + 34, F(700, 16), '#1f2328'); text(TEAMS[win.key].name, 102 + tw, base + 34, F(700, 16), TEAMS[win.key].solid); text(' wins!', 102 + tw + nw, base + 34, F(700, 16), '#1f2328'); }
    text(`${G.players.length} players · ${G.qs.length} questions`, 102, base + 54, F(400, 13), '#5f6570');
  }
  text('@gdgteam_ · @gdgockau', 36, 924, F(400, 13), '#5f6570');
  text('gdgkau.com', 504, 924, F(600, 13), '#1f2328', 'right');
  ['#4285f4', '#ea4335', '#f9ab00', '#34a853'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * W / 4, H - 8 * S, W / 4, 8 * S); });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export async function doShare(act, kind) {
  const text = shareText(kind);
  if (act === 'copyLink') return toast((await copyText(text + ' ' + SHARE_URL)) ? 'Link copied' : 'Could not copy the link');
  /* share the link anywhere: the phone's own share menu (needs an https page) */
  if (act === 'share') {
    if (canNativeShare()) {
      try { await navigator.share({ title: 'GDG KAUHOOT', text, url: SHARE_URL }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    return false;
  }
  const blob = await drawStory(kind);
  const name = `kauhoot-${kind === 'me' ? 'my-result' : 'top-3'}.png`;
  if (act === 'saveImg') { offerFile(blob, name); toast('Image saved'); return; }
  try {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'GDG KAUHOOT', text }); return; }
    if (navigator.share) { await navigator.share({ title: 'GDG KAUHOOT', text, url: SHARE_URL }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  offerFile(blob, name); toast('Image saved. Post it to your story.');
}
