/* "Import CSV" window on the admin dashboard: pick a file, check the questions, create a draft quiz on the server */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LETTERS, newPin, uid } from '../../lib/constants';
import { addTopic, topicNames, upsertQuiz } from '../../lib/store';
import { importQuizCSV, quizToCSV, downloadText, TEMPLATE_QUIZ, LIMITS } from '../../lib/csvQuiz';
import { saveQuizToServer } from '../../lib/quizPayload';
import { fromServer } from '../../lib/serverQuizzes';
import { toast } from '../../lib/ui';
import { Ico } from '../common/UI';

const TYPE_LABEL = { mc: 'Multiple choice', tf: 'True / False', code: 'Code', pic: 'Picture' };

export default function ImportCsv({ onClose }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [meta, setMeta] = useState({ title: '', topic: 'Other', desc: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const readFile = (file) => {
    if (!file) return;
    const excel = 'That is an Excel file. In Excel or Google Sheets choose File → Download / Save as → CSV, then import the .csv file.';
    if (/\.xlsx?$/i.test(file.name)) { setError(excel); return; }
    if (file.size > LIMITS.file) { setError(`That file is ${(file.size / 1048576).toFixed(1)} MB. A quiz CSV is far smaller (the limit is 1 MB): check it is the right file.`); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const text = String(fr.result);
      /* a renamed spreadsheet or picture: zip header or binary bytes, not text */
      if (text.startsWith('PK')) { setError(excel); return; }
      if (text.includes('\u0000') || (text.match(/\uFFFD/g) || []).length > 20) { setError('That file is not a text CSV. Save the sheet as CSV (UTF-8) and import that file.'); return; }
      let r;
      try { r = importQuizCSV(text, file.name); } catch { setError('That file could not be read as a CSV.'); return; }
      if (!r.items.length) { setError("No questions found in that file. Make sure it has a header row with a \"Question\" column, or use the template."); return; }
      if (r.items.length > LIMITS.questions) { setError(`That file has ${r.items.length} questions. A quiz can have up to ${LIMITS.questions}: split it into smaller quizzes.`); return; }
      setError('');
      const names = topicNames();
      const found = names.find((t) => t.toLowerCase() === (r.meta.topic || '').toLowerCase());
      setMeta({ title: r.meta.title.slice(0, LIMITS.title), topic: (found || r.meta.topic || 'Other').slice(0, LIMITS.topic), desc: r.meta.desc.slice(0, LIMITS.desc) });
      setRes(r);
    };
    fr.onerror = () => setError('Could not read that file.');
    fr.readAsText(file, 'utf-8');
  };

  /* saved on the server as a draft (the same save the editor uses); the server checks every row again */
  const create = async () => {
    if (saving || blocked) return;
    let topic = meta.topic.trim() || 'Other';
    if (!topicNames().includes(topic)) topic = addTopic(topic).name;
    const quiz = { id: uid(), title: meta.title.trim() || 'Imported quiz', topic, desc: meta.desc.trim(), status: 'draft', pin: newPin(), lastHosted: null, questions: res.items.map((x) => x.q) };
    setSaving(true); setError('');
    try {
      const saved = await saveQuizToServer(quiz);
      upsertQuiz(fromServer(saved));
      toast(`Imported ${saved.questions.length} questions as a draft. Check them, then publish.`);
      onClose();
      navigate(`/admin/edit/${saved.id}`);
    } catch (err) {
      setSaving(false);
      if (err.status === 401) { setError('Your admin sign-in has expired. Sign in again, then import the file.'); return; }
      /* point at the rows the server refused ("questions.3.text" -> the 4th question) */
      const issues = err.body?.issues || [];
      const byRow = {};
      issues.forEach((i) => { const m = /^questions\.(\d+)\.(\w+)/.exec(i.path); if (m) (byRow[+m[1]] ||= []).push(`${m[2] === 'timeLimitSecs' ? 'time' : m[2]}: ${i.message}`); });
      const rows = Object.keys(byRow);
      if (rows.length) setRes({ ...res, items: res.items.map((x, k) => (byRow[k] ? { ...x, limit: `server refused it (${byRow[k].join('; ')})` } : x)) });
      const quizLevel = issues.filter((i) => !i.path.startsWith('questions.')).map((i) => `${i.path || 'quiz'}: ${i.message}`);
      setError(rows.length ? `The server refused ${rows.length} question${rows.length === 1 ? '' : 's'} (marked in red). Fix ${rows.length === 1 ? 'it' : 'them'} in the file and import again.`
        : quizLevel.length ? `The server refused the quiz: ${quizLevel.join('; ')}.`
          : 'Could not save the quiz to the server. Check the server is running and try again.');
    }
  };

  const bad = res ? res.items.filter((x) => x.problem && !x.limit).length : 0;
  const blocked = res ? res.items.filter((x) => x.limit).length : 0;
  const topics = [...new Set([...topicNames(), meta.topic].filter(Boolean))];

  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal imp" role="dialog" aria-modal="true" aria-labelledby="impTitle">
        <div className="imp-head">
          <h2 id="impTitle">{res ? 'Check the questions' : 'Import a quiz from CSV'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Ico n="x" /></button>
        </div>

        {!res ? <>
          <p>One question per row. Columns: <b>Question</b>, <b>Answer A–D</b>, <b>Correct</b> (a letter or the answer text), and optional <b>Type</b>, <b>Time</b>, <b>Points</b>, <b>Code</b>, <b>Language</b>. Kahoot spreadsheets work too.</p>
          <label className={`imp-drop${drag ? ' on' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="sr" onChange={(e) => { readFile(e.target.files[0]); e.target.value = ''; }} />
            <span className="imp-ic"><Ico n="down" /></span>
            <b>Choose a CSV file</b>
            <span>or drop it here</span>
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="imp-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText('kauhoot-template.csv', quizToCSV(TEMPLATE_QUIZ))}><Ico n="down" s={16} />Download template</button>
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current && fileRef.current.click()}>Choose file</button>
          </div>
        </> : <>
          <div className="imp-meta">
            <label className="field"><span>Quiz title</span><input className="input" maxLength={LIMITS.title} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. Flutter Basics" /></label>
            <label className="field"><span>Topic</span><select className="input" value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })}>{topics.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field imp-desc"><span>Description</span><input className="input" maxLength={LIMITS.desc} value={meta.desc} onChange={(e) => setMeta({ ...meta, desc: e.target.value })} placeholder="One line about the quiz" /></label>
          </div>
          <p className="imp-sum"><b>{res.items.length}</b> question{res.items.length === 1 ? '' : 's'} found
            {blocked ? <> · <span style={{ color: 'var(--red-txt)' }}>{blocked} must be fixed in the file</span></> : null}
            {bad ? <> · <span style={{ color: 'var(--red-txt)' }}>{bad} need{bad === 1 ? 's' : ''} fixing</span> (you can fix {bad === 1 ? 'it' : 'them'} in the editor)</> : null}
            {!bad && !blocked ? ' · all look good' : null}</p>
          <ol className="imp-list">
            {res.items.map((x, i) => (
              <li key={i} className={x.problem || x.limit ? 'bad' : ''}>
                <div className="imp-q"><span className="imp-n">{i + 1}</span><b>{x.q.text || <i style={{ color: 'var(--muted)' }}>No question text</i>}</b><span className="chip">{TYPE_LABEL[x.q.type]}</span></div>
                {x.q.type === 'pic'
                  ? <div className="imp-ans"><span className="ok">Word: {x.q.word || '—'}</span></div>
                  : <div className="imp-ans">{x.q.answers.map((a, k) => a ? <span key={k} className={k === x.q.correct ? 'ok' : ''}>{k === x.q.correct && <Ico n="check" s={14} />}{LETTERS[k]}. {a}</span> : null)}</div>}
                {(x.limit || x.problem || x.notes.length > 0) && <div className="imp-note">Row {x.row}: {[x.limit, x.problem, ...x.notes].filter(Boolean).join(' · ')}</div>}
              </li>
            ))}
          </ol>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="imp-foot">
            <button type="button" className="btn btn-outline" onClick={() => { setRes(null); setError(''); }}>Choose another file</button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={saving || blocked > 0} title={blocked ? 'Fix the red rows in the file first' : undefined}>{saving ? 'Saving…' : 'Create quiz'} <Ico n="arrow" /></button>
          </div>
        </>}
      </div>
    </div>
  );
}
