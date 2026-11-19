/* Game-over sharing: text, links and the 1080×1920 story image */
import { SHARE_URL, TEAMS, fmt, ord } from './constants';
import { LOGO } from './icons';
import { G, ranked, rankOf, teamStats } from './engine';
import { toast, copyText } from './ui';

export function shareText(kind) {
  const me = G.me;
  if (kind === 'me') return `I finished ${ord(rankOf(me))} with ${fmt(me.score)} points in "${G.quiz.title}" on GDG KAUHOOT!`;
  const t = ranked().slice(0, 3).map((p, i) => `${i + 1}. ${p.name}`).join(', ');
  return `Top 3 in "${G.quiz.title}" on GDG KAUHOOT: ${t}`;
}
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

async function drawStory(kind) {
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const F = (w, s) => `${w} ${s}px "Google Sans", "Plus Jakarta Sans", system-ui, sans-serif`;
  x.fillStyle = '#f8f9fe'; x.fillRect(0, 0, W, H);
  const me = G.me, T = TEAMS[me.team];
  x.fillStyle = kind === 'me' ? T.softHex : '#e2ebfa'; x.beginPath(); x.arc(W - 40, 80, 300, 0, 7); x.fill();
  x.fillStyle = '#e8f3ed'; x.beginPath(); x.arc(-60, 1250, 220, 0, 7); x.fill();
  const logo = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO));
  if (logo) x.drawImage(logo, 70, 80, 120, 67);
  x.fillStyle = '#1f2328'; x.font = F(700, 44); x.fillText('GDG KAU', 210, 120); const w1 = x.measureText('GDG KAU').width;
  x.fillStyle = '#1a73e8'; x.fillText('HOOT', 210 + w1, 120);
  x.fillStyle = '#5f6570'; x.font = F(400, 26); x.fillText('Google Developer Group · KAU', 210, 158);
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  x.font = F(600, 28); const tag = `${G.quiz.title} · ${date}`; const tw = x.measureText(tag).width;
  x.fillStyle = '#ffffff'; rr(x, 70, 220, tw + 48, 56, 28); x.fill(); x.fillStyle = '#1f2328'; x.fillText(tag, 94, 258);
  x.textAlign = 'center';
  if (kind === 'me') {
    const img = await loadImg(me.img);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(W / 2, 760, 230, 0, 7); x.fill();
    x.lineWidth = 16; x.strokeStyle = T.solid; x.stroke();
    if (img) { x.save(); x.beginPath(); x.arc(W / 2, 760, 215, 0, 7); x.clip(); x.drawImage(img, W / 2 - 200, 560, 400, 400); x.restore(); }
    x.fillStyle = '#1f2328'; x.font = F(700, 64); x.fillText(me.name, W / 2, 1110);
    x.fillStyle = T.txtHex; x.font = F(700, 190); x.fillText(ord(rankOf(me)), W / 2, 1320);
    x.fillStyle = '#5f6570'; x.font = F(500, 44); x.fillText(`${fmt(me.score)} points · ${me.correct}/${G.qs.length} correct`, W / 2, 1410);
    x.font = F(600, 36); const tt = `Team ${T.name}`; const ttw = x.measureText(tt).width;
    x.fillStyle = T.softHex; rr(x, W / 2 - ttw / 2 - 36, 1460, ttw + 72, 76, 38); x.fill(); x.fillStyle = T.txtHex; x.fillText(tt, W / 2, 1510);
  } else {
    x.fillStyle = '#1f2328'; x.font = F(700, 110); x.fillText('Top 3', W / 2 - 20, 450); x.fillStyle = '#ea4335'; x.fillText('.', W / 2 + 150, 450);
    const top = ranked().slice(0, 3), slots = [[1, 120, 300], [0, 400, 430], [2, 680, 220]];
    for (const [i, sx, h] of slots) {
      const p = top[i]; if (!p) continue;
      const t = TEAMS[p.team], base = 1500, cx = sx + 140, r = i ? 90 : 120;
      x.fillStyle = t.solid; rr(x, sx, base - h, 280, h + 20, 30); x.fill();
      x.fillStyle = p.team === 'yellow' ? '#1f2328' : '#fff'; x.font = F(700, 96); x.fillText(String(i + 1), cx, base - h + 110);
      const cy = base - h - 140 - r;
      const img = await loadImg(p.img);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.lineWidth = 10; x.strokeStyle = t.solid; x.stroke();
      if (img) { x.save(); x.beginPath(); x.arc(cx, cy, r - 8, 0, 7); x.clip(); x.drawImage(img, cx - r + 8, cy - r + 8, 2 * r - 16, 2 * r - 16); x.restore(); }
      x.fillStyle = '#1f2328'; x.font = F(700, 40); x.fillText(p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name, cx, base - h - 70);
      x.fillStyle = '#5f6570'; x.font = F(500, 32); x.fillText(fmt(p.score), cx, base - h - 26);
    }
    const win = teamStats()[0];
    if (win) { x.fillStyle = '#fff'; rr(x, 90, 1560, W - 180, 150, 30); x.fill(); x.fillStyle = '#1f2328'; x.font = F(700, 44); x.fillText(`Team ${TEAMS[win.key].name} wins!`, W / 2, 1630); x.fillStyle = '#5f6570'; x.font = F(400, 30); x.fillText(`${G.players.length} players · ${G.qs.length} questions`, W / 2, 1680); }
  }
  x.textAlign = 'left'; x.fillStyle = '#5f6570'; x.font = F(400, 28); x.fillText('Instagram · TikTok @GDGteam_', 70, 1840);
  x.textAlign = 'right'; x.fillStyle = '#1f2328'; x.font = F(700, 28); x.fillText('gdgkau.com', W - 70, 1840);
  ['#4285f4', '#ea4335', '#f9ab00', '#34a853'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * W / 4, H - 16, W / 4, 16); });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export async function doShare(act, kind) {
  const text = shareText(kind);
  if (act === 'copyLink') return toast((await copyText(text + ' ' + SHARE_URL)) ? 'Link copied' : 'Could not copy the link');
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
