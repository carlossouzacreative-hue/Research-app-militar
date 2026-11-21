// Servidor do prototipo (Node puro, sem dependencias).
// - Serve a pasta /public
// - GET  /api/config?p=P1   -> ordem dos cenarios + clarityId do participante
// - POST /api/event         -> grava eventos em data/sessions/P1.jsonl e atualiza o status
// - GET  /api/status?t=TOKEN-> status de todos (so para o moderador)
// - POST /api/mod?t=TOKEN   -> o moderador marca "ajuda", "abandonou" ou uma nota
// - GET  /api/gate?p=P1     -> batimento do participante + quantas etapas o moderador ja liberou
// - POST /api/gate?t=TOKEN  -> o moderador libera a proxima etapa ({p, action: release|reset})
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const SESSIONS = path.join(DATA, 'sessions');
const PARTS = path.join(DATA, 'participantes.json');
const TOKEN_FILE = path.join(DATA, 'token.txt');
const GATES = path.join(DATA, 'gates.json');
const NOTAS = path.join(DATA, 'notas');

fs.mkdirSync(SESSIONS, { recursive: true });
fs.mkdirSync(NOTAS, { recursive: true });

// participantes.json real (fica em data/, fora do Git). Nasce do arquivo de exemplo.
if (!fs.existsSync(PARTS)) {
  fs.copyFileSync(path.join(ROOT, 'participantes.exemplo.json'), PARTS);
}
// Acrescenta participantes novos do exemplo (ex.: P5, P6) ao arquivo existente, sem mexer nos que ja estao la.
try {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'participantes.exemplo.json'), 'utf8'));
  const cur = JSON.parse(fs.readFileSync(PARTS, 'utf8'));
  let mudou = false;
  Object.keys(ex).forEach(function (k) { if (!cur[k]) { cur[k] = ex[k]; mudou = true; } });
  if (mudou) fs.writeFileSync(PARTS, JSON.stringify(cur, null, 2));
} catch (e) { console.error('participantes.json:', e.message); }

// Token do moderador: gerado uma vez e guardado em data/token.txt
let TOKEN;
if (fs.existsSync(TOKEN_FILE)) {
  TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  TOKEN = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(TOKEN_FILE, TOKEN);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return {};
  }
}
const PORT = Number(process.env.PORT) || readConfig().porta || 3000;

function readParts() {
  return JSON.parse(fs.readFileSync(PARTS, 'utf8').replace(/^\uFEFF/, ''));
}
function writeParts(obj) {
  const tmp = PARTS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, PARTS);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function send(res, code, body, headers) {
  const h = Object.assign(
    { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    headers || {}
  );
  res.writeHead(code, h);
  res.end(body);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}
function readBody(req, limit = 200 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body grande demais'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}


// Liberacao de etapas: o participante so passa de uma tarefa para a proxima quando o moderador libera.
// released = quantas etapas ja foram liberadas; g = quantas o participante ja passou; seen = ultimo batimento.
let gates = {};
try { gates = JSON.parse(fs.readFileSync(GATES, 'utf8')); } catch (e) { gates = {}; }
function saveGates() {
  try { fs.writeFileSync(GATES, JSON.stringify(gates)); } catch (e) {}
}
function gateOf(p) {
  if (!gates[p]) gates[p] = { released: 0, g: 0, seen: 0, label: '', epoch: 0 };
  if (typeof gates[p].epoch !== 'number') gates[p].epoch = 0;
  return gates[p];
}

const ID_RE = /^[A-Za-z0-9_-]{1,20}$/;
function safeId(p) {
  return typeof p === 'string' && ID_RE.test(p) ? p : null;
}
function tokenOk(url) {
  const t = url.searchParams.get('t') || '';
  const a = Buffer.from(t);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function appendEvents(p, events) {
  const file = path.join(SESSIONS, p + '.jsonl');
  const ts = Date.now();
  const lines = events.map((e) => JSON.stringify(Object.assign({ p, ts }, e))).join('\n') + '\n';
  fs.appendFileSync(file, lines);
}

// Atualiza o status ("Pendente" / "Em andamento" / "Ok" / "Com ajuda" / "Abandonou")
function applyStatus(p, events) {
  let parts;
  try {
    parts = readParts();
  } catch (e) {
    return;
  }
  const rec = parts[p];
  if (!rec) return;
  let changed = false;
  for (const e of events) {
    const sc = e.scenario;
    if (sc !== 'A' && sc !== 'B') continue;
    if (e.type === 'scenario_start' && rec[sc] === 'Pendente') {
      rec[sc] = 'Em andamento';
      changed = true;
    }
    if (e.type === 'scenario_end') {
      if (rec[sc] === 'Com ajuda') rec[sc] = 'Ok (com ajuda)';
      else if (rec[sc] !== 'Abandonou') rec[sc] = 'Ok';
      changed = true;
    }
  }
  if (changed) writeParts(parts);
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/config' && req.method === 'GET') {
    const p = safeId(url.searchParams.get('p'));
    if (!p) return json(res, 400, { erro: 'participante invalido' });
    let rec;
    try {
      rec = readParts()[p];
    } catch (e) {
      return json(res, 500, { erro: 'participantes.json ilegivel' });
    }
    if (!rec) return json(res, 404, { erro: 'participante nao encontrado' });
    const ordem = String(rec.ordem || 'AB').toUpperCase() === 'BA' ? ['B', 'A'] : ['A', 'B'];
    return json(res, 200, {
      p,
      ordem,
      status: { A: rec.A, B: rec.B },
      epoch: gateOf(p).epoch,
      scope: gateOf(p).scope || 'all',
      payRecv: gateOf(p).payRecv || 0,
      skip: gateOf(p).skip || 0,
      nome: gateOf(p).nome || '',
      clarityId: readConfig().clarityId || '',
      incluirOpcionais: readConfig().incluirOpcionais !== false
    });
  }

  if (url.pathname === '/api/event' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return json(res, 400, { erro: 'json invalido' });
    }
    const p = safeId(body && body.p);
    if (!p) return json(res, 400, { erro: 'participante invalido' });
    let known;
    try {
      known = !!readParts()[p];
    } catch (e) {
      known = false;
    }
    if (!known) return json(res, 404, { erro: 'participante nao encontrado' });
    const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
    // so campos esperados, tamanhos limitados
    const clean = events.map((e) => {
      const o = {};
      for (const k of ['t', 'type', 'scenario', 'task', 'screen', 'target', 'dead', 'dur', 'result', 'flag', 'note', 'w', 'h']) {
        if (e[k] === undefined) continue;
        o[k] = typeof e[k] === 'string' ? e[k].slice(0, 200) : e[k];
      }
      return o;
    });
    appendEvents(p, clean);
    applyStatus(p, clean);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/gate' && req.method === 'GET') {
    const p = safeId(url.searchParams.get('p'));
    if (!p) return json(res, 400, { erro: 'participante invalido' });
    const gt = gateOf(p);
    if (url.searchParams.get('reset') === '1') { gt.released = 0; gt.g = 0; saveGates(); }
    const g = parseInt(url.searchParams.get('g'), 10);
    if (!isNaN(g)) gt.g = g;
    gt.seen = Date.now();
    gt.label = String(url.searchParams.get('label') || '').slice(0, 60);
    gt.px = String(url.searchParams.get('x') || '').slice(0, 12);
    return json(res, 200, { released: gt.released, epoch: gt.epoch, payOk: !!gt.payOk, payRecv: gt.payRecv || 0, skip: gt.skip || 0, nome: gt.nome || '' });
  }

  if (url.pathname === '/api/gate' && req.method === 'POST') {
    if (!tokenOk(url)) return json(res, 403, { erro: 'token invalido' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return json(res, 400, { erro: 'json invalido' });
    }
    const p = safeId(body && body.p);
    if (!p) return json(res, 400, { erro: 'participante invalido' });
    const gt = gateOf(p);
    if (body.action === 'release') {
      gt.released = Math.max(gt.released, gt.g + 1);
      appendEvents(p, [{ t: Date.now(), type: 'mod_flag', flag: 'liberou', note: gt.label }]);
    }
    if (body.action === 'reset') { gt.released = 0; gt.g = 0; }
    if (body.action === 'approve') { gt.payRecv = (gt.payRecv || 0) + 1; appendEvents(p, [{ t: Date.now(), type: 'mod_flag', flag: 'aprovou_pagamento', scenario: 'B' }]); }
    if (body.action === 'nome') {
      // nome como a pessoa quiser ver (ate 4 palavras, so letras); personaliza o app e nunca vai para o log
      const n = String(body.nome || '').trim().split(/\s+/).slice(0, 4).map(w => w.replace(/[^\p{L}'-]/gu, '')).filter(Boolean).join(' ').slice(0, 40);
      gt.nome = n;
    }
    if (body.action === 'skip') { gt.skip = (gt.skip || 0) + 1; appendEvents(p, [{ t: Date.now(), type: 'mod_flag', flag: 'encerrou_tarefa' }]); }
    if (body.action === 'confirm') { gt.payOk = true; appendEvents(p, [{ t: Date.now(), type: 'mod_flag', flag: 'confirmou_pagamento', scenario: 'B' }]); }
    if (body.action === 'restart') {
      // reinicia o teste do participante (scope: 'A', 'B' ou 'all'): novo epoch, status Pendente e log arquivado (nunca apagado)
      const scope = body.scope === 'A' || body.scope === 'B' ? body.scope : 'all';
      gt.epoch += 1; gt.scope = scope; gt.label = '';
      if (scope === 'all' || scope === 'B') { gt.payOk = false; gt.payRecv = 0; }
      if (scope === 'all') { gt.released = 0; gt.g = 0; } else gt.released = Math.min(gt.released, gt.g);
      try {
        const parts = readParts();
        if (parts[p]) {
          if (scope === 'all' || scope === 'A') parts[p].A = 'Pendente';
          if (scope === 'all' || scope === 'B') parts[p].B = 'Pendente';
          writeParts(parts);
        }
      } catch (e) {}
      const f = path.join(SESSIONS, p + '.jsonl');
      if (fs.existsSync(f)) {
        const arq = path.join(DATA, 'arquivo');
        fs.mkdirSync(arq, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
        const out = [], keep = [];
        for (const l of lines) {
          let sc = null;
          try { sc = JSON.parse(l).scenario; } catch (e) {}
          (scope === 'all' || sc === scope ? out : keep).push(l);
        }
        if (out.length) fs.writeFileSync(path.join(arq, p + '_' + scope + '_' + stamp + '.jsonl'), out.join('\n') + '\n');
        fs.writeFileSync(f, keep.length ? keep.join('\n') + '\n' : '');
      }
    }
    saveGates();
    return json(res, 200, { ok: true, released: gt.released });
  }

  // anotacoes do moderador por participante (notas.html): nota 1-7, resultado e observacao por tarefa, perfil, sugestoes
  if (url.pathname === '/api/notas') {
    if (!tokenOk(url)) return json(res, 403, { erro: 'token invalido' });
    if (req.method === 'GET') {
      const p = safeId(url.searchParams.get('p'));
      if (!p) return json(res, 400, { erro: 'participante invalido' });
      try { return json(res, 200, JSON.parse(fs.readFileSync(path.join(NOTAS, p + '.json'), 'utf8'))); } catch (e) { return json(res, 200, {}); }
    }
    if (req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req, 100 * 1024)); } catch (e) { return json(res, 400, { erro: 'json invalido' }); }
      const p = safeId(body && body.p);
      if (!p || !body.data || typeof body.data !== 'object') return json(res, 400, { erro: 'dados invalidos' });
      body.data.atualizado = Date.now();
      fs.writeFileSync(path.join(NOTAS, p + '.json'), JSON.stringify(body.data, null, 2));
      return json(res, 200, { ok: true });
    }
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    if (!tokenOk(url)) return json(res, 403, { erro: 'token invalido' });
    const parts = readParts();
    const out = {};
    for (const k of Object.keys(parts)) {
      const gt = gates[k] || { released: 0, g: 0, seen: 0, label: '' };
      out[k] = Object.assign({}, parts[k], { gate: { nome: gt.nome || '', px: gt.px || '', payOk: !!gt.payOk, payRecv: gt.payRecv || 0, released: gt.released, g: gt.g, label: gt.label, online: Date.now() - gt.seen < 7000 && gt.seen > 0 } });
    }
    return json(res, 200, out);
  }

  if (url.pathname === '/api/mod' && req.method === 'POST') {
    if (!tokenOk(url)) return json(res, 403, { erro: 'token invalido' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return json(res, 400, { erro: 'json invalido' });
    }
    const p = safeId(body && body.p);
    if (!p) return json(res, 400, { erro: 'participante invalido' });
    const e = { t: Date.now(), type: 'mod_flag', flag: String(body.flag || '').slice(0, 40), note: String(body.note || '').slice(0, 200) };
    if (body.scenario === 'A' || body.scenario === 'B') e.scenario = body.scenario;
    appendEvents(p, [e]);
    // status manual
    if (body.status && (body.scenario === 'A' || body.scenario === 'B')) {
      const parts = readParts();
      if (parts[p]) {
        parts[p][body.scenario] = String(body.status).slice(0, 30);
        writeParts(parts);
      }
    }
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { erro: 'rota nao encontrada' });
}

function serveManifest(res, url) {
  const p = safeId(url.searchParams.get('p')) || '';
  const m = {
    name: 'Prototipo academico', short_name: 'Prototipo', start_url: p ? '/?p=' + p : '/', scope: '/',
    display: 'fullscreen', orientation: 'portrait', background_color: '#ffffff', theme_color: '#ffffff',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
  };
  send(res, 200, JSON.stringify(m), { 'Content-Type': 'application/manifest+json; charset=utf-8' });
}

function serveStatic(req, res, url) {
  if (url.pathname === '/manifest.webmanifest') return serveManifest(res, url);
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep) && file !== PUB) {
    return send(res, 403, 'Proibido');
  }
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Nao encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    send(res, 200, buf, { 'Content-Type': type });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodo nao permitido');
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    try {
      json(res, 500, { erro: 'erro interno' });
    } catch (_) {}
  }
});

server.listen(PORT, () => {
  console.log('Prototipo rodando em http://localhost:' + PORT);
  console.log('Painel do moderador: http://localhost:' + PORT + '/mod.html?t=' + TOKEN);
});
