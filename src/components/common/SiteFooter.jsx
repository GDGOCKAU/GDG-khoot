/* Home page footer: GDG KAU logo and a link to the official website */
import { Logo } from './UI';

/* The only link in the footer: the official GDG KAU website */
const SITE = 'https://gdgkau.com';

function SiteFooter() {
  return (
    <footer className="gfoot">
      <div className="gfoot-in gfoot-row">
        <div className="gfoot-brand">
          <span className="gfoot-logo"><Logo /></span>
          <span><b>GDG KAU</b><small>King Abdulaziz University</small></span>
        </div>
        <a className="gfoot-site" href={SITE} target="_blank" rel="noopener noreferrer">
          Visit gdgkau.com
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </a>
      </div>
    </footer>
  );
}

export default SiteFooter;
