/* "Thanks for playing!" with the story card and share buttons */
import { Link } from 'react-router-dom';
import { css, fmt, ord } from '../../lib/constants';
import { G, UI, hosted, rankOf } from '../../lib/engine';
import { notify } from '../../lib/store';
import { doShare } from '../../lib/share';
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
  const links = (
    <div className="over-links">
      <button type="button" onClick={() => { UI.showOver = false; notify(); }}>Leaderboard</button><span aria-hidden="true">·</span>
      <Link to={again} onClick={() => { UI.look = null; }}>Play again</Link><span aria-hidden="true">·</span>
      <Link to="/">Home</Link>
    </div>
  );
  const msg = <p style={{ margin: 0, color: 'var(--muted)', fontSize: wide ? 16 : 15, lineHeight: 1.6 }}>You finished <b style={{ color: 'var(--ink)' }}>{ord(rk)}</b> with <b style={{ color: 'var(--ink)' }} className="num">{fmt(me.score)} points</b>. Great job!</p>;

  if (wide) {
    return (
      <LapShell right={<MePill p={me} />} center main="over">
        <div className="over-grid">
          <div className="story-wrap big"><Story kind={tab} /></div>
          <section style={css('display:flex;flex-direction:column;gap:22px')}>
            <div style={css('display:flex;flex-direction:column;gap:8px')}>
              <div className="eyebrow" style={{ letterSpacing: '.08em' }}>Game over</div>
              <h1 style={{ fontSize: 44, letterSpacing: '-.035em' }}>Thanks for playing<span style={{ color: '#ea4335' }}>!</span></h1>
              {msg}
            </div>
            <div>{tabs}</div>
            <div style={css('display:flex;flex-direction:column;gap:10px')}>
              <button type="button" className="btn btn-primary over-btn" onClick={() => doShare('share', tab)}><Ico n="share" s={20} />Share</button>
              <button type="button" className="btn btn-outline over-btn" onClick={() => doShare('saveImg', tab)}><Ico n="down" s={20} />Save image</button>
              <button type="button" className="btn btn-outline over-btn" onClick={() => doShare('copyLink', tab)}><Ico n="copy" s={20} />Copy link</button>
            </div>
            {links}
          </section>
        </div>
      </LapShell>
    );
  }
  return (
    <div className="pl">
      <header className="pl-head"><div className="in"><Brand /><span className="chip">Game over</span></div></header>
      <main className="pl-in" style={{ textAlign: 'center', alignItems: 'center', gap: 14 }}>
        <div style={css('display:flex;flex-direction:column;gap:4px')}>
          <h1 style={{ fontSize: 28 }}>Thanks for playing<span style={{ color: '#ea4335' }}>!</span></h1>
          {msg}
        </div>
        {tabs}
        <div className="story-wrap small"><Story kind={tab} /></div>
        <div style={css('width:100%;display:flex;gap:8px')}>
          <button type="button" className="btn btn-primary" style={css('flex:1 1 0;min-height:50px')} onClick={() => doShare('share', tab)}><Ico n="share" s={18} />Share</button>
          <button type="button" className="btn btn-outline" style={css('flex:1 1 0;min-height:50px')} onClick={() => doShare('saveImg', tab)}>Save image</button>
        </div>
        {links}
      </main>
      <ColorBar />
    </div>
  );
}

export default GameOver;
