/* "Thanks for playing!" with the story card and share buttons */
import { Link } from 'react-router-dom';
import { css, fmt, ord } from '../../lib/constants';
import { G, UI, hosted, rankOf } from '../../lib/engine';
import { notify } from '../../lib/store';
import { doShare, shareLink } from '../../lib/share';
import { useWide } from '../../lib/ui';
import { Brand, ColorBar, Ico, MePill } from '../../components/common/UI';
import { Story } from '../../components/game/Blocks';
import { LapShell } from '../../components/layout/Shells';

function GameOver() {
  const wide = useWide();
  const me = G.me, rk = rankOf(me);
  const tab = UI.overTab || (rk <= 3 ? 'top' : 'me');
  const again = hosted() ? '/' : `/join/${G.quiz.id}`;
  const setTab = (v) => { UI.overTab = v; notify(); };

  const tabs = (
    <div className="seg" role="tablist" aria-label="Card">
      <button type="button" role="tab" aria-selected={tab === 'me'} onClick={() => setTab('me')}>My result</button>
      <button type="button" role="tab" aria-selected={tab === 'top'} onClick={() => setTab('top')}>Top 3</button>
    </div>
  );
  const shareBtns = <>
    <button type="button" className="btn btn-primary btn-lg" onClick={() => doShare('shareStory', tab)}><Ico n="share" />Share to story</button>
    <div className="share-row">
      <a href={shareLink('x', tab)} target="_blank" rel="noopener noreferrer"><span className="ic" style={{ background: '#000', color: '#fff' }}><Ico n="xlogo" /></span>X</a>
      <a href={shareLink('wa', tab)} target="_blank" rel="noopener noreferrer"><span className="ic" style={{ background: '#25d366', color: '#fff' }}><Ico n="wa" /></span>WhatsApp</a>
      <button type="button" onClick={() => doShare('copyLink', tab)}><span className="ic" style={{ background: 'var(--blue-soft)', color: 'var(--blue-txt)' }}><Ico n="copy" /></span>Copy link</button>
      <button type="button" onClick={() => doShare('saveImg', tab)}><span className="ic" style={{ background: 'var(--green-soft)', color: 'var(--green-txt)' }}><Ico n="down" /></span>Save image</button>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { UI.showOver = false; notify(); }}>Leaderboard</button>
      <Link className="btn btn-outline" style={{ flex: 1 }} to={again} onClick={() => { UI.look = null; }}>Play again</Link>
      <Link className="btn btn-ghost" style={{ flex: 1 }} to="/">Home</Link>
    </div>
  </>;
  const title = <>
    <h1 style={{ fontSize: wide ? 48 : 30 }}>Thanks for playing<span style={{ color: '#ea4335' }}>!</span></h1>
    <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: wide ? 18 : 16 }}>You finished <b style={{ color: 'var(--ink)' }}>{ord(rk)}</b> with <b style={{ color: 'var(--ink)' }} className="num">{fmt(me.score)} points</b>. Great job!</p>
  </>;

  if (wide) {
    return (
      <LapShell right={<MePill p={me} />} center>
        <div className="over-grid">
          <div className="story-wrap big"><Story kind={tab} /></div>
          <div style={css('display:flex;flex-direction:column;gap:18px')}>
            <div><div className="eyebrow">Game over</div>{title}</div>
            <div>{tabs}</div>
            {shareBtns}
          </div>
        </div>
      </LapShell>
    );
  }
  return (
    <div className="pl">
      <header className="pl-head"><div className="in"><Brand /><span className="chip">Game over</span></div></header>
      <main className="pl-in" style={{ textAlign: 'center', alignItems: 'stretch' }}>
        <div>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{tabs}</div>
        <div className="story-wrap"><Story kind={tab} /></div>
        {shareBtns}
      </main>
      <ColorBar />
    </div>
  );
}

export default GameOver;
