/* "Import CSV" window on the admin dashboard: pick a file, check the questions, create a draft quiz */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LETTERS, newPin, uid } from '../../lib/constants';
import { addTopic, topicNames, upsertQuiz } from '../../lib/store';
import { importQuizCSV, quizToCSV, downloadText, TEMPLATE_QUIZ } from '../../lib/csvQuiz';
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

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const readFile = (file) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) { setError('That is an Excel file. In Excel or Google Sheets choose File → Download / Save as → CSV, then import the .csv file.'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const r = importQuizCSV(String(fr.result), file.name);
      if (!r.items.length) { setError("No questions found in that file. Make sure it has a header row with a \"Question\" column, or use the template."); return; }
      setError('');
      const names = topicNames();
      const found = names.find((t) => t.toLowerCase() === (r.meta.topic || '').toLowerCase());
      setMeta({ title: r.meta.title, topic: found || r.meta.topic || 'Other', desc: r.meta.desc });
      setRes(r);
    };
    fr.onerror = () => setError('Could not read that file.');
    fr.readAsText(file, 'utf-8');
  };

  const create = () => {
    let topic = meta.topic.trim() || 'Other';
    if (!topicNames().includes(topic)) topic = addTopic(topic).name;
    const quiz = { id: uid(), title: meta.title.trim() || 'Imported quiz', topic, desc: meta.desc.trim(), status: 'draft', pin: newPin(), lastHosted: null, questions: res.items.map((x) => x.q) };
    upsertQuiz(quiz);
    toast(`Imported ${quiz.questions.length} questions. Check them, then publish.`);
    onClose();
    navigate(`/admin/edit/${quiz.id}`);
  };

  const bad = res ? res.items.filter((x) => x.problem).length : 0;
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
            <label className="field"><span>Quiz title</span><input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. Flutter Basics" /></label>
            <label className="field"><span>Topic</span><select className="input" value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })}>{topics.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field imp-desc"><span>Description</span><input className="input" value={meta.desc} onChange={(e) => setMeta({ ...meta, desc: e.target.value })} placeholder="One line about the quiz" /></label>
          </div>
          <p className="imp-sum"><b>{res.items.length}</b> question{res.items.length === 1 ? '' : 's'} found{bad ? <> · <span style={{ color: 'var(--red-txt)' }}>{bad} need{bad === 1 ? 's' : ''} fixing</span> (you can fix {bad === 1 ? 'it' : 'them'} in the editor)</> : ' · all look good'}</p>
          <ol className="imp-list">
            {res.items.map((x, i) => (
              <li key={i} className={x.problem ? 'bad' : ''}>
                <div className="imp-q"><span className="imp-n">{i + 1}</span><b>{x.q.text || <i style={{ color: 'var(--muted)' }}>No question text</i>}</b><span className="chip">{TYPE_LABEL[x.q.type]}</span></div>
                {x.q.type === 'pic'
                  ? <div className="imp-ans"><span className="ok">Word: {x.q.word || '—'}</span></div>
                  : <div className="imp-ans">{x.q.answers.map((a, k) => a ? <span key={k} className={k === x.q.correct ? 'ok' : ''}>{k === x.q.correct && <Ico n="check" s={14} />}{LETTERS[k]}. {a}</span> : null)}</div>}
                {(x.problem || x.notes.length > 0) && <div className="imp-note">Row {x.row}: {[x.problem, ...x.notes].filter(Boolean).join(' · ')}</div>}
              </li>
            ))}
          </ol>
          <div className="imp-foot">
            <button type="button" className="btn btn-outline" onClick={() => setRes(null)}>Choose another file</button>
            <button type="button" className="btn btn-primary" onClick={create}>Create quiz <Ico n="arrow" /></button>
          </div>
        </>}
      </div>
    </div>
  );
}
