/* Home page footer, matching the official GDG KAU website footer */
import { Link } from 'react-router-dom';
import { Logo } from './UI';

/* ---- Edit your links here ---- */
const SITE = 'https://gdgkau.com';
/* same links as the footer on gdgkau.com */
const SOCIALS = [
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/google-developer-group-kau/', icon: 'linkedin' },
  { name: 'TikTok', href: 'https://vt.tiktok.com/ZSCT3ywgx/', icon: 'tiktok' },
  { name: 'WhatsApp Community', href: 'https://chat.whatsapp.com/G1wNOfRq4sE3S5NoXPFnAx', icon: 'whatsapp' },
  { name: 'Instagram', href: 'https://www.instagram.com/gdgteam_', icon: 'instagram' },
  { name: 'X', href: 'https://x.com/gdg_team', icon: 'x' },
];
const COLUMNS = [
  { title: 'Explore', links: [['Home', SITE + '/'], ['Activities', SITE + '/activities'], ['Content', SITE + '/content'], ['Hall of Fame', SITE + '/hall-of-fame']] },
  { title: 'Community', links: [['Contact & Support', SITE + '/contact']] },
  { title: 'Legal', links: [['Terms of Service', SITE + '/terms'], ['Privacy Policy', SITE + '/privacy']] },
];
/* ------------------------------ */

const ICONS = {
  linkedin: <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3.3 7.2H5.4V18h1.9v-7.8zM6.35 6.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM18.6 13.4c0-2.2-1.2-3.4-3-3.4-1.1 0-1.8.6-2.1 1.1v-.9h-1.9V18h1.9v-4.2c0-1 .5-1.8 1.4-1.8.9 0 1.3.7 1.3 1.8V18h1.9z" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7a4.4 4.4 0 0 1-4.4-4.7z" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z" /></svg>,
  instagram: <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm5-3.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" /></svg>,
  linktree: <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M10.6 2h2.8v5.2l3.7-3.7 2 2-3.9 3.8h5.5v2.8h-5.5l3.9 3.9-2 1.9-5.1-5.1-5.1 5.1-2-1.9 3.9-3.9H3.3V9.3h5.5L4.9 5.5l2-2 3.7 3.7zm0 13.3h2.8V22h-2.8z" /></svg>,
  x: <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5z" /></svg>,
};
const ext = (href) => (href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {});

function SiteFooter() {
  return (
    <footer className="gfoot">
      <div className="gfoot-in">
        <div className="gfoot-brand">
          <span className="gfoot-logo"><Logo /></span>
          <span><b>GDG KAU</b><small>King Abdulaziz University</small></span>
        </div>
        <p className="gfoot-tag">A student community for people who build, learn, and share with technology.</p>

        <h3 className="gfoot-h">Follow GDG KAU</h3>
        <div className="gfoot-social">
          {SOCIALS.map((s) => <a key={s.name} href={s.href} aria-label={s.name} title={s.name} {...ext(s.href)}>{ICONS[s.icon]}</a>)}
        </div>

        <nav className="gfoot-cols" aria-label="GDG KAU links">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h3 className="gfoot-h">{c.title}</h3>
              <ul>{c.links.map(([label, href]) => <li key={label}><a href={href} {...ext(href)}>{label}</a></li>)}</ul>
            </div>
          ))}
        </nav>

        <div className="gfoot-bottom">
          <span className="gfoot-copy">
            <span className="dots-g" aria-hidden="true"><i style={{ background: '#4285f4' }} /><i style={{ background: '#ea4335' }} /><i style={{ background: '#f9ab00' }} /><i style={{ background: '#34a853' }} /></span>
            <span>© {new Date().getFullYear()} Google Developer Group · King Abdulaziz University<small>Made with care by students at KAU.</small></span>
          </span>
          <span className="gfoot-actions">
            <Link to="/admin" className="gfoot-admin">Admin sign in</Link>
            <button type="button" className="gfoot-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              Back to top
            </button>
          </span>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
