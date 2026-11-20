/* Catches a render error anywhere below it and shows a message in the GameClosed / JoinError look
   instead of a blank page. Reset by changing `resetKey` (App passes the path). */
import { Component } from 'react';
import { css } from '../../lib/constants';
import { isWide } from '../../lib/ui';
import { Brand, ColorBar, Ico } from './UI';
import { LapShell } from '../layout/Shells';

function Oops({ admin }) {
  const wide = isWide();
  const home = admin ? '/admin' : '/';
  const inner = (
    <div className="center-col" role="alert">
      <span className="big-ring" style={css('background:var(--red-soft);color:var(--red-txt);width:110px;height:110px')}><Ico n="x" s={52} /></span>
      <h1 style={{ fontSize: wide ? 52 : 34 }}>Something went wrong</h1>
      <p style={css('margin:0;color:var(--muted);font-size:17px;max-width:30rem')}>
        {admin ? 'This page hit an error. Your saved quizzes are safe on the server.' : 'This page hit an error. Reload to get back in.'}
      </p>
      <div style={css('display:flex;gap:10px;flex-wrap:wrap;justify-content:center')}>
        <button type="button" className="btn btn-outline btn-lg" onClick={() => window.location.reload()}>Reload page</button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => window.location.assign(home)}>{admin ? 'Back to dashboard' : 'Go to the home page'} <Ico n="arrow" /></button>
      </div>
    </div>
  );
  if (wide) return <LapShell center>{inner}</LapShell>;
  return (
    <div className="pl">
      <header className="pl-head"><div className="in"><Brand /><span className="chip">Error</span></div></header>
      <main className="pl-in">{inner}</main>
      <ColorBar />
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, key: props.resetKey }; }
  static getDerivedStateFromError(error) { return { error }; }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error, info) { console.error('[KAUHOOT] page error', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    try { return <Oops admin={String(this.props.resetKey || '').startsWith('/admin')} />; }
    catch { return <p style={{ padding: 24 }}>Something went wrong. Please reload the page.</p>; }
  }
}

export default ErrorBoundary;
