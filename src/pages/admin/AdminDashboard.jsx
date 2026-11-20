import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DB, useAppState } from '../../lib/store';
import { Ico, TopicChip } from '../../components/common/UI';
import { AdminShell } from '../../components/layout/Shells';
import ImportCsv from '../../components/admin/ImportCsv';
import { quizToCSV, downloadText, csvName } from '../../lib/csvQuiz';

/* download one quiz as a CSV file (same layout the importer reads) */
const exportQuiz = (x) => downloadText(csvName(x.title), quizToCSV(x));
const CsvBtn = ({ x }) => <button type="button" className="btn btn-ghost btn-sm csv-btn" onClick={() => exportQuiz(x)} title="Download this quiz as a CSV file" aria-label={`Download ${x.title || 'quiz'} as CSV`}><Ico n="down" s={16} /><span>CSV</span></button>;

let lastFilter = 'All', lastSearch = '';

function AdminDashboard() {
  useAppState();
  const [filter, setFilterS] = useState(lastFilter);
  const [search, setSearchS] = useState(lastSearch);
  const [importing, setImporting] = useState(false);
  const setFilter = (v) => { lastFilter = v; setFilterS(v); };
  const setSearch = (v) => { lastSearch = v; setSearchS(v); };

  const games = DB.games.filter((g) => g.mode === 'host');
  const acc = DB.games.length ? Math.round(100 * DB.games.reduce((s, g) => s + g.accuracy, 0) / DB.games.length) + '%' : '—';
  const players = DB.games.reduce((s, g) => s + g.players, 0);
  const term = search.trim().toLowerCase();
  const list = DB.quizzes.filter((x) => (filter === 'All' || (filter === 'Ready' ? x.status === 'ready' : x.status === 'draft')) && (!term || x.title.toLowerCase().includes(term)));

  return (
    <AdminShell>
      <div className="adm-head">
        <div><h1>Dashboard<span style={{ color: '#ea4335' }}>.</span></h1><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Create quizzes and host live games for GDG KAU events.</p></div>
        <div className="dash-acts">
          <button type="button" className="btn btn-outline dash-imp" onClick={() => setImporting(true)} aria-label="Import quiz from CSV"><Ico n="down" s={18} /><span className="imp-t">Import CSV</span></button>
          <Link className="btn btn-primary dash-new" to="/admin/new"><Ico n="plus" /><span className="full">Create quiz</span><span className="short">New quiz</span></Link>
        </div>
      </div>
      <div className="stats">
        <div className="card stat" style={{ '--c': '#4285f4' }}><b className="num">{DB.quizzes.length}</b><span>Quizzes</span></div>
        <div className="card stat" style={{ '--c': '#ea4335' }}><b className="num">{games.length}</b><span>Games hosted</span></div>
        <div className="card stat" style={{ '--c': '#f9ab00' }}><b className="num">{players}</b><span>Players so far</span></div>
        <div className="card stat" style={{ '--c': '#34a853' }}><b className="num">{acc}</b><span>Average accuracy</span></div>
      </div>
      <section className="card tbl-wrap">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Your quizzes</h2>
          <div className="dash-tools" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <label className="sr" htmlFor="dashSearch">Search quizzes</label>
            <input id="dashSearch" placeholder="Search quizzes" value={search} onChange={(e) => setSearch(e.target.value)} className="input dash-search" style={{ minHeight: 42, fontSize: 14 }} />
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
                    ? <><CsvBtn x={x} /> <Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Edit</Link> <Link className="btn btn-primary btn-sm" to={`/host/${x.id}`}>Host live</Link></>
                    : <><CsvBtn x={x} /> <Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Continue editing</Link></>}
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
                  ? <><CsvBtn x={x} /><Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Edit</Link><Link className="btn btn-primary btn-sm" to={`/host/${x.id}`}>Host live</Link></>
                  : <><CsvBtn x={x} /><Link className="btn btn-outline btn-sm" to={`/admin/edit/${x.id}`}>Continue editing</Link></>}
              </div>
            </article>
          )) : <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No quizzes match.</p>}
        </div>
      </section>
      {importing && <ImportCsv onClose={() => setImporting(false)} />}
    </AdminShell>
  );
}

export default AdminDashboard;
