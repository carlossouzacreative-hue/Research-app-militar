// Gera tabelas CSV a partir dos logs em data/sessions/*.jsonl
//   data/resumo_tarefas.csv : uma linha por participante e tarefa
//   data/resumo_telas.csv   : tempo e visitas por tela
// CSV com ";" e BOM, para abrir direto no Excel em portugues.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const SESS = path.join(DATA, 'sessions');
if (!fs.existsSync(SESS)) {
  console.log('Nenhum log encontrado em data/sessions.');
  process.exit(0);
}

let parts = {};
try {
  parts = JSON.parse(fs.readFileSync(path.join(DATA, 'participantes.json'), 'utf8').replace(/^\uFEFF/, ''));
} catch (e) {}

const num = (ms) => (ms === undefined || ms === null ? '' : (ms / 1000).toFixed(1).replace('.', ','));
const esc = (v) => {
  const s = String(v === undefined ? '' : v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCsv = (header, rows) => '﻿' + [header].concat(rows).map((r) => r.map(esc).join(';')).join('\n') + '\n';

const taskRows = [];
const screenRows = [];

for (const f of fs.readdirSync(SESS).filter((n) => n.endsWith('.jsonl')).sort()) {
  const p = f.replace(/\.jsonl$/, '');
  const events = fs
    .readFileSync(path.join(SESS, f), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.t || a.ts) - (b.t || b.ts));

  const ordem = String((parts[p] && parts[p].ordem) || '');
  const tasks = {}; // id -> dados
  const screens = {}; // task|screen -> dados

  for (const e of events) {
    const id = e.task;
    if (id) {
      const t = (tasks[id] = tasks[id] || { scenario: e.scenario, taps: 0, dead: 0, screens: 0, result: '', flags: [] });
      if (e.type === 'task_start' && t.t0 === undefined) t.t0 = e.t;
      if (e.type === 'success_reached' && t.success === undefined) t.success = e.dur;
      if (e.type === 'task_end') {
        t.total = e.dur;
        t.result = e.result;
      }
      if (e.type === 'tap') {
        t.taps += 1;
        if (e.dead) t.dead += 1;
      }
      if (e.type === 'screen_enter') t.screens += 1;
      if (e.type === 'screen_leave') {
        const k = id + '|' + e.screen;
        const s = (screens[k] = screens[k] || { scenario: e.scenario, task: id, screen: e.screen, visits: 0, ms: 0 });
        s.visits += 1;
        s.ms += e.dur || 0;
      }
    }
  }
  // marcacoes do moderador ficam no cenario inteiro
  const flags = {};
  for (const e of events) {
    if (e.type === 'mod_flag' && e.scenario) {
      (flags[e.scenario] = flags[e.scenario] || []).push(e.flag + (e.note ? ': ' + e.note : ''));
    }
  }

  for (const id of Object.keys(tasks).sort()) {
    const t = tasks[id];
    const pos = ordem && t.scenario ? ordem.indexOf(t.scenario) + 1 : '';
    taskRows.push([
      p,
      ordem,
      t.scenario || '',
      id,
      pos ? pos + 'ª parte' : '',
      t.result || 'não concluída',
      num(t.success),
      num(t.total),
      t.taps,
      t.dead,
      t.screens,
      (flags[t.scenario] || []).join(' | ')
    ]);
  }
  for (const k of Object.keys(screens).sort()) {
    const s = screens[k];
    screenRows.push([p, s.scenario || '', s.task, s.screen, s.visits, num(s.ms)]);
  }
}

fs.writeFileSync(
  path.join(DATA, 'resumo_tarefas.csv'),
  toCsv(
    ['participante', 'ordem', 'cenario', 'tarefa', 'posicao', 'resultado', 'ate_tela_sucesso_s', 'tempo_total_s', 'toques', 'toques_mortos', 'telas_vistas', 'marcacoes_moderador'],
    taskRows
  )
);
fs.writeFileSync(
  path.join(DATA, 'resumo_telas.csv'),
  toCsv(['participante', 'cenario', 'tarefa', 'tela', 'visitas', 'tempo_total_s'], screenRows)
);

console.log('Resumo gerado:');
console.log('  ' + path.join('data', 'resumo_tarefas.csv') + ' (' + taskRows.length + ' linhas)');
console.log('  ' + path.join('data', 'resumo_telas.csv') + ' (' + screenRows.length + ' linhas)');
