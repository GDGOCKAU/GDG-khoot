/* Create / edit a quiz: /admin/new and /admin/edit/:quizId. Saves itself as you type. */
import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LETTERS, ansCls, css, newPin, uid } from '../../lib/constants';
import { LANGS, QTYPES, blankQ, norm, qProblem, qType, setQType } from '../../lib/questions';
import { DB, addTopic, deleteQuiz, quizById, topicNames, upsertQuiz } from '../../lib/store';
import { UI } from '../../lib/engine';
import { shrinkImage, toast } from '../../lib/ui';
import { Dots, Ico, Modal } from '../../components/common/UI';
import { Boxes } from '../../components/game/Blocks';
import { AdminShell } from '../../components/layout/Shells';

/* the open editor survives moving away and back, like the prototype */
let E = null;
function openEditor(quiz) {
  const forId = quiz ? quiz.id : 'new';
  if (!E || E.forId !== forId) {
    E = { forId, cur: 0, saved: !!quiz, draft: quiz ? JSON.parse(JSON.stringify(quiz)) : { id: uid(), title: '', topic: 'Mobile', desc: '', status: 'draft', pin: newPin(), lastHosted: null, questions: [blankQ()] } };
  }
  return E;
}

function CreateQuiz({ quiz }) {
  const navigate = useNavigate();
  const ed = openEditor(quiz);
  const d = ed.draft;
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [saveState, setSaveState] = useState(ed.saved ? (d.status === 'ready' ? 'All changes saved' : 'Draft saved') : 'Not saved yet');
  const [addingTopic, setAddingTopic] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const saveT = useRef(0);
  const textRef = useRef(null);
  const focusText = useRef(false);
  const isNew = ed.forId === 'new' && !quiz;
  /* a published quiz is edited with Save / Discard, like the design; drafts save themselves */
  const stored = quizById(d.id);
  const manual = !!stored && stored.status === 'ready';
  if (ed.dirty == null) ed.dirty = 0;
  const lastGame = DB.games.filter((g) => g.quizId === d.id).slice(-1)[0];

  if (ed.cur >= d.questions.length) ed.cur = d.questions.length - 1;
  const qq = d.questions[ed.cur];
  const T = qType(qq);
  const bad = d.questions.filter(qProblem).length;

  useEffect(() => () => clearTimeout(saveT.current), []);
  useEffect(() => { if (focusText.current && textRef.current) { focusText.current = false; textRef.current.focus(); } });

  function persistDraft() {
    upsertQuiz(d);
    ed.saved = true;
    setSaveState(d.status === 'ready' ? 'All changes saved' : 'Draft saved');
    if (ed.forId === 'new') { ed.forId = d.id; navigate('/admin/edit/' + d.id, { replace: true }); }
  }
  function softSave() {
    setSaveState('Saving…');
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      if (d.status === 'ready' && d.questions.some(qProblem)) { setSaveState('Fix the marked questions to save'); return; }
      persistDraft();
    }, 500);
  }
  const change = (fn) => { fn(); if (manual) ed.dirty += 1; else softSave(); rerender(); };
  function saveChanges() {
    if (!d.title.trim()) { toast('Give the quiz a title.'); document.querySelector('[data-f="title"]')?.focus(); return; }
    const i = d.questions.findIndex(qProblem);
    if (i >= 0) { ed.cur = i; rerender(); toast(`Question ${i + 1} ${qProblem(d.questions[i])}.`); return; }
    upsertQuiz(d); ed.dirty = 0; rerender(); toast('Changes saved');
  }
  function discard() {
    ed.draft = JSON.parse(JSON.stringify(stored)); ed.dirty = 0; ed.cur = Math.min(ed.cur, ed.draft.questions.length - 1);
    rerender(); toast('Changes discarded');
  }
  function duplicateQuiz() {
    const copy = { ...JSON.parse(JSON.stringify(d)), id: uid(), pin: newPin(), title: `${d.title || 'Untitled quiz'} (copy)`, status: 'draft', lastHosted: null };
    upsertQuiz(copy); E = null;
    navigate('/admin/edit/' + copy.id);
    toast('Quiz duplicated as a draft');
  }
  const setQ = (k, v) => change(() => { qq[k] = v; });

  function doAddTopic(name) {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) { toast('Type a topic name.'); document.getElementById('topicIn')?.focus(); return; }
    const r = addTopic(n);
    if (r.added) toast(`Topic “${r.name}” added`);
    setAddingTopic(false);
    change(() => { d.topic = r.name; });
  }
  function publish() {
    if (!d.title.trim()) { toast('Give the quiz a title.'); document.querySelector('[data-f="title"]')?.focus(); return; }
    const i = d.questions.findIndex(qProblem);
    if (i >= 0) { ed.cur = i; rerender(); toast(`Question ${i + 1} ${qProblem(d.questions[i])}.`); return; }
    const wasReady = d.status === 'ready';
    clearTimeout(saveT.current);
    d.status = 'ready'; upsertQuiz(d); E = null;
    navigate('/admin');
    toast(wasReady ? 'Changes saved' : 'Quiz published. It now shows on the home page.');
  }
  function preview() {
    if (!d.questions.some((x) => !qProblem(x))) { toast('Add at least one complete question to preview.'); return; }
    clearTimeout(saveT.current);
    upsertQuiz(d); ed.saved = true; if (ed.forId === 'new') ed.forId = d.id;
    UI.look = null; navigate('/join/' + d.id);
  }
  async function pickImage(e, max, apply) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const data = await shrinkImage(f, max);
    if (!data) { toast('That image could not be read.'); return; }
    change(() => apply(data));
  }

  const answers = qq.answers.map((a, i) => (
    <label key={i} className={`ans ${ansCls(i)}${qq.correct === i ? ' right' : ''}`}>
      <span className="L">{LETTERS[i]}</span>
      <input type="text" value={a} placeholder={`${T === 'code' ? 'Output' : 'Answer'} ${i + 1}${i > 1 ? ' (optional)' : ''}`} maxLength={80} onChange={(e) => change(() => { qq.answers[i] = e.target.value; })} />
      <input type="radio" name="correct" checked={qq.correct === i} onChange={() => setQ('correct', i)} aria-label={`Mark ${LETTERS[i]} as correct`} />
    </label>
  ));
  const imgDrop = (
    <label className="img-drop">
      {qq.img
        ? <><img src={qq.img} alt="Question image" /><button type="button" className="btn btn-outline btn-sm" style={css('position:absolute;top:10px;right:10px')} onClick={(e) => { e.preventDefault(); setQ('img', null); }}>Remove</button></>
        : <><Ico n="image" />Add an image (optional)</>}
      <input type="file" accept="image/*" className="sr" onChange={(e) => pickImage(e, 800, (data) => { qq.img = data; })} />
    </label>
  );

  let body;
  if (T === 'mc') body = <>{imgDrop}<div><span className="label" style={css('display:block;margin-bottom:10px')}>Answers · select the correct one</span><div className="ans-grid">{answers}</div></div></>;
  else if (T === 'tf') body = <>{imgDrop}<div>
    <span className="label" style={css('display:block;margin-bottom:10px')}>Answer · pick the correct one</span>
    <div className="ans-grid">{[0, 1].map((i) => (
      <label key={i} className={`ans ${ansCls(i)}${qq.correct === i ? ' right' : ''}`} style={{ padding: 14 }}>
        <span className="L"><Ico n={i ? 'x' : 'check'} s={22} /></span><span style={css('flex:1;font-size:18px;font-weight:600')}>{i ? 'False' : 'True'}</span>
        <input type="radio" name="correct" checked={qq.correct === i} onChange={() => setQ('correct', i)} aria-label={`${i ? 'False' : 'True'} is correct`} />
      </label>
    ))}</div>
    <p style={css('margin:8px 0 0;font-size:13px;color:var(--muted)')}>Players only see these two buttons.</p>
  </div></>;
  else if (T === 'code') {
    const code = qq.code || '', n = code.split('\n').length;
    body = <>
      <div className="field"><span style={css('display:flex;justify-content:space-between;gap:8px')}><span>Code</span><span style={css('font-size:12px;color:var(--muted);font-weight:400')}>Shown on the host screen · players can open it</span></span>
        <div className="codebox codeedit" style={{ '--fs': '15px' }}>
          <div className="codebar"><Dots /><select value={qq.lang || 'Dart'} onChange={(e) => setQ('lang', e.target.value)} aria-label="Code language">{LANGS.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="codebody"><pre className="ln" aria-hidden="true">{Array.from({ length: n }, (_, i) => i + 1).join('\n')}</pre>
            <textarea spellCheck="false" aria-label="Code" rows={Math.max(6, n + 1)} value={code} onChange={(e) => setQ('code', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const el = e.target, a = el.selectionStart; el.setRangeText('  ', a, el.selectionEnd, 'end'); setQ('code', el.value); } }} />
          </div>
        </div>
      </div>
      <div><span className="label" style={css('display:block;margin-bottom:10px')}>Answers · select the correct output</span><div className="ans-grid mono">{answers}</div></div>
    </>;
  } else {
    const pics = qq.pics || [];
    body = <>
      <div className="field"><span>Pictures · players put them together into one word</span>
        <div className="picrow">
          {pics.map((src, i) => [
            i ? <span key={'p' + i} className="pplus" aria-hidden="true"><Ico n="plus" /></span> : null,
            <div key={'t' + i} className="pthumb"><img src={src} alt={`Picture ${i + 1}`} /><span className="pn">{i + 1}</span><button type="button" className="px" onClick={() => change(() => { qq.pics.splice(i, 1); })} aria-label={`Remove picture ${i + 1}`}>×</button></div>,
          ])}
          <label className="padd"><Ico n="plus" /><span>Add picture</span><input type="file" accept="image/*" className="sr" onChange={(e) => pickImage(e, 400, (data) => { (qq.pics = qq.pics || []).push(data); })} /></label>
        </div>
        <span style={css('font-size:12px;color:var(--muted);font-weight:400')}>New pictures go on the right. Players read them from left to right.</span>
      </div>
      <label className="field"><span>Answer · the word players type</span><input className="input" value={qq.word || ''} placeholder="e.g. DOORMAN" maxLength={20} autoComplete="off" style={css('font-weight:700;letter-spacing:.12em')} onChange={(e) => setQ('word', e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))} /></label>
      <div><div className="boxes" style={{ justifyContent: 'flex-start' }}><Boxes word={qq.word || ''} mode="reveal" /></div><p style={css('margin:8px 0 0;font-size:12px;color:var(--muted)')}>{norm(qq.word).length} letters · players see empty boxes and type the word in</p></div>
    </>;
  }

  return (
    <AdminShell>
      <div className="adm-head">
        <div>
          <Link to="/admin" style={css('color:var(--muted);font-size:14px;text-decoration:none')}>← Back to dashboard</Link>
          <h1 style={{ marginTop: 8 }}>{isNew ? 'Create a quiz' : 'Edit quiz'}<span style={{ color: '#ea4335' }}>.</span></h1>
          {!isNew && (
            <div className="ed-status">
              {stored && stored.status === 'ready' ? <span className="st" style={{ color: 'var(--green-txt)' }}>Published</span> : <span className="st">Draft</span>}
              <span>·</span>
              <span>{d.lastHosted ? `Last hosted ${new Date(d.lastHosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${lastGame ? ` · ${lastGame.players} players` : ''}` : 'Never hosted'}</span>
            </div>
          )}
        </div>
        <div style={css('display:flex;flex-wrap:wrap;gap:10px;align-items:center')}>
          {manual ? <>
            {ed.dirty > 0 && <span className="unsaved">{ed.dirty} unsaved change{ed.dirty > 1 ? 's' : ''}</span>}
            <button type="button" className="btn btn-outline" onClick={discard} disabled={!ed.dirty}>Discard</button>
            <button type="button" className="btn btn-primary" onClick={saveChanges}>Save changes</button>
          </> : <>
            <span style={css('font-size:14px;color:var(--muted)')}>{saveState}</span>
            <button type="button" className="btn btn-outline" onClick={preview}>Preview</button>
            <button type="button" className="btn btn-primary" onClick={publish}>Publish quiz</button>
          </>}
        </div>
      </div>
      <section className="card" style={{ padding: 24 }}><div className="three">
        <label className="field"><span>Quiz title</span><input className="input" data-f="title" value={d.title} placeholder="e.g. Flutter Basics" maxLength={60} autoFocus={isNew} onChange={(e) => change(() => { d.title = e.target.value; })} /></label>
        {addingTopic
          ? <div className="field"><label htmlFor="topicIn">New topic</label><div style={{ display: 'flex', gap: 8 }}>
              <input className="input" id="topicIn" maxLength={20} placeholder="e.g. Cybersecurity" autoComplete="off" style={{ flex: 1, minWidth: 0 }} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAddTopic(e.target.value); } if (e.key === 'Escape') setAddingTopic(false); }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => doAddTopic(document.getElementById('topicIn').value)}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingTopic(false)}>Cancel</button>
            </div></div>
          : <div className="field"><label htmlFor="topicSel">Topic</label><div style={{ display: 'flex', gap: 8 }}>
              <select id="topicSel" className="input" style={{ flex: 1, minWidth: 0 }} value={d.topic} onChange={(e) => { if (e.target.value === '__new') setAddingTopic(true); else change(() => { d.topic = e.target.value; }); }}>
                {topicNames().map((t) => <option key={t}>{t}</option>)}<option value="__new">+ Add a topic…</option>
              </select>
              <button type="button" className="topic-add" onClick={() => setAddingTopic(true)} aria-label="Add a topic" title="Add a topic"><Ico n="plus" /></button>
            </div></div>}
        <label className="field"><span>Description</span><input className="input" value={d.desc} placeholder="One line about the quiz" maxLength={90} onChange={(e) => change(() => { d.desc = e.target.value; })} /></label>
      </div></section>
      <nav className="card qnav" aria-label="Questions">
        {d.questions.map((x, i) => (
          <button key={i} type="button" className={`qn${i === ed.cur ? ' on' : ''}${qProblem(x) ? ' bad' : ''}`} onClick={() => { ed.cur = i; rerender(); }} aria-label={`Question ${i + 1}${qProblem(x) ? ', ' + qProblem(x) : ''}`} aria-current={i === ed.cur}>{i + 1}</button>
        ))}
        <button type="button" className="add" onClick={() => { focusText.current = true; change(() => { d.questions.push(blankQ()); ed.cur = d.questions.length - 1; }); }} aria-label="Add question">+</button>
        <span className="info">{d.questions.length} question{d.questions.length > 1 ? 's' : ''}{bad ? <> · <span style={{ color: 'var(--red-txt)' }}>{bad} need{bad > 1 ? '' : 's'} fixing</span></> : null}</span>
      </nav>
      <section className="card" style={css('padding:28px;display:flex;flex-direction:column;gap:20px')}>
        <div style={css('display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px')}><h2 style={css('margin:0;font-size:20px;font-weight:600')}>Question {ed.cur + 1}</h2>
          <span className="qhead-tools">
            <span className="seg qtype" role="tablist" aria-label="Question type">{QTYPES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={T === k} onClick={() => change(() => setQType(qq, k))}>{l}</button>)}</span>
            <button type="button" className="icon-btn" onClick={() => { change(() => { d.questions.splice(ed.cur + 1, 0, JSON.parse(JSON.stringify(qq))); ed.cur += 1; }); toast('Question duplicated'); }} aria-label="Duplicate question"><Ico n="copy" s={16} /></button>
            <button type="button" className="icon-btn" style={{ color: 'var(--red-txt)' }} onClick={() => { if (d.questions.length < 2) return; change(() => { d.questions.splice(ed.cur, 1); ed.cur = Math.max(0, ed.cur - 1); }); toast('Question deleted'); }} aria-label="Delete question" disabled={d.questions.length < 2}><Ico n="trash" s={16} /></button>
          </span>
        </div>
        <label className="field"><span>Question</span><textarea ref={textRef} className="input" rows={2} maxLength={160} value={qq.text} onChange={(e) => setQ('text', e.target.value)}
          placeholder={T === 'code' ? 'e.g. What does this code print?' : T === 'pic' ? 'e.g. Put the pictures together. What is the word?' : T === 'tf' ? 'Type a statement that is true or false' : 'Type your question'} /></label>
        {body}
        <div className="three" style={css('border-top:1px solid var(--border);padding-top:20px')}>
          <label className="field"><span>Time limit</span><select className="input" value={qq.time} onChange={(e) => setQ('time', +e.target.value)}>{[5, 10, 15, 20, 30, 60].map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></label>
          <label className="field"><span>Points</span><select className="input" value={qq.points} onChange={(e) => setQ('points', +e.target.value)}>{[[1, 'Standard (1,000)'], [2, 'Double (2,000)'], [0, 'No points']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
      </section>
      {!isNew && (
        <section className="danger-zone">
          <div><h2>Delete this quiz</h2><p>Removes the quiz and its questions.</p></div>
          <div style={css('display:flex;gap:10px;flex-wrap:wrap')}>
            <button type="button" className="btn btn-outline" onClick={duplicateQuiz}>Duplicate quiz</button>
            <button type="button" className="btn btn-danger" style={{ fontWeight: 600 }} onClick={() => setAskDelete(true)}>Delete quiz</button>
          </div>
        </section>
      )}
      {askDelete && (
        <Modal id="delT" icon="trash" title="Are you sure you want to delete the quiz?" onClose={() => setAskDelete(false)}>
          <p>&quot;{d.title || 'Untitled quiz'}&quot; and its {d.questions.length} question{d.questions.length > 1 ? 's' : ''} will be deleted. This can&apos;t be undone.</p>
          <div style={css('display:flex;gap:10px;justify-content:flex-end')}>
            <button type="button" className="btn btn-outline" onClick={() => setAskDelete(false)} autoFocus>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={() => { clearTimeout(saveT.current); deleteQuiz(d.id); E = null; navigate('/admin'); toast('Quiz deleted'); }}>Yes, delete quiz</button>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

export default CreateQuiz;
