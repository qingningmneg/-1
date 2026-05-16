const $ = (id) => document.getElementById(id);

const STORAGE = {
  key: 'ruankao.deepseek.key',
  wrong: 'ruankao.wrongbook.v2',
  history: 'ruankao.history.v2',
};

const state = {
  datasets: [],
  questions: [],
  index: 0,
  answers: {},
  revealed: new Set(),
  judgments: {},
  mistakeAnalyses: {},
  quizTitle: '',
};

function setMeta(text) { $('meta').innerHTML = text; }
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function mdLite(s) {
  return escapeHtml(s).replace(/^[-*]\s+/gm, '• ').replace(/\n{3,}/g, '\n\n');
}
function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function setLibrary(html) {
  $('library').classList.remove('hidden');
  $('library').innerHTML = html;
  $('library').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || '请求失败');
  return data;
}

async function loadDatasets() {
  setMeta('正在读取题库…首次启动可能需要从有道云笔记同步。');
  const data = await api('/api/datasets');
  state.datasets = data.datasets || [];
  $('datasetSelect').innerHTML = state.datasets
    .map(d => `<option value="${d.id}">${escapeHtml(d.title.replace(/\.md$/, ''))}（${d.count}题）</option>`)
    .join('');
  const when = data.syncedAt ? new Date(data.syncedAt).toLocaleString() : '未同步';
  setMeta(`题库：${data.datasets.length} 份<br>总题数：${data.total}<br>同步时间：${when}`);
}

async function syncNow() {
  $('syncBtn').disabled = true;
  $('syncBtn').textContent = '同步中…';
  try {
    const data = await api('/api/sync', { method: 'POST' });
    setMeta(`同步完成：${data.datasets.length} 份 / ${data.total} 题`);
    await loadDatasets();
  } catch (err) {
    alert(`同步失败：${err.message}`);
  } finally {
    $('syncBtn').disabled = false;
    $('syncBtn').textContent = '同步有道云笔记';
  }
}

async function startQuiz(customQuestions = null, title = '') {
  $('library').classList.add('hidden');
  if (customQuestions) {
    state.questions = customQuestions;
    state.quizTitle = title || '错题重练';
    resetQuizState();
    renderQuestion();
    return;
  }
  const mode = $('modeSelect').value;
  const params = new URLSearchParams();
  if (mode === 'year') params.set('dataset', $('datasetSelect').value);
  if (mode === 'random') {
    params.set('random', '1');
    params.set('limit', $('limitInput').value || '25');
  }
  $('startBtn').disabled = true;
  $('startBtn').textContent = '加载中…';
  try {
    const data = await api(`/api/questions?${params.toString()}`);
    state.questions = data.questions || [];
    state.quizTitle = mode === 'random' ? `随机考试 ${state.questions.length} 题` : ($('datasetSelect').selectedOptions[0]?.textContent || '年份练习');
    if (!state.questions.length) throw new Error('没有读取到题目');
    resetQuizState();
    renderQuestion();
  } catch (err) {
    alert(`加载失败：${err.message}`);
  } finally {
    $('startBtn').disabled = false;
    $('startBtn').textContent = '开始练题';
  }
}

function resetQuizState() {
  state.index = 0;
  state.answers = {};
  state.revealed = new Set();
  state.judgments = {};
  state.mistakeAnalyses = {};
  $('emptyState').classList.add('hidden');
  $('quiz').classList.remove('hidden');
  $('result').classList.add('hidden');
}

function currentQuestion() { return state.questions[state.index]; }

function renderQuestion() {
  const q = currentQuestion();
  const total = state.questions.length;
  $('progress').textContent = `第 ${state.index + 1} / ${total} 题`;
  $('source').textContent = q.sourceTitle.replace(/\.md$/, '');
  $('stem').textContent = q.stem || q.rawQuestion;
  $('answerBox').classList.toggle('hidden', !state.revealed.has(q.id));
  $('prevBtn').disabled = state.index === 0;
  $('nextBtn').disabled = state.index === total - 1;
  $('blankAnswer').classList.toggle('hidden', q.type !== 'blank');
  $('options').classList.toggle('hidden', q.type !== 'choice');
  $('judgeBtn').classList.toggle('hidden', q.type !== 'blank');

  if (q.type === 'choice') {
    const chosen = state.answers[q.id];
    const revealed = state.revealed.has(q.id);
    $('options').innerHTML = q.options.map(opt => {
      const classes = ['option'];
      if (chosen === opt.letter) classes.push('selected');
      if (revealed && opt.letter === q.answer) classes.push('correct');
      if (revealed && chosen === opt.letter && chosen !== q.answer) classes.push('wrong');
      return `<div class="${classes.join(' ')}" data-letter="${opt.letter}">
        <div class="letter">${opt.letter}</div><div>${escapeHtml(opt.text)}</div>
      </div>`;
    }).join('');
    document.querySelectorAll('.option').forEach(el => {
      el.addEventListener('click', async () => {
        if (state.revealed.has(q.id)) return;
        state.answers[q.id] = el.dataset.letter;
        const mode = $('judgeMode').value;
        if (mode === 'instant' || mode === 'instant-ai') {
          state.revealed.add(q.id);
          renderQuestion();
          if (mode === 'instant-ai' && state.answers[q.id] !== q.answer) {
            await analyzeMistake(q);
          }
        } else {
          renderQuestion();
        }
      });
    });
  } else {
    $('blankAnswer').value = state.answers[q.id] || '';
  }

  renderAnswer();
}

function renderAnswer() {
  const q = currentQuestion();
  const answerText = q.answerText ? `：${q.answerText}` : '';
  const judgment = state.judgments[q.id];
  const analysis = state.mistakeAnalyses[q.id];
  const chosen = state.answers[q.id];
  const choiceVerdict = q.type === 'choice' && chosen
    ? (chosen === q.answer ? `\n\n<div class="judgement ok"><strong>本题答对了。</strong><br>你的选择：${escapeHtml(chosen)}</div>` : `\n\n<div class="judgement bad"><strong>本题答错了。</strong><br>你的选择：${escapeHtml(chosen)}，正确答案：${escapeHtml(q.answer)}。先对照解析看关键差异。</div>`)
    : '';
  let html = `<strong>正确答案：${escapeHtml(q.answer + answerText)}</strong>${choiceVerdict}\n\n${mdLite(q.explanation || '暂无解析')}`;
  if (analysis) {
    html += `\n\n<div class="judgement bad"><strong>🧑‍🏫 老师讲题：${escapeHtml(analysis.summary || '')}</strong><br><br>${escapeHtml(analysis.teacherTalk || analysis.whyWrong || '')}<br><br><strong>💡 下次建议：</strong>${escapeHtml(analysis.advice || '')}</div>`;
  }
  if (judgment) {
    const cls = judgment.correct ? 'ok' : 'bad';
    html += `\n\n<div class="judgement ${cls}"><strong>DeepSeek 判断：${escapeHtml(judgment.verdict)}（${Math.round((judgment.score || 0) * 100)}%）</strong><br>${escapeHtml(judgment.reason || '')}</div>`;
  }
  $('answerBox').innerHTML = html;
}

function revealAnswer() {
  const q = currentQuestion();
  if (q.type === 'blank') state.answers[q.id] = $('blankAnswer').value.trim();
  state.revealed.add(q.id);
  renderQuestion();
}


async function analyzeMistake(q) {
  const apiKey = $('deepseekKey').value.trim();
  if (!apiKey) {
    state.mistakeAnalyses[q.id] = {
      summary: '未填写 DeepSeek API Key',
      teacherTalk: '已完成本地判题，但无法调用 DeepSeek 分析误判原因。请在左侧填写 API Key 后再使用 AI 分析模式。',
      advice: '也可以切换到“立即判题 + 显示解析”模式。',
    };
    renderQuestion();
    return;
  }
  if ($('rememberKey').checked) localStorage.setItem(STORAGE.key, apiKey);
  state.mistakeAnalyses[q.id] = {
    summary: 'DeepSeek 分析中…',
    teacherTalk: '正在分析你为什么可能选错。',
    advice: '',
  };
  renderQuestion();
  try {
    const data = await api('/api/analyze-mistake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        question: q.rawQuestion || q.stem,
        options: q.options,
        correctAnswer: q.answerRaw || q.answer,
        userAnswer: state.answers[q.id],
        explanation: q.explanation,
      }),
    });
    state.mistakeAnalyses[q.id] = data;
  } catch (err) {
    state.mistakeAnalyses[q.id] = {
      summary: 'DeepSeek 分析失败',
      teacherTalk: err.message,
      advice: '可以先看本地解析，稍后重试。',
    };
  }
  renderQuestion();
}

async function judgeBlank() {
  const q = currentQuestion();
  if (!q || q.type !== 'blank') return;
  state.answers[q.id] = $('blankAnswer').value.trim();
  const apiKey = $('deepseekKey').value.trim();
  if (!apiKey) {
    alert('请先输入 DeepSeek API Key');
    return;
  }
  if ($('rememberKey').checked) localStorage.setItem(STORAGE.key, apiKey);
  $('judgeBtn').disabled = true;
  $('judgeBtn').textContent = '判断中…';
  try {
    const data = await api('/api/judge-blank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        question: q.rawQuestion || q.stem,
        standardAnswer: q.answerRaw || q.answerText || q.answer,
        userAnswer: state.answers[q.id],
      }),
    });
    state.judgments[q.id] = data;
    state.revealed.add(q.id);
    renderQuestion();
  } catch (err) {
    alert(`DeepSeek 判断失败：${err.message}`);
  } finally {
    $('judgeBtn').disabled = false;
    $('judgeBtn').textContent = 'AI判断填空';
  }
}

function submitQuiz() {
  for (const q of state.questions) {
    if (q.type === 'blank') state.answers[q.id] = state.answers[q.id] || '';
  }
  let done = 0, correct = 0, judgePending = 0;
  const mistakes = [];
  for (const q of state.questions) {
    const ans = state.answers[q.id];
    if (ans) done++;
    if (q.type === 'choice') {
      if (ans === q.answer) correct++;
      if (ans && ans !== q.answer) mistakes.push({ ...q, userAnswer: ans, kind: 'choice' });
    } else {
      const j = state.judgments[q.id];
      if (!j && ans) judgePending++;
      if (j?.correct) correct++;
      if (ans && j && !j.correct) mistakes.push({ ...q, userAnswer: ans, judgment: j, kind: 'blank' });
    }
  }
  const score = state.questions.length ? Math.round(correct / state.questions.length * 100) : 0;
  saveWrongbook(mistakes);
  saveHistory({
    id: Date.now(),
    time: new Date().toISOString(),
    title: state.quizTitle,
    total: state.questions.length,
    done,
    correct,
    score,
    mistakes: mistakes.length,
  });
  $('result').classList.remove('hidden');
  $('result').innerHTML = `
    <h2>考试结果</h2>
    <div class="result-grid">
      <div class="stat"><span>得分</span><b>${score}</b></div>
      <div class="stat"><span>正确</span><b>${correct}</b></div>
      <div class="stat"><span>已答</span><b>${done}</b></div>
      <div class="stat"><span>错题</span><b>${mistakes.length}</b></div>
    </div>
    ${judgePending ? `<p>有 ${judgePending} 道填空题已答但还没用 DeepSeek 判断，暂未计入正确。</p>` : ''}
    ${mistakes.length ? `<h3>错题</h3><ol class="mistakes">${mistakes.map(q => `<li>第 ${q.number} 题：你的答案 ${escapeHtml(q.userAnswer)}，正确答案 ${escapeHtml(q.answerRaw || q.answer)}${q.judgment ? `；AI判断：${escapeHtml(q.judgment.verdict)}` : ''}</li>`).join('')}</ol>` : '<p>没有错题，漂亮。</p>'}
  `;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveWrongbook(items) {
  if (!items.length) return;
  const old = loadJson(STORAGE.wrong, []);
  const map = new Map(old.map(x => [x.id, x]));
  for (const q of items) {
    map.set(q.id, {
      ...q,
      lastWrongAt: new Date().toISOString(),
      wrongCount: (map.get(q.id)?.wrongCount || 0) + 1,
    });
  }
  saveJson(STORAGE.wrong, [...map.values()].slice(-500));
}
function saveHistory(record) {
  const old = loadJson(STORAGE.history, []);
  saveJson(STORAGE.history, [record, ...old].slice(0, 100));
}
function showWrongbook() {
  const items = loadJson(STORAGE.wrong, []);
  if (!items.length) return setLibrary('<h2>错题本</h2><p>目前还没有错题。</p>');
  setLibrary(`<h2>错题本</h2><p>共 ${items.length} 道。数据保存在本机浏览器。</p>
    <div class="side-actions"><button id="practiceWrong" class="primary">重练全部错题</button><button id="clearWrong" class="danger">清空错题本</button></div>
    <div class="record-list">${items.slice().reverse().map(q => `<div class="record-item"><b>${escapeHtml(q.sourceTitle?.replace(/\.md$/, '') || '')} 第 ${q.number} 题</b><br><small>错 ${q.wrongCount || 1} 次｜${new Date(q.lastWrongAt).toLocaleString()}</small><p>${escapeHtml(q.stem || q.rawQuestion || '').slice(0, 180)}</p><small>正确答案：${escapeHtml(q.answerRaw || q.answer)}</small></div>`).join('')}</div>`);
  $('practiceWrong').onclick = () => startQuiz(items, '错题重练');
  $('clearWrong').onclick = () => { if (confirm('确定清空错题本？')) { localStorage.removeItem(STORAGE.wrong); showWrongbook(); } };
}
function showHistory() {
  const items = loadJson(STORAGE.history, []);
  if (!items.length) return setLibrary('<h2>练习记录</h2><p>目前还没有练习记录。</p>');
  setLibrary(`<h2>练习记录</h2><p>最近 ${items.length} 次，保存在本机浏览器。</p>
    <div class="side-actions"><button id="clearHistory" class="danger">清空记录</button></div>
    <div class="record-list">${items.map(r => `<div class="record-item"><b>${escapeHtml(r.title || '练习')}</b><br><small>${new Date(r.time).toLocaleString()}</small><div class="result-grid"><div class="stat"><span>得分</span><b>${r.score}</b></div><div class="stat"><span>正确</span><b>${r.correct}</b></div><div class="stat"><span>已答</span><b>${r.done}</b></div><div class="stat"><span>错题</span><b>${r.mistakes}</b></div></div></div>`).join('')}</div>`);
  $('clearHistory').onclick = () => { if (confirm('确定清空练习记录？')) { localStorage.removeItem(STORAGE.history); showHistory(); } };
}

$('modeSelect').addEventListener('change', () => {
  const random = $('modeSelect').value === 'random';
  $('datasetWrap').classList.toggle('hidden', random);
  $('limitWrap').classList.toggle('hidden', !random);
});
$('startBtn').addEventListener('click', () => startQuiz());
$('syncBtn').addEventListener('click', syncNow);
$('showBtn').addEventListener('click', revealAnswer);
$('judgeBtn').addEventListener('click', judgeBlank);
$('wrongBookBtn').addEventListener('click', showWrongbook);
$('historyBtn').addEventListener('click', showHistory);
$('prevBtn').addEventListener('click', () => { state.index--; renderQuestion(); });
$('nextBtn').addEventListener('click', () => { state.index++; renderQuestion(); });
$('submitBtn').addEventListener('click', submitQuiz);
$('blankAnswer').addEventListener('input', () => { const q = currentQuestion(); if (q) state.answers[q.id] = $('blankAnswer').value; });
$('rememberKey').addEventListener('change', () => {
  if ($('rememberKey').checked && $('deepseekKey').value.trim()) localStorage.setItem(STORAGE.key, $('deepseekKey').value.trim());
  if (!$('rememberKey').checked) localStorage.removeItem(STORAGE.key);
});

const savedKey = localStorage.getItem(STORAGE.key);
if (savedKey) { $('deepseekKey').value = savedKey; $('rememberKey').checked = true; }
loadDatasets().catch(err => setMeta(`读取失败：${escapeHtml(err.message)}<br>可以点击「同步有道云笔记」重试。`));
