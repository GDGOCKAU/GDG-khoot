import { useState } from 'react';
import { Link } from 'react-router-dom';
import { css } from '../../lib/constants';
import { setAdmin } from '../../lib/store';
import { Brand, ColorBar, Ico, ThemeButton } from '../../components/common/UI';
import { apiRequest } from '../../api/client';

function AdminLogin() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@gdg-kauhoot.local', password: pw }),
      }).then((result) => {
        localStorage.setItem('gdgAdminToken', result.token);
      });
      setError('');
      setAdmin(true);
    } catch (error) {
      /* the server is the only judge: a local password would give an admin screen with no token */
      setError(error.status === 401 ? 'That password is not right. Try again.' : 'Could not reach the server. Try again.');
    }
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
        <ColorBar />
      </form>
    </div>
  );
}

export default AdminLogin;
