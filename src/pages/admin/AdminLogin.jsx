import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_PASSWORD, css } from '../../lib/constants';
import { setAdmin } from '../../lib/store';
import { Brand, ColorBar, Ico, ThemeButton } from '../../components/common/UI';

function AdminLogin() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { setError(''); setAdmin(true); }
    else setError('That password is not right. Try again.');
  };
  return (
    <div className="signin">
      <div className="orb" aria-hidden="true" style={css('background:#4285f4;top:-140px;left:-100px')} />
      <div className="orb" aria-hidden="true" style={css('background:#34a853;bottom:-160px;right:-100px')} />
      <header className="site-nav" style={{ position: 'relative' }}><Brand /><span style={css('display:flex;align-items:center;gap:12px')}><ThemeButton /><Link to="/" style={css('color:var(--muted);font-size:14px;text-decoration:none;white-space:nowrap')}>← Home</Link></span></header>
      <form className="card box" onSubmit={submit} noValidate>
        <span className="sess" style={{ border: 0, padding: 0, margin: 0 }}><span className="lock" style={{ width: 52, height: 52 }}><Ico n="lock" /></span></span>
        <div><h1 style={css('margin:0;font-size:30px;letter-spacing:-.03em')}>Admin sign in</h1><p style={css('margin:8px 0 0;color:var(--muted)')}>Enter the admin password to manage quizzes.</p></div>
        <label className="field"><span>Password</span><input className="input" type="password" id="pwIn" autoComplete="current-password" autoFocus aria-describedby="pwErr" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {error ? <p className="err" id="pwErr" role="alert">{error}</p> : <span id="pwErr" />}
        <button className="btn btn-primary btn-lg" type="submit">Sign in</button>
        <p style={css('margin:0;font-size:13px;color:var(--muted);text-align:center')}>Demo password: <b>{ADMIN_PASSWORD}</b></p>
        <ColorBar />
      </form>
    </div>
  );
}

export default AdminLogin;
