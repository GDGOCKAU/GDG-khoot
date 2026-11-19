/* Small browser helpers: toast, screen width, result animations, the draggable spider */
import { useEffect, useLayoutEffect, useState } from 'react';
import { fmt } from './constants';

let toastT;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('hide');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hide'), 2600);
}

export const isWide = () => window.innerWidth >= 900;
export function useWide() {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    const on = () => setWide(isWide());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

/* count-ups, leaderboard row moves and growing bars. Runs once per screen. */
function animCount(el) {
  const to = +el.dataset.count, from = +(el.dataset.start || 0), delay = +(el.dataset.delay || 0), dur = +(el.dataset.dur || 1000), suf = el.dataset.suffix || '';
  el.textContent = fmt(from) + suf;
  setTimeout(() => {
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e) + suf; if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, delay);
}
export function runAnims(root = document) {
  root.querySelectorAll('[data-flipgroup]').forEach((g) => {
    const items = [...g.children].filter((e) => e.dataset.from !== undefined);
    if (!items.length) return;
    const pitch = items.length > 1 ? items[1].offsetTop - items[0].offsetTop : items[0].offsetHeight + 12;
    const delay = +(g.dataset.delay || 1000);
    items.forEach((el) => {
      const from = +el.dataset.from, idx = +el.dataset.idx;
      el.style.transition = 'none'; el.style.transform = `translateY(${(from - idx) * pitch}px)`;
      if (el.dataset.off) el.style.opacity = '0';
      const rk = el.querySelector('[data-rankto]'); if (rk) rk.textContent = rk.dataset.rankfrom;
    });
    void g.offsetHeight;
    setTimeout(() => {
      items.forEach((el) => {
        el.style.transition = 'transform 1.1s cubic-bezier(.22, 1, .36, 1), opacity .6s'; el.style.transform = ''; el.style.opacity = '';
        const rk = el.querySelector('[data-rankto]'); if (rk) rk.textContent = rk.dataset.rankto;
      });
    }, delay);
  });
  root.querySelectorAll('[data-count]').forEach(animCount);
  root.querySelectorAll('[data-grow]').forEach((el) => {
    el.style.transition = 'none'; el.style.width = el.dataset.gstart + '%'; void el.offsetWidth;
    setTimeout(() => { el.style.transition = 'width 1.1s cubic-bezier(.22, 1, .36, 1)'; el.style.width = el.dataset.grow + '%'; }, +(el.dataset.delay || 1000));
  });
}

/* run the result animations once each time `key` changes (a new screen) */
export function useAnims(key) {
  useLayoutEffect(() => { runAnims(); }, [key]);
}

/* drag the hanging spider on a stretchy thread; it swings back when you let go */
export function installSpiderDrag() {
  const onDown = (e) => {
    const img = e.target.closest && e.target.closest('.hang img.spider'); if (!img) return;
    e.preventDefault();
    const r = img.getBoundingClientRect(), thread = img.previousElementSibling, hang = img.closest('.hang');
    const tr = thread.getBoundingClientRect(), hr = hang.getBoundingClientRect();
    const color = getComputedStyle(thread).backgroundColor;
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'spider-line'); svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linecap', 'round'); svg.appendChild(line);
    const fly = img.cloneNode(); fly.className = 'spider-fly'; fly.removeAttribute('title'); fly.style.width = r.width + 'px';
    document.body.append(svg, fly);
    img.style.visibility = 'hidden'; thread.style.visibility = 'hidden';
    const ax = tr.left + tr.width / 2, ay = hr.top;
    let x = r.left, y = r.top, rot = 0, lastX = e.clientX;
    const paint = () => { fly.style.left = x + 'px'; fly.style.top = y + 'px'; fly.style.transform = `rotate(${rot}deg)`; line.setAttribute('x1', ax); line.setAttribute('y1', ay); line.setAttribute('x2', x + r.width / 2); line.setAttribute('y2', y + r.width * 0.04); };
    paint();
    const move = (ev) => { rot = Math.max(-25, Math.min(25, (ev.clientX - lastX) * 2)); lastX = ev.clientX; x = ev.clientX - ox; y = ev.clientY - oy; paint(); };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      const x0 = x, y0 = y, r0 = rot, t0 = performance.now();
      const step = (t) => {
        const h = img.getBoundingClientRect(), k = Math.min(1, (t - t0) / 750), e2 = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.12;
        x = x0 + (h.left - x0) * e2; y = y0 + (h.top - y0) * e2; rot = r0 * (1 - k) + Math.sin(k * Math.PI * 3) * 8 * (1 - k); paint();
        if (k < 1 && img.isConnected) requestAnimationFrame(step); else { svg.remove(); fly.remove(); img.style.visibility = ''; thread.style.visibility = ''; }
      };
      requestAnimationFrame(step);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  document.addEventListener('pointerdown', onDown);
  return () => document.removeEventListener('pointerdown', onDown);
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
  }
}

export function shrinkImage(file, max = 800) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)); }; img.onerror = () => res(null); img.src = r.result; };
    r.onerror = () => res(null); r.readAsDataURL(file);
  });
}
