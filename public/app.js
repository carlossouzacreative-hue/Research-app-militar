// Fluxo do teste: intro -> cenario 1 -> transicao -> cenario 2 -> fim.
// Cada cenario tem tarefas (tasks.js). Tudo que a pessoa faz vira evento no log do servidor
// e, quando ha Project ID, tambem vai para o Microsoft Clarity (tags e eventos).
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var P = (qs.get('p') || '').trim();
  var app = document.getElementById('app');
  var now = function () {
    return Date.now();
  };

  // ---------- estado salvo no navegador (por participante) ----------
  var KEY = 'proto_' + P;
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { stage: 0, ti: 0 };
    } catch (e) {
      return { stage: 0, ti: 0 };
    }
  }
  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }
  var state = { stage: 0, ti: 0 };

  // ---------- log para o servidor ----------
  var queue = [];
  function log(type, extra) {
    var e = { t: now(), type: type };
    if (extra) for (var k in extra) if (extra[k] !== undefined) e[k] = extra[k];
    queue.push(e);
    if (queue.length > 3000) queue.splice(0, queue.length - 3000);
    if (queue.length >= 15) flush();
  }
  function flush(useBeacon) {
    if (!P || !queue.length) return;
    var events = queue.splice(0, queue.length);
    var body = JSON.stringify({ p: P, events: events });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
      })
      .catch(function () {
        queue = events.concat(queue);
      });
  }
  setInterval(flush, 2000);
  window.addEventListener('pagehide', function () {
    flush(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });

  // ---------- Microsoft Clarity ----------
  function loadClarity(id) {
    if (!id) return;
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }
  function cl() {
    if (typeof window.clarity === 'function') {
      try {
        window.clarity.apply(null, arguments);
      } catch (e) {}
    }
  }

  // ---------- tarefas e plano ----------
  var cfg = null;
  var plan = [];
  function tasksOf(sc) {
    return (window.TASKS[sc] || []).filter(function (t) {
      return !(t.opcional && cfg && cfg.incluirOpcionais === false);
    });
  }

  var cur = null; // tela atual
  var curEnter = 0;
  var hist = [];
  var run = null; // tarefa em andamento
  var scenario = null;

  function ctx() {
    return { scenario: scenario || undefined, task: run ? run.task.id : undefined };
  }

  // ---------- telas de fluxo (nao fazem parte do prototipo) ----------
  function flowScreen(inner) {
    app.innerHTML = '<div class="screen flow" data-flow><div class="content">' + inner + '</div></div>';
  }
  function flowBtn(act, label) {
    return '<button class="btn" data-flow data-act="' + act + '">' + label + '</button>';
  }

  function showIntro() {
    flowScreen(
      '<h1>Antes de começar</h1>' +
        '<p>O que você vai usar é um <b>modelo de média fidelidade</b>. Por isso tem poucas cores e algumas coisas não vão responder quando você tocar.</p>' +
        '<p>Isso é proposital: estamos testando as funcionalidades, não um aplicativo pronto. Se tocar em algo que não funciona, tudo bem. Só diga o que esperava que acontecesse.</p>' +
        '<p class="caption">Projeto acadêmico de UX. Dados fictícios. Sem vínculo com o Exército Brasileiro.</p>' +
        flowBtn('start', 'Começar')
    );
  }
  function showTransition() {
    flowScreen('<h1>Parte concluída</h1><p>Vamos para a próxima parte.</p>' + flowBtn('next', 'Continuar'));
  }
  function showEnd() {
    flowScreen('<h1>Fim do teste</h1><p>Obrigado por participar! Suas respostas ajudam a melhorar o aplicativo.</p>');
  }
  function showInvalid(msg) {
    flowScreen('<h1>Link inválido</h1><p>' + msg + '</p>');
  }
  function showTaskCard() {
    var list = tasksOf(scenario);
    var t = list[state.ti];
    if (!t) return endScenario();
    run = null;
    cur = null;
    flowScreen(
      '<p class="caption">Tarefa ' + (state.ti + 1) + ' de ' + list.length + '</p>' +
        '<h1>' + t.texto + '</h1>' +
        '<p class="info">Quando achar que terminou, toque em "Terminei a tarefa".</p>' +
        flowBtn('task-start', 'Começar')
    );
  }

  // ---------- navegacao do prototipo ----------
  function leave() {
    if (cur) log('screen_leave', Object.assign({ screen: cur, dur: now() - curEnter }, ctx()));
  }
  function go(id, noHist) {
    if (id === 'back') id = hist.length ? hist.pop() : cur;
    else if (!noHist && cur) hist.push(cur);
    if (!window.SCREENS[id]) return;
    leave();
    cur = id;
    curEnter = now();
    app.innerHTML = window.SCREENS[id] + '<button class="done-pill" data-flow data-act="done">Terminei a tarefa</button>';
    var sc = app.querySelector('.content');
    if (sc) sc.scrollTop = 0;
    log('screen_enter', Object.assign({ screen: id }, ctx()));
    if (run && !run.reached && id === run.task.success) {
      run.reached = true;
      log('success_reached', Object.assign({ screen: id, dur: now() - run.t0 }, ctx()));
      cl('event', run.task.id + '_sucesso_tela');
    }
  }

  function startTask() {
    var t = tasksOf(scenario)[state.ti];
    run = { task: t, t0: now(), reached: false };
    hist = [];
    log('task_start', ctx());
    cl('set', 'tarefa', t.id);
    cl('event', t.id + '_inicio');
    go(t.start, true);
  }
  function doneTask() {
    if (!run) return;
    leave();
    var result = run.reached ? 'sucesso' : 'sem_sucesso';
    log('task_end', Object.assign({ dur: now() - run.t0, result: result }, ctx()));
    cl('event', run.task.id + '_fim_' + result);
    state.ti += 1;
    saveState();
    cur = null;
    showTaskCard();
  }

  function enterScenario(sc) {
    scenario = sc;
    log('scenario_start', ctx());
    cl('set', 'cenario', sc);
    cl('event', 'cenario_' + sc + '_inicio');
    showTaskCard();
  }
  function endScenario() {
    log('scenario_end', { scenario: scenario, result: 'ok' });
    cl('event', 'cenario_' + scenario + '_fim');
    scenario = null;
    run = null;
    state.stage += 1;
    state.ti = 0;
    saveState();
    runStage();
  }

  function runStage() {
    var s = plan[state.stage];
    if (!s) return showEnd();
    if (s.k === 'intro') return showIntro();
    if (s.k === 'sc') return enterScenario(s.sc);
    if (s.k === 'trans') return showTransition();
    return showEnd();
  }

  // ---------- eventos de clique ----------
  function toast(msg) {
    var old = app.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    app.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 1400);
  }
  function describe(el) {
    var txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return el.tagName.toLowerCase() + (txt ? ':' + txt : '');
  }

  app.addEventListener('click', function (e) {
    var el = e.target;
    var act = el.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'start') {
        state.stage = 1;
        saveState();
        return runStage();
      }
      if (a === 'next') {
        state.stage += 1;
        saveState();
        return runStage();
      }
      if (a === 'task-start') return startTask();
      if (a === 'done') return doneTask();
    }
    if (el.closest('[data-flow]')) return;
    if (!cur) return;
    var live = el.closest('[data-go],[data-tap]');
    var named = el.closest('[data-id]');
    var target = (live && live.getAttribute('data-id')) || (named && named.getAttribute('data-id')) || describe(el);
    log('tap', Object.assign({ screen: cur, target: target, dead: !live }, ctx()));
    if (!live) return;
    var group = live.getAttribute('data-group');
    if (group) {
      Array.prototype.forEach.call(app.querySelectorAll('[data-group="' + group + '"]'), function (n) {
        n.classList.remove('sel');
      });
      live.classList.add('sel');
    }
    if (live.getAttribute('data-tap') === 'copy') toast('Código copiado');
    var dest = live.getAttribute('data-go');
    if (dest) go(dest);
  });

  // ---------- inicio ----------
  function boot() {
    if (!P) return showInvalid('Peça ao moderador o link correto.');
    if (qs.get('reset') === '1') {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    }
    fetch('/api/config?p=' + encodeURIComponent(P), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('config');
        return r.json();
      })
      .then(function (c) {
        cfg = c;
        plan = [{ k: 'intro' }, { k: 'sc', sc: c.ordem[0] }, { k: 'trans' }, { k: 'sc', sc: c.ordem[1] }, { k: 'end' }];
        state = loadState();
        var jump = parseInt(qs.get('stage'), 10);
        if (!isNaN(jump) && jump >= 0 && jump < plan.length) {
          state = { stage: jump, ti: 0 };
          saveState();
        }
        if (state.stage >= plan.length) state = { stage: 0, ti: 0 };
        loadClarity(c.clarityId);
        cl('set', 'participante', P);
        cl('set', 'ordem', c.ordem.join(''));
        log('session_start', { w: window.innerWidth, h: window.innerHeight, note: state.stage > 0 ? 'retomada' : undefined });
        runStage();
      })
      .catch(function () {
        showInvalid('Não encontramos este participante. Peça ao moderador o link correto.');
      });
  }
  boot();
})();
