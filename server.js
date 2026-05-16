const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const https = require('https');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CACHE_DIR = path.join(ROOT, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'questions.json');
const FOLDER_ID = process.env.YDN_FOLDER_ID;
const PATH_WITH_YDN = `${process.env.HOME}/.local/bin:${process.env.PATH || ''}`;


function readRequestBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > maxBytes) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function callDeepSeek({ apiKey, question, standardAnswer, userAnswer }) {
  if (!apiKey || !String(apiKey).trim()) throw new Error('缺少 DeepSeek API Key');
  if (!userAnswer || !String(userAnswer).trim()) throw new Error('请先输入你的答案');
  const payload = JSON.stringify({
    model: 'deepseek-chat',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: '你是软考阅卷助手。请判断填空题/简答题答案是否与标准答案语义等价。只返回严格 JSON，不要 Markdown。字段：correct(boolean), score(number 0-1), verdict(string: 正确/部分正确/错误), reason(string，60字内)。'
      },
      {
        role: 'user',
        content: `题目：${question}\n标准答案：${standardAnswer}\n考生答案：${userAnswer}\n请按语义等价判断，允许同义表达、简称和合理顺序差异；明显缺关键点则判部分正确或错误。`
      }
    ],
    response_format: { type: 'json_object' }
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 45000,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DeepSeek 请求失败 ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          const content = data.choices?.[0]?.message?.content || '{}';
          let judged;
          try { judged = JSON.parse(content); }
          catch { judged = { correct: false, score: 0, verdict: '错误', reason: content.slice(0, 120) }; }
          resolve({
            correct: Boolean(judged.correct),
            score: Number(judged.score || 0),
            verdict: String(judged.verdict || (judged.correct ? '正确' : '错误')),
            reason: String(judged.reason || '').slice(0, 200),
          });
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('DeepSeek 请求超时')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}


function callDeepSeekMistake({ apiKey, question, options, correctAnswer, userAnswer, explanation }) {
  if (!apiKey || !String(apiKey).trim()) throw new Error('缺少 DeepSeek API Key');
  const payload = JSON.stringify({
    model: 'deepseek-chat',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: '你是软考资深讲师，正在一对一耐心讲题。请分析以下题型，输出一段让考生秒懂为什么错、为什么对的分析。\n\n要求：\n1. 先确认正确答案并解释为什么它正确或不正确。\n2. 如果考生选错，针对他的错误选项做认知拆解：为什么这个选项看起来有道理但实际不对。\n3. 用考试逻辑分析每个关键选项，不啰嗦所有选项。\n4. 给出记忆口诀或标准流程帮助巩固。\n5. 语气像老师在耐心讲题，亲切、清晰、有层次，不要机器感。\n6. 只返回严格 JSON，不要 Markdown。字段：summary(string, 80字内), teacherTalk(string, 500字内, 包含完整解析+认知拆解+记忆提示), advice(string, 100字内, 下次怎么避免)。'
      },
      {
        role: 'user',
        content: `题目：${question}\n选项：${JSON.stringify(options || [], null, 2)}\n正确答案：${correctAnswer}\n考生选择：${userAnswer}\n原解析：${explanation || '无'}\n请像老师一样逐层分析，让我真正理解。`
      }
    ],
    response_format: { type: 'json_object' }
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 45000,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DeepSeek 请求失败 ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          const content = data.choices?.[0]?.message?.content || '{}';
          let parsed;
          try { parsed = JSON.parse(content); }
          catch { parsed = { summary: '分析失败', whyWrong: content.slice(0, 120), likelyCause: '', advice: '' }; }
          resolve({
            summary: String(parsed.summary || '').slice(0, 200),
            teacherTalk: String(parsed.teacherTalk || parsed.whyWrong || '').slice(0, 800),
            advice: String(parsed.advice || '').slice(0, 200),
          });
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('DeepSeek 请求超时')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function runYdn(args, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    execFile('youdaonote', ['-s', 'ydn', ...args], {
      env: { ...process.env, PATH: PATH_WITH_YDN },
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) {
        err.message = `${err.message}\n${stderr || ''}`;
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

function parseList(output) {
  return output.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.includes('考题+答案+解析') && line.includes('.md'))
    .map(line => {
      const clean = line.replace(/^📄\s*/, '');
      const m = clean.match(/^([A-F0-9]{32})\s+(.+)$/i);
      if (!m) return null;
      return { id: m[1], title: m[2].trim() };
    })
    .filter(Boolean);
}

function publicDatasetId(title) {
  const cleaned = String(title || '')
    .replace(/\.md$/i, '')
    .replace(/考题\+答案\+解析（AI参考待核对）/g, '')
    .replace(/\s+/g, '')
    .trim();
  const date = cleaned.match(/(\d{4})年(\d{2})月/);
  const batch = cleaned.match(/第(\d+)批/);
  const region = cleaned.includes('广东') ? '-gd' : cleaned.includes('全国') ? '-national' : '';
  const batchPart = batch ? `-batch-${batch[1]}` : '';
  if (date) return `${date[1]}-${date[2]}${region}${batchPart}`;
  return cleaned
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'dataset';
}

function normalizeText(s) {
  return String(s || '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function cleanInline(s) {
  return normalizeText(s)
    .replace(/^\*\*/, '')
    .replace(/\*\*$/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+$/g, '')
    .trim();
}

function extractOptions(questionRaw) {
  const text = cleanInline(questionRaw);
  // Supports:
  //   A. / A． / A、  (standard with separator)
  //   B项目文件  (letter directly followed by Chinese word, no separator)
  //   Linked questions like （6）A、政府
  const re = /(^|\n|\s)(?:[（(]\d+[）)]\s*)?([A-G])(?:\s*[\.．、]\s*|(?=[\u4e00-\u9fff]))/g;
  const matches = [];
  let m;
  while ((m = re.exec(text))) {
    matches.push({ letter: m[2], start: m.index + m[1].length, valueStart: re.lastIndex });
  }
  const opts = {};
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    let value = text.slice(cur.valueStart, next ? next.start : text.length);
    value = value.replace(/\n+/g, ' ').replace(/\*\*/g, '').trim().replace(/[；;。]\s*$/, '');
    if (value && value.length < 500) opts[cur.letter] = value;
  }
  return Object.entries(opts).map(([letter, text]) => ({ letter, text }));
}

function stripOptions(questionRaw) {
  const text = cleanInline(questionRaw);
  const idx = text.search(/(^|\n|\s)(?:[（(]\d+[）)]\s*)?[A-G](?:\s*[\.．、]\s*|(?=[\u4e00-\u9fff]))/);
  return (idx >= 0 ? text.slice(0, idx) : text).trim();
}

function parseQuestions(markdown, source) {
  const md = normalizeText(markdown);
  const yearTitle = (md.match(/^#\s+(.+?)\s*$/m) || [null, source.title.replace(/\.md$/, '')])[1];
  const blocks = md.split(/\n(?=## 第\d+题\n)/g).filter(x => /^## 第\d+题/m.test(x));
  const questions = [];
  for (const block of blocks) {
    const n = block.match(/^## 第(\d+)题/m);
    const answer = block.match(/\*\*答案：\s*([^*\n]+?)\s*\*\*/);
    if (!n || !answer) continue;
    const answerRaw = cleanInline(answer[1]);
    const answerLetter = (answerRaw.match(/^([A-G])(?:\s*[：:].*)?$/) || [null, ''])[1];
    const answerText = answerLetter ? (answerRaw.match(/^[A-G]\s*[：:]\s*(.+)$/)?.[1] || '').trim() : answerRaw;
    const beforeAnswer = block.split(/\*\*答案：/)[0];
    const qMatch = beforeAnswer.match(/^## 第\d+题\s*\n+([\s\S]*)$/m);
    const questionRaw = qMatch ? qMatch[1].trim() : '';
    const explanationMatch = block.match(/\*\*解析：\*\*\s*([\s\S]*)$/);
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';
    const options = extractOptions(questionRaw);
    questions.push({
      id: `${source.id}-${n[1]}`,
      noteId: source.id,
      sourceTitle: source.title,
      yearTitle,
      number: Number(n[1]),
      type: options.length >= 2 ? 'choice' : 'blank',
      stem: stripOptions(questionRaw),
      rawQuestion: cleanInline(questionRaw),
      options,
      answer: answerLetter || answerRaw,
      answerRaw,
      answerText,
      explanation,
    });
  }
  return questions;
}

async function syncQuestions() {
  if (!FOLDER_ID) {
    throw new Error('未配置 YDN_FOLDER_ID。请在本机环境变量中设置有道云笔记文件夹 ID，或直接使用 cache/questions.json。');
  }
  await runYdn(['list']);
  const listOut = await runYdn(['list', '-f', FOLDER_ID]);
  const notes = parseList(listOut)
    // Skip duplicate copy names and currently-empty cached notes.
    .filter(n => !/\(\d+\)\.md$/.test(n.title))
    .filter(n => !/2024年11月第[123]批/.test(n.title));
  const all = [];
  const errors = [];
  for (const note of notes) {
    try {
      const md = await runYdn(['read', note.id]);
      const publicSource = { id: publicDatasetId(note.title), title: note.title };
      const qs = parseQuestions(md, publicSource);
      all.push(...qs);
    } catch (err) {
      errors.push({ title: note.title, error: err.message });
    }
  }
  const datasetsMap = new Map();
  for (const q of all) {
    if (!datasetsMap.has(q.noteId)) {
      datasetsMap.set(q.noteId, { id: q.noteId, title: q.sourceTitle, yearTitle: q.yearTitle, count: 0 });
    }
    datasetsMap.get(q.noteId).count++;
  }
  const payload = {
    syncedAt: new Date().toISOString(),
    datasets: [...datasetsMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN')),
    questions: all,
    errors,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': `${types[ext] || 'application/octet-stream'}; charset=utf-8` });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/api/health') return sendJson(res, { ok: true });
    if (url.pathname === '/api/datasets') {
      let cache = readCache();
      if (!cache) cache = await syncQuestions();
      return sendJson(res, { syncedAt: cache.syncedAt, datasets: cache.datasets, total: cache.questions.length, errors: cache.errors || [] });
    }
    if (url.pathname === '/api/questions') {
      let cache = readCache();
      if (!cache) cache = await syncQuestions();
      const dataset = url.searchParams.get('dataset');
      const random = url.searchParams.get('random') === '1';
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 75)));
      let questions = dataset ? cache.questions.filter(q => q.noteId === dataset) : [...cache.questions];
      if (random) questions = questions.sort(() => Math.random() - 0.5).slice(0, limit);
      return sendJson(res, { syncedAt: cache.syncedAt, count: questions.length, questions });
    }
    if (url.pathname === '/api/judge-blank' && req.method === 'POST') {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await callDeepSeek(body);
      return sendJson(res, { ok: true, ...result });
    }
    if (url.pathname === '/api/analyze-mistake' && req.method === 'POST') {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await callDeepSeekMistake(body);
      return sendJson(res, { ok: true, ...result });
    }
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const cache = await syncQuestions();
      return sendJson(res, { ok: true, syncedAt: cache.syncedAt, datasets: cache.datasets, total: cache.questions.length, errors: cache.errors });
    }
    serveStatic(req, res);
  } catch (err) {
    sendJson(res, { ok: false, error: err.message }, 500);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`软考练题网页已启动：http://localhost:${PORT}`);
  });
}

module.exports = { parseQuestions, parseList, syncQuestions };
