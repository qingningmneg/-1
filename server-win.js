const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CACHE_DIR = path.join(ROOT, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'questions.json');


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
      const cache = readCache();
      if (!cache) {
        return sendJson(res, {
          ok: false,
          error: '未找到题库缓存。请将 macOS 上 cache/questions.json 文件复制到本目录。'
        }, 404);
      }
      return sendJson(res, { syncedAt: cache.syncedAt, datasets: cache.datasets, total: cache.questions.length, errors: cache.errors || [] });
    }
    if (url.pathname === '/api/questions') {
      const cache = readCache();
      if (!cache) {
        return sendJson(res, { ok: false, error: '未找到题库缓存。请先复制 cache/questions.json 文件。' }, 404);
      }
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
      return sendJson(res, { ok: false, error: 'Windows 版不支持从有道云笔记同步。请先从 macOS 复制 cache/questions.json 文件。' }, 400);
    }
    serveStatic(req, res);
  } catch (err) {
    sendJson(res, { ok: false, error: err.message }, 500);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`软考练题网页（Windows 版）已启动：http://localhost:${PORT}`);
    if (!readCache()) {
      console.log('提示: 未检测到 cache/questions.json。');
      console.log('请先将 macOS 上的 cache/questions.json 文件复制到本目录。');
    }
  });
}

module.exports = { readCache };
