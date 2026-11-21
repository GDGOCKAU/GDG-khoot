/* Copies the audience screen link (/screen). One link for every quiz: the screen follows whichever game is live. */
import { copyText, toast } from '../../lib/ui';
import { Ico } from './UI';

export const SCREEN_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/screen`;

export default function ScreenLinkButton({ className = 'btn btn-outline', short }) {
  const copy = async () => toast((await copyText(SCREEN_URL)) ? 'Screen link copied. Open it on the big screen.' : 'Could not copy the link');
  return <button type="button" className={className} onClick={copy} title={SCREEN_URL}><Ico n="copy" s={18} /><span className="imp-t">{short ? 'Screen link' : 'Copy screen link'}</span></button>;
}
