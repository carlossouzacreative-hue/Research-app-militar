// Fluxo do teste: intro -> cenario 1 -> transicao -> cenario 2 -> fim.
// Cada cenario tem tarefas (tasks.js). Tudo que a pessoa faz vira evento no log do servidor
// e, quando ha Project ID, tambem vai para o Microsoft Clarity (tags e eventos).
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var P = (qs.get('p') || '').trim();
  window.PROTO = window.PROTO || {};
  window.PROTO.pid = P;
  var app = document.getElementById('app');
  var now = function () {
    return Date.now();
  };

  // ---------- estado salvo no navegador (por participante) ----------
  var KEY = 'proto_' + P;
  function loadState() {
    try {
      var st = JSON.parse(localStorage.getItem(KEY)) || { stage: 0, ti: 0 };
      if (typeof st.gate !== 'number') st.gate = 0;
      return st;
    } catch (e) {
      return { stage: 0, ti: 0, gate: 0 };
    }
  }
  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }
  var state = { stage: 0, ti: 0, gate: 0 };
  var curLabel = 'abrindo';
  var released = 0; // etapas liberadas pelo moderador
  var epoch = null; // muda quando o moderador reinicia o teste
  var seenSkip = null; // encerramentos de tarefa feitos pelo moderador
  var seenPay = null; // quantas aprovacoes de pagamento o participante ja viu

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

  // ---------- liberacao pelo moderador ----------
  function unlockGate() {
    var b = app.querySelector('[data-locked]');
    if (!b || released <= state.gate) return;
    b.removeAttribute('data-locked');
    b.classList.remove('disabled');
    b.classList.add('go');
    b.textContent = b.getAttribute('data-label') || 'Começar';
    var w = app.querySelector('.wait');
    if (w) w.textContent = 'Liberado. Pode começar.';
  }
  function beat() {
    if (!P || !cfg) return;
    fetch('/api/gate?p=' + encodeURIComponent(P) + '&g=' + state.gate + '&label=' + encodeURIComponent(curLabel) + '&x=' + (window.PROTO.pixState ? window.PROTO.pixState() : ''), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (epoch !== null && typeof j.epoch === 'number' && j.epoch !== epoch) {
          return location.reload();
        }
        released = j.released || 0;
        if (typeof j.nome === 'string' && j.nome !== (window.PROTO.nome || '')) { window.PROTO.nome = j.nome; if (cur && !app.querySelector('.flow')) window.PROTO.rerender(); }
        if (seenSkip !== null && (j.skip || 0) > seenSkip) { seenSkip = j.skip; if (run) doneTask(); }
        if (seenPay !== null && (j.payRecv || 0) > seenPay) {
          seenPay = j.payRecv;
          var ap = window.PROTO.approvePay && window.PROTO.approvePay();
          if (ap) {
            log('pay_approved_seen', { screen: cur, scenario: scenario || undefined });
            if (ap.go) window.PROTO.go(ap.go);
            else if (['B01', 'B02', 'B03', 'B07', 'B09', 'B10', 'B14'].indexOf(cur) >= 0) window.PROTO.rerender();
          }
        }
        unlockGate();
      })
      .catch(function () {});
  }
  setInterval(beat, 1500);
  function goFull() {
    try {
      var d = document.documentElement;
      var f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (f && !document.fullscreenElement) { var r = f.call(d); if (r && r.catch) r.catch(function () {}); }
    } catch (e) {}
  }
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
        '<p><b>Este é um teste limitado.</b> Só algumas partes do aplicativo foram construídas, e muita coisa do app real não está disponível aqui.</p>' +
        '<p><b>Seu objetivo principal: emitir o CDI.</b> Vamos testar o fluxo juntos, uma tarefa de cada vez.</p>' +
        '<p>O que você vai usar é um <b>modelo de média fidelidade</b>. Por isso tem poucas cores e algumas coisas não vão responder quando você tocar.</p>' +
        '<p>Isso é proposital: estamos testando as funcionalidades, não um aplicativo pronto. Se tocar em algo que não funciona, tudo bem. Só diga o que esperava que acontecesse.</p>' +
        '<p class="caption">Projeto acadêmico de UX. Dados fictícios. Sem vínculo com o Exército Brasileiro.</p>' +
        '<p class="wait">Aguarde: o moderador vai liberar quando for a hora.</p>' +
        '<button class="btn disabled" data-flow data-act="start" data-locked="1" data-label="Começar">Aguardando o moderador…</button>'
    );
    curLabel = 'Aguardando liberar Início';
    beat();
  }
  function showTransition() {
        flowScreen('<h1>Parte concluída</h1><p>Vamos para a próxima parte.</p><p class="wait">Aguarde: o moderador vai liberar quando for a hora.</p>' +
      '<button class="btn disabled" data-flow data-act="next" data-locked="1" data-label="Continuar">Aguardando o moderador…</button>');
    curLabel = 'Aguardando liberar Parte 2';
    beat();
  }
  function showEnd() {
    curLabel = 'Fim do teste';
    flowScreen('<h1>Obrigado!</h1><p>Este foi um teste limitado: o protótipo tinha só algumas telas e funções, e o aplicativo de verdade tem muito mais.</p><p>O que você fez e disse aqui ajuda a melhorar a experiência de emitir documentos. Muito obrigado por participar.</p>');
  }
  function showInvalid(msg) {
    flowScreen('<h1>Link inválido</h1><p>' + msg + '</p>');
  }
  function showScenarioIntro(sc) {
    var extra = sc === 'A' ? '<p>O design deste cenário foi criado levando em conta as limitações atuais do aplicativo.</p>' : '';
    flowScreen(
      '<p class="caption">Cenário ' + sc + '</p>' +
        '<h1>Este é o cenário ' + sc + '</h1>' +
        '<p>O objetivo aqui é <b>emitir o CDI</b> de forma simples.</p>' + extra +
        '<p>Se algo falhar ou não sair como você esperava, <b>descreva em voz alta o que esperava que acontecesse</b>.</p>' +
        '<p class="info">Os cenários são do mesmo aplicativo e vão se alternar.</p>' +
        '<button class="btn disabled" data-flow data-act="sc-go" data-read="1">Entendi (8)</button>' +
        '<p class="cap warn" id="rw" style="display:none;margin:8px 0 0;font:400 12px/16px var(--font)">Leia a tela com atenção antes de continuar.</p>'
    );
    curLabel = 'Lendo apresentação do cenário ' + sc;
    var left = 8, tm = setInterval(function () {
      var b = app.querySelector('[data-read]');
      if (!b) return clearInterval(tm);
      left -= 1;
      if (left > 0) { b.textContent = 'Entendi (' + left + ')'; return; }
      clearInterval(tm);
      b.removeAttribute('data-read'); b.classList.remove('disabled'); b.classList.add('go'); b.textContent = 'Entendi';
      var w = app.querySelector('#rw'); if (w) w.style.display = 'none';
    }, 1000);
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
        '<p class="wait">Aguarde: o moderador vai liberar quando for a hora.</p>' +
        '<button class="btn disabled" data-flow data-act="task-start" data-locked="1" data-label="Começar">Aguardando o moderador…</button>'
    );
    curLabel = 'Aguardando liberar ' + t.id;
    beat();
    unlockGate();
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
    window.PROTO.from = cur;
    cur = id;
    curEnter = now();
    log('screen_enter', Object.assign({ screen: id }, ctx()));
    if (run && !run.reached && [].concat(run.task.success).indexOf(id) >= 0) {
      run.reached = true;
      log('success_reached', Object.assign({ screen: id, dur: now() - run.t0 }, ctx()));
      cl('event', run.task.id + '_sucesso_tela');
      app.classList.add('frozen');
      setTimeout(function () { if (run && run.reached) { run.modal = true; render(true); } }, 1500);
      curLabel = 'Concluiu ' + run.task.id + ' (falta tocar em Terminei)';
    }
    var html = build();
    var probe = document.createElement('div');
    probe.innerHTML = html;
    var nb = probe.querySelector('.screen');
    var oldEl = app.querySelector('.screen:not(.flow)');
    var closing = oldEl && oldEl.querySelector('.sheet') && nb && !nb.querySelector('.sheet') && oldEl.getAttribute('data-base') === nb.getAttribute('data-base');
    if (closing) {
      app.style.pointerEvents = 'none';
      var sh = oldEl.querySelector('.sheet'), dm = oldEl.querySelector('.sheet-dim');
      sh.classList.add('out');
      if (dm) dm.classList.add('out');
      setTimeout(function () {
        app.style.pointerEvents = '';
        if (cur === id) apply(html, false);
      }, 190);
    } else apply(html, false);
  }

  function build() {
    var s = window.SCREENS[cur];
    return typeof s === 'function' ? s() : s;
  }
  // "Smart animate": só anima o que mudou. A barra de abas fica parada; o sheet sobe; o fundo não pisca.
  function apply(html, keepScroll) {
    var oc = 0, os = 0;
    var oldEl = app.querySelector('.screen:not(.flow)');
    var oldBase = oldEl && oldEl.getAttribute('data-base');
    var oldSheet = !!(oldEl && oldEl.querySelector('.sheet'));
    if (keepScroll) {
      var c0 = app.querySelector('.content'), s0 = app.querySelector('.sheet');
      oc = c0 ? c0.scrollTop : 0;
      os = s0 ? s0.scrollTop : 0;
    }
    var reached = !!(run && run.reached);
    app.innerHTML = html +
      (run && !(reached && run.modal) ? '<button class="done-pill' + (reached ? '' : ' off') + '" data-flow ' + (reached ? 'data-act="done"' : 'disabled') + '>Terminei a tarefa</button>' : '') +
      (reached && run.modal ? '<div class="done-dim" data-flow></div><div class="done-sheet" data-flow><div class="ck">✓</div><h3>Tarefa concluída</h3><p>Você chegou ao objetivo. Toque no botão para continuar.</p><button class="btn" data-flow data-act="done">Terminei a tarefa</button></div>' : '');
    var nu = app.querySelector('.screen');
    var c1 = app.querySelector('.content'), s1 = app.querySelector('.sheet'), d1 = app.querySelector('.sheet-dim');
    if (c1) c1.scrollTop = oc;
    if (s1) s1.scrollTop = os;
    if (!keepScroll && nu && !nu.classList.contains('flow')) {
      var nb = nu.getAttribute('data-base');
      if (oldBase !== nb) {
        nu.classList.add('in');
        if (s1) s1.classList.add('in');
        if (d1) d1.classList.add('in');
      } else if (s1) {
        if (oldSheet) s1.classList.add('swap');
        else {
          s1.classList.add('in');
          if (d1) d1.classList.add('in');
        }
      }
    }
    if (window.PROTO.afterRender) window.PROTO.afterRender(cur);
  }
  function render(keepScroll) {
    apply(build(), keepScroll);
  }
  window.PROTO.log = function (t, x) { log(t, Object.assign({ screen: cur }, ctx(), x || {})); };
  window.PROTO.go = function (id) { go(id); };
  window.PROTO.cur = function () { return cur; };
  window.PROTO.rerender = function () { render(true); };

  function startTask() {
    var t = tasksOf(scenario)[state.ti];
    run = { task: t, t0: now(), reached: false };
    app.classList.remove('frozen');
    curLabel = 'Fazendo ' + t.id;
    hist = [];
    window.PROTO.onTaskStart(t);
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
    app.classList.remove('frozen');
    saveState();
    var tid = run.task.id;
    cur = null;
    if (tid === 'B1') return showPixReveal();
    showTaskCard();
  }
  // Depois da B1: so agora a pessoa fica sabendo que o Pix expirou de proposito. O botao so libera apos 5 s, para dar tempo de ler.
  function showPixReveal() {
    run = null;
    flowScreen(
      '<p class="caption">Sobre a tarefa anterior</p>' +
        '<h1>O Pix expirou de propósito</h1>' +
        '<p>Neste teste, o primeiro Pix dura poucos segundos para vermos como é retomar um pagamento que não deu certo. Em um aplicativo de verdade, o prazo seria de 30 minutos.</p>' +
        '<p class="info">Nenhuma cobrança foi feita.</p>' +
        '<button class="btn disabled" data-flow data-act="pix-go" data-locked="1"><span class="dd"><i>.</i><i>.</i><i>.</i></span></button>'
    );
    curLabel = 'Lendo o aviso do Pix (depois da B1)';
    log('pix_reveal_shown', ctx());
    beat();
    setTimeout(function () {
      var b = app.querySelector('[data-act="pix-go"]');
      if (!b) return;
      b.removeAttribute('data-locked'); b.classList.remove('disabled'); b.textContent = 'Continuar';
    }, 5000);
  }

  function enterScenario(sc) {
    scenario = sc;
    window.PROTO.resetScenario(sc);
    log('scenario_start', ctx());
    cl('set', 'cenario', sc);
    cl('event', 'cenario_' + sc + '_inicio');
    if (state.ti === 0) return showScenarioIntro(sc);
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

  // toque em algo que ainda nao funciona: um aperto curto mostra que o app respondeu (nao travou)
  function pressFx(el) {
    var t = el.closest('.btn:not(.disabled),.tab,.link,.link44,.field,.inp,.card.line,.act,.cal-d');
    if (!t) return;
    t.classList.remove('pfx'); void t.offsetWidth; t.classList.add('pfx');
    setTimeout(function () { t.classList.remove('pfx'); }, 260);
  }
  app.addEventListener('click', function (e) {
    var el = e.target;
    var act = el.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (act.hasAttribute('data-locked')) return;
      if (act.hasAttribute('data-read')) { var rw = app.querySelector('#rw'); if (rw) rw.style.display = 'block'; log('read_lock_tap', { note: curLabel }); return; }
      if (a === 'start' || a === 'task-start') goFull();
      if (a === 'task-start' || a === 'start' || a === 'next') {
        state.gate += 1;
        saveState();
        beat();
      }
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
      if (a === 'sc-go') return showTaskCard();
      if (a === 'task-start') return startTask();
      if (a === 'pix-go') return showTaskCard();
      if (a === 'done') return doneTask();
    }
    if (el.closest('[data-flow]')) return;
    if (!cur) return;
    var live = el.closest('[data-go],[data-tap],[data-ui],[data-field]');
    var named = el.closest('[data-id]');
    var target = (live && live.getAttribute('data-id')) || (named && named.getAttribute('data-id')) || describe(el);
    log('tap', Object.assign({ screen: cur, target: target, dead: !live }, ctx()));
    if (!live) { pressFx(el); return; }
    var group = live.getAttribute('data-group');
    if (group) {
      Array.prototype.forEach.call(app.querySelectorAll('[data-group="' + group + '"]'), function (n) {
        n.classList.remove('sel');
      });
      live.classList.add('sel');
    }
    if (live.getAttribute('data-tap') === 'copy') {
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(live.getAttribute('data-copy') || '').catch(function () {});
      } catch (er) {}
      toast('Código copiado');
    }
    var ui = live.getAttribute('data-ui');
    if (ui) {
      var parts = ui.split(':');
      var fn = window.UI[parts[0]];
      var r = fn ? fn(parts.slice(1).join(':')) : false;
      if (typeof r === 'string') go(r);
      else if (r) render(true);
      return;
    }
    var dest = live.getAttribute('data-go');
    if (dest) go(dest);
  });
  app.addEventListener('input', function (e) {
    var f = e.target.closest && e.target.closest('[data-field]');
    if (!f) return;
    var k = f.getAttribute('data-field');
    window.PROTO.form[k] = f.value;
    if (window.PROTO.errors[k]) {
      delete window.PROTO.errors[k];
      var er = f.nextElementSibling;
      while (er && !er.classList.contains('err') && er.tagName !== 'LABEL') er = er.nextElementSibling;
      if (er && er.classList.contains('err')) er.remove();
    }
  });

  // ---------- inicio ----------
  function boot() {
    if (!P) return showInvalid('Peça ao moderador o link correto.');
    if (qs.get('reset') === '1') {
      try {
        localStorage.removeItem(KEY); localStorage.removeItem('bk_' + P);
      } catch (e) {}
      fetch('/api/gate?p=' + encodeURIComponent(P) + '&reset=1&g=0', { cache: 'no-store' }).catch(function () {});
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
        epoch = typeof c.epoch === 'number' ? c.epoch : 0;
        seenPay = c.payRecv || 0;
        seenSkip = c.skip || 0;
        window.PROTO.nome = c.nome || '';
        if (state.epoch !== undefined && state.epoch !== epoch) {
          // o moderador reiniciou o teste: tudo, ou só o cenário A/B (volta ao começo daquele cenário)
          var at = c.scope === 'A' || c.scope === 'B' ? plan.findIndex(function (x) { return x.k === 'sc' && x.sc === c.scope; }) : -1;
          try { localStorage.removeItem('bk_' + P); } catch (e) {}
          state = at > 0 ? { stage: at, ti: 0, gate: state.gate } : { stage: 0, ti: 0, gate: 0 };
        }
        state.epoch = epoch;
        saveState();
        var jump = parseInt(qs.get('stage'), 10);
        if (!isNaN(jump) && jump >= 0 && jump < plan.length) {
          state = { stage: jump, ti: 0, gate: state.gate };
          saveState();
        }
        if (state.stage >= plan.length) state = { stage: 0, ti: 0, gate: 0 };
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
