/* Bottom row of the home page: GDG Game Hub tag on the left, link to the official website on the right */
const SITE = 'https://gdgkau.com';

function SiteFooter() {
  return (
    <footer className="gfoot">
      <div className="gfoot-in gfoot-row">
        <div className="hub">
          <span className="hub-dots" aria-hidden="true"><i style={{ background: '#4285f4' }} /><i style={{ background: '#ea4335' }} /><i style={{ background: '#f9ab00' }} /><i style={{ background: '#34a853' }} /></span>
          <b>GDG Game Hub</b>
          <span className="hub-sep" aria-hidden="true" />
          <span className="hub-soon">Coming soon</span>
        </div>
        <a className="gfoot-site" href={SITE} target="_blank" rel="noopener noreferrer">Visit gdgkau.com <span aria-hidden="true">↗</span></a>
      </div>
    </footer>
  );
}

export default SiteFooter;
