/* Share menu shown when the phone's own share menu isn't available (e.g. on an http page or a computer) */
import { useEffect, useState } from 'react';
import { SHARE_URL, shareText } from '../../lib/share';
import { copyText } from '../../lib/ui';
import { Ico } from '../common/UI';

const enc = encodeURIComponent;
function targets(text, url) {
  return [
    { id: 'wa', name: 'WhatsApp', bg: '#25d366', href: `https://wa.me/?text=${enc(text + ' ' + url)}`, icon: <Ico n="wa" s={26} /> },
    { id: 'x', name: 'X', bg: '#000000', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, icon: <Ico n="xlogo" s={22} /> },
    { id: 'tg', name: 'Telegram', bg: '#229ed9', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, icon: <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.1 1.4 11.6c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5z" /></svg> },
    { id: 'sms', name: 'Messages', bg: '#34c759', href: `sms:?&body=${enc(text + ' ' + url)}`, icon: <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L4.6 21l4.2-2.3c1 .2 2.1.3 3.2.3 5.5 0 10-3.6 10-8s-4.5-8-10-8z" /></svg> },
    { id: 'mail', name: 'Email', bg: '#1a73e8', href: `mailto:?subject=${enc('GDG KAUHOOT')}&body=${enc(text + '\n\n' + url)}`, icon: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg> },
  ];
}

export default function ShareSheet({ kind, onClose }) {
  const text = shareText(kind), url = SHARE_URL;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const copy = async () => { if (await copyText(text + ' ' + url)) { setCopied(true); setTimeout(onClose, 900); } };
  return (
    <div className="sheet-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
        <span className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head"><h2 id="shareTitle">Share</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Ico n="x" /></button></div>
        <div className="sheet-preview"><p>{text}</p><span>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span></div>
        <div className="sheet-grid">
          {targets(text, url).map((t) => (
            <a key={t.id} href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 300)}>
              <span className="sheet-ic" style={{ background: t.bg }}>{t.icon}</span><span>{t.name}</span>
            </a>
          ))}
          <button type="button" onClick={copy}>
            <span className="sheet-ic copy"><Ico n={copied ? 'check' : 'copy'} s={22} /></span><span>{copied ? 'Copied!' : 'Copy link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
