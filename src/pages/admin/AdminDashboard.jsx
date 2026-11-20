import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DB, setAdmin, useAppState } from '../../lib/store';
import { EmptyState, Ico, TopicChip } from '../../components/common/UI';
import { AdminShell } from '../../components/layout/Shells';
import { loadQuizzes } from '../../lib/serverQuizzes';

let lastFilter = 'All', lastSearch = '';

function AdminDashboard() {
  useAppState();
  const [filter, setFilterS] = useState(lastFilter);
  const [search, setSearchS] = useState(lastSearch);
  const setFilter = (v) => { lastFilter = v; setFilterS(v); };
  const setSearch = (v) => { lastSearch = v; setSearchS(v); };

  /* quizzes and totals come only from the server (totals: finished games) */
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    /* an expired sign-in goes back to the password page */
    loadQuizzes().then(setStats).catch((error) => { if (error.status === 401) setAdmin(false); else setFailed(true); });
  }, []);

  const games = { length: stats ? stats.gamesHosted : 0 };
  const acc = stats && stats.accuracy !== null ? Math.round(100 * stats.accuracy) + '%' : '—';
  const players = stats ? stats.players : 0;
  const term = search.trim().toLowerCase();
  const list = DB.quizzes.filter((x) => (filter === 'All' || (filter === 'Ready' ? x.status === 'ready' : x.status === 'draft')) && (!term || x.title.toLowerCase().includes(term)));

  return (
    <AdminShell>
      <div className="adm-head">
        <div><h1>Dashboard<span style={{ color: '#ea4335' }}>.</span></h1><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Create quizzes and host live games for GDG KAU events.</p></div>
        <Link className="btn btn-primary dash-new" to="/admin/new"><Ico n="plus" /><span className="full">Create quiz</span><span className="short">New quiz</span></Link>
      </div>
      <div className="stats">
        <div className="card stat" style={{ '--c': '#4285f4' }}><b className="num">{DB.quizzes.length}</b><span>Quizzes</span></div>
        <div className="card stat" style={{ '--c': '#ea4335' }}><b className="num">{games.length}</b><span>Games hosted</span></div>
        <div className="card stat" style={{ '--c': '#f9ab00' }}><b className="num">{players}</b><span>Players so far</span></div>
        <div className="card stat" style={{ '--c': '#34a853' }}><b className="num">{acc}</b><span>Average accuracy</span></div>
      </div>
      {!DB.loaded ? (
        <section className="card tbl-wrap">
          {failed
            ? <EmptyState icon="x" tone="red" title="Could not load your quizzes" text="The server did not answer. Check that it is running, then reload this page."><button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>Reload</button></EmptyState>
            : <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Loading quizzes…</p>}
        </section>
      ) : !DB.quizzes.length ? (
        <section className="card tbl-wrap">
          <EmptyState icon="plusc" title="No quizzes yet" text="Create your first quiz. Once you publish it, it shows on the home page and you can host it live.">
            <Link className="btn btn-primary" to="/admin/new"><Ico n="plus" />Create quiz</Link>
          </EmptyState>
        </section>
      ) : (
      <section className="card tbl-wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Your quizzes</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <label className="sr" htmlFor="dashSearch">Search quizzes</label>
            <input className="input" id="dashSearch" placeholder="Search quizzes" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220, minHeight: 42, fontSize: 14 }} />
            <div className="seg" role="tablist" aria-label="Filter quizzes">
              {['All', 'Ready', 'Drafts'].map((f) => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
          </div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>Quiz</th><th>Topic</th><th>Questions</th><th>Last hosted</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {list.length ? list.map((x) => (
              <tr key={x.id}>
                <td><b>{x.title || 'Untitled quiz'}</b></td>
                <td><TopicChip t={x.topic} /></td>
                <td className="num">{x.questions.length}</td>
                <td style={{ color: 'var(--muted)' }}>{x.lastHosted ? new Date(x.lastHosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'}</td>
                <td>{x.status === 'ready' ? <span className="status" style={{ color: 'var(--green-txt)' }}>Ready</span> : <span className="status" style={{ color: 'var(--muted)' }}>Draft</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {x.status === 'ready'
                    ? <><Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Edit</Link> <Link className="btn btn-primary btn-sm" to={`/host/${x.id}`}>Host live</Link></>
                    : <Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Continue editing</Link>}
                </td>
              </tr>
            )) : <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No quizzes match.</td></tr>}
          </tbody>
        </table></div>
        <div className="qcards">
          {list.length ? list.map((x) => (
            <article key={x.id} className="qcard-m">
              <div className="r1"><h3>{x.title || 'Untitled quiz'}</h3>{x.status === 'ready' ? <span className="status" style={{ color: 'var(--green-txt)' }}>Ready</span> : <span className="status" style={{ color: 'var(--muted)' }}>Draft</span>}</div>
              <div className="r2"><TopicChip t={x.topic} />{x.questions.length} questions · Last hosted {x.lastHosted ? new Date(x.lastHosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'}</div>
              <div className="r3">
                {x.status === 'ready'
                  ? <><Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Edit</Link><Link className="btn btn-primary btn-sm" to={`/host/${x.id}`}>Host live</Link></>
                  : <Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Continue editing</Link>}
              </div>
            </article>
          )) : <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No quizzes match.</p>}
        </div>
      </section>
      )}
    </AdminShell>
  );
}

export default AdminDashboard;
