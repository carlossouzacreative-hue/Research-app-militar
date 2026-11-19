// TELAS DO PROTÓTIPO (média fidelidade), medidas a partir do Figma (frame 393x852).
// Convenções para o registro dos testes:
//   data-go="ID"     -> navega para a tela ID ("back" volta uma tela)
//   data-tap="copy"  -> reage mas não navega (copiar)
//   data-ui="a:arg"  -> ação interna (calendário, horário, formulário, Pix)
//   data-field="x"   -> campo preenchível
//   data-id="nome"   -> nome do elemento nos logs
//   data-base="ID"   -> tela "de fundo" (sheets compartilham a base; usado só na animação)
// Qualquer toque fora disso é registrado como "toque morto" (o que queremos medir).
(function () {
  'use strict';

  var TODAY = '2026-11-19'; // "hoje" fictício do protótipo
  var PROCESS_MS = 8000;    // tempo da "emissão em processo" depois do pagamento
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var PIX_CODE = '00020126580014br.gov.bcb.pix0136exercito-cdi-ficticio-520400005303986540560.005802BR6304A1B2';
  var DEFAULT_BOOKING = { data: '2026-11-25', hora: '16:00', unidade: 'Unidade Centro', municipio: 'Itajaí', motivo: 'Emissão de documento' };

  var P = (window.PROTO = {
    sc: null, form: {}, errors: {}, ui: { pop: null, month: null }, booking: null,
    pix: { status: 'none', t0: 0, paidAt: 0, n: 0 },
    from: null, sheetBase: null,
    log: function () {}, go: function () {}, rerender: function () {}
  });

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function br(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function dow(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function selectable(s) { var d = dow(s); return s > TODAY && d !== 0 && d !== 6; } // sem passado, sábado ou domingo
  var SLOTS_AM = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
  var SLOTS_PM = ['14:00', '15:00', '16:00', '17:00', '18:00'];
  function taken(s, h) { // alguns horários "já agendados", sempre os mesmos para o mesmo dia
    var x = 0, k = s + h;
    for (var i = 0; i < k.length; i++) x = (x * 31 + k.charCodeAt(i)) % 997;
    return x % 3 === 0;
  }
  function bookingData() { return P.booking || DEFAULT_BOOKING; }
  function ready() { return P.pix.status === 'paid' && Date.now() - P.pix.paidAt >= PROCESS_MS; }
  function docState() {
    if (P.pix.status === 'paid') return ready() ? 'ready' : 'proc';
    if (P.pix.status === 'open') return 'open';
    return 'avail';
  }

  // ---------- peças ----------
  function targets() {
    if (P.sc === 'B') {
      var d = { avail: 'B02', open: 'B03', proc: 'B09', ready: 'B10' }[docState()];
      return { home: 'B01', docs: d, agenda: 'A08', perfil: 'A14' };
    }
    var has = !!P.booking;
    return { home: has ? 'A07' : 'A02', docs: has ? 'A12' : 'A13', agenda: has ? 'A09' : 'A08', perfil: 'A14' };
  }
  function tabbar(active) {
    var t = targets();
    var items = [['home', 'Meu processo'], ['docs', 'Documentos'], ['agenda', 'Agendamento'], ['perfil', 'Perfil']];
    return '<nav class="tabbar">' + items.map(function (it) {
      return '<div class="tab' + (active === it[0] ? ' on' : '') + '" data-go="' + t[it[0]] + '" data-id="tab_' + it[0] + '"><i></i>' + it[1] + '</div>';
    }).join('') + '</nav>';
  }
  function screen(base, inner, fixed, cls) {
    return '<div class="screen' + (cls ? ' ' + cls : '') + '" data-base="' + base + '"><div class="content">' + inner + '</div>' + (fixed || '') + '</div>';
  }
  function sheet(inner, dimGo, cls) {
    return '<div class="sheet-dim"' + (dimGo ? ' data-go="' + dimGo + '" data-id="fundo_escuro"' : '') + '></div><div class="sheet ' + (cls || '') + '"><div class="handle"></div>' + inner + '</div>';
  }
  function at(top, html, cls, style) {
    return '<div class="abs ' + (cls || '') + '" style="top:' + top + 'px;' + (style || '') + '">' + html + '</div>';
  }
  function ui(label, id, action, cls, style) {
    return '<div class="btn ' + (cls || '') + '" data-ui="' + action + '" data-id="' + id + '"' + (style ? ' style="' + style + '"' : '') + '>' + label + '</div>';
  }
  function go(label, id, dest, cls, style) {
    return '<div class="btn ' + (cls || '') + '" data-go="' + dest + '" data-id="' + id + '"' + (style ? ' style="' + style + '"' : '') + '>' + label + '</div>';
  }
  function dead(label, id, cls, style) {
    return '<div class="btn ' + (cls || '') + '" data-id="' + id + '"' + (style ? ' style="' + style + '"' : '') + '>' + label + '</div>';
  }
  function link44(label, id, dest) {
    return '<span class="link link44" data-go="' + dest + '" data-id="' + id + '">' + label + '</span>';
  }
  function tag(t) { return '<span class="tag">' + t + '</span>'; }
  function check(sz) {
    return '<svg width="' + (sz || 40) + '" height="' + (sz || 40) + '" viewBox="0 0 40 40" fill="none"><path d="M10 21l7 7 13-15" stroke="#555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function topbar(title, back) {
    return '<div class="topbar">' + (back === false ? '' : '<div class="back" data-go="back" data-id="voltar">&lt;</div>') + '<h2>' + title + '</h2></div>';
  }
  var H = function (t, s) { return '<' + (s || 'h1') + ' style="margin-left:24px;margin-right:24px">' + t + '</' + (s || 'h1') + '>'; };

  // ---------- Início ----------
  function sections(act) {
    return '<h3 style="margin:24px 17px 0">Onde estou?</h3>' +
      '<div class="stepper"><div class="ln"></div><div class="st"><i></i>Alistamento</div><div class="st"><i></i>Comparecer à junta</div><div class="st on"><i></i>Dispensado</div></div>' +
      '<h3 style="margin:24px 17px 0">Atividade recente</h3>' +
      '<div class="card line" style="margin:8px 16px 0;padding:15px 16px;height:73px">' + act + '</div>';
  }
  function act(t, a, b) {
    return '<div style="font:400 16px/19px Inter,system-ui,sans-serif;color:var(--text-primary)">' + t + '</div><div class="label" style="margin-top:5px;line-height:17px;display:flex;gap:12px"><span>' + a + '</span><span>' + b + '</span></div>';
  }
  function homeA(withBooking) {
    var b = bookingData();
    return H('Olá, Rafael!') + '<h2 style="margin:4px 24px 0">Status</h2>' +
      '<div class="card" style="margin-top:8px"><h3 data-id="nome">Rafael Almeida Nogueira</h3>' +
      '<div style="display:flex;margin-top:14px">' + tag('CDI indisponível online') + '</div>' +
      dead('Emitir CDI', 'btn_emitir_cdi_desabilitado', 'disabled', 'margin-top:8px') +
      '<p class="cap" style="margin:4px 0 0">A emissão online de documentos está indisponível. Para obter o CDI, agende um atendimento na Junta Militar ' + link44('O que preciso levar?', 'link_o_que_levar', 'A04') + '</p>' +
      '<div class="divider" style="margin-top:18px"></div>' +
      (withBooking ? go('Ver agendamento', 'btn_ver_agendamento', 'A09', '', 'margin-top:22px') : go('Realizar agendamento', 'btn_realizar_agendamento', 'A03', '', 'margin-top:22px')) +
      '</div>' +
      sections(withBooking ? act('Agendamento', br(b.data), 'Junta militar') : act('Conta gov.br verificada', '12/11/2026', 'Online'));
  }
  function homeB() {
    var s = docState();
    var open = s === 'avail' || s === 'ready';
    var dest = s === 'ready' ? 'B11' : s === 'avail' ? 'B04' : 'B09';
    var t = s === 'proc' ? 'Em processamento' : 'CDI disponível para emitir';
    return H('Olá, Rafael!') + '<h2 style="margin:4px 24px 0">Status</h2>' +
      '<div class="card" style="margin-top:8px"><h3 data-id="nome">Rafael Almeida Nogueira</h3><p class="body sec">Dispensado de incorporação</p>' +
      '<div style="display:flex;margin-top:4px">' + tag(t) + '</div>' +
      (open ? go('Emitir CDI', 'btn_emitir_cdi', dest, '', 'margin-top:12px') : dead('Emitir CDI', 'btn_emitir_cdi_desabilitado', 'disabled', 'margin-top:12px')) +
      '</div>' + sections(act('Conta gov.br verificada', '12/11/2026', 'Online'));
  }

  // ---------- Documentos ----------
  function docCard(state) {
    var t = { avail: 'Disponível para emitir', ready: 'Disponível para emitir', open: 'Pagamento em aberto', proc: 'Em processamento' }[state];
    var sub = state === 'open' ? 'Você já gerou um Pix para este documento' : 'Emissão online com pagamento via Pix';
    var b = state === 'avail' ? go('Emitir CDI', 'btn_emitir_cdi', 'B04', '', 'margin-top:12px')
      : state === 'ready' ? go('Emitir CDI', 'btn_emitir_cdi', 'B11', '', 'margin-top:12px')
      : state === 'open' ? go('Ver Pix em aberto', 'btn_ver_pix', 'B05', '', 'margin-top:12px')
      : dead('Emitir CDI', 'btn_emitir_cdi_desabilitado', 'disabled', 'margin-top:12px');
    var warn = state === 'open'
      ? '<div class="divider" style="margin-top:12px"></div><p class="cap" style="margin:12px 0 0">Para evitar cobrança duplicada, não geramos outro Pix enquanto este estiver válido.</p>' : '';
    return H('Meus documentos') + '<p class="label" style="margin:0 24px">Documentos do seu processo</p>' +
      '<div class="card" style="margin-top:20px"><h3>Dispensa de incorporação</h3><p class="body sec">' + sub + '</p>' +
      '<div style="display:flex;margin-top:4px">' + tag(t) + '</div>' + b + warn + '</div>';
  }
  function docsA(withBooking) {
    return '<h2 style="margin:38px 24px 0">Documentos</h2>' +
      '<div class="card" style="margin-top:8px"><h3>Dispensa de incorporação (CDI)</h3>' +
      '<div style="display:flex;margin-top:14px">' + tag('CDI indisponível online') + '</div>' +
      '<p class="body sec" style="margin:12px 0 0">Para obter o CDI é necessário realizar o agendamento e retirar presencialmente.</p>' +
      '<div class="divider" style="margin-top:18px"></div>' +
      (withBooking ? go('Ver agendamento', 'btn_ver_agendamento', 'A09', '', 'margin-top:16px') : go('Realizar agendamento', 'btn_realizar_agendamento', 'A03', '', 'margin-top:16px')) + '</div>';
  }

  // ---------- Agendamento ----------
  function agendaVazia() {
    return '<div class="empty-c" style="margin-top:252px"></div>' +
      '<p class="body c" style="text-align:center;margin-top:16px">Você ainda não possui agendamentos</p>' +
      (P.sc === 'B' ? dead('Realizar agendamento', 'btn_realizar_agendamento', '', 'margin:20px 31px 0;width:auto') : go('Realizar agendamento', 'btn_realizar_agendamento', 'A03', '', 'margin:20px 31px 0;width:auto'));
  }
  function agendaCheia() {
    var b = bookingData();
    return '<h2 style="margin:38px 17px 0">Próximo agendamento</h2>' +
      '<div class="card" style="margin-top:8px" data-id="card_proximo"><h3>Junta militar</h3>' +
      '<div class="body" style="margin-top:2px;display:flex;gap:14px"><span>Horário: ' + b.hora + '</span><span>Data: ' + br(b.data) + '</span></div>' +
      '<div class="label" style="margin-top:10px">' + esc(b.unidade) + ' &nbsp;|&nbsp; ' + esc(b.municipio) + '</div></div>' +
      go('Novo agendamento', 'btn_novo_agendamento', 'A03', '', 'margin:8px 33px 0;width:auto') +
      '<h3 style="margin:24px 17px 0">Histórico de agendamentos</h3>' +
      '<div class="card line" style="margin:8px 17px 0;padding:11px 16px;display:flex;align-items:center;justify-content:space-between"><span class="body">Junta militar &nbsp;•&nbsp; 12/07/2026</span>' + '<span class="label" style="color:var(--text-link)">'+link44('Expandir', 'btn_expandir', 'A10')+'</span>' + '</div>';
  }

  // ---------- Perfil e Pagamentos ----------
  function perfil() {
    var pay = P.sc === 'B' ? 'B14' : 'A16';
    var row = function (t, id, d) {
      return '<div class="menu-row"' + (d ? ' data-go="' + d + '"' : '') + ' data-id="' + id + '"><span>' + t + '</span><i></i></div>';
    };
    return '<h2 style="margin:38px 24px 0">Perfil</h2>' +
      '<div class="card" style="margin-top:8px;height:191px"><div style="display:flex;align-items:center;gap:12px;height:44px"><div style="width:36px;height:36px;border-radius:50%;background:var(--neutral-200);flex:none"></div><div><h3>Rafael Almeida Nogueira</h3><div class="label">Rafael@email.com</div></div></div>' +
      '<div class="divider" style="margin-top:18px"></div><div style="margin-top:16px">' + row('Pagamentos', 'item_pagamentos', pay) + row('Editar perfil', 'item_editar_perfil') + '</div></div>' +
      '<div class="card" style="margin-top:8px;padding-bottom:24px"><h3>Preferências</h3>' + row('Configurações', 'item_configuracoes') + row('Tema', 'item_tema') + row('Termos e privacidade', 'item_termos') + '</div>' +
      '<div class="card line" style="margin-top:40px;padding:6px 16px">' + '<div class="menu-row" data-id="btn_sair"><span>Sair</span><i></i></div></div>';
  }
  function pagamentos(first) {
    var card = function (tg, note, btnHtml, cap) {
      return '<div class="card" style="margin-top:' + (cap === 'first' ? 26 : 20) + 'px"><h3>Dispensa de incorporação (CDI)</h3>' +
        '<div class="label" style="margin-top:14px;color:var(--text-primary)">' + tg.date + ' &nbsp;|&nbsp; R$ 60,00</div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:10px">' + tag(tg.t) + '<span class="label">' + note + '</span></div>' +
        '<div class="divider" style="margin-top:22px"></div>' + btnHtml + (cap && cap !== 'first' ? '<p class="cap" style="margin:8px 0 0">' + cap + '</p>' : '') + '</div>';
    };
    var back = '<div class="abs" style="top:calc(var(--sb) + 9px)"><div class="pill-back" data-go="back" data-id="voltar"><i></i>Voltar</div></div>';
    var one = P.sc === 'B'
      ? card({ date: '12/07/2026', t: 'Em processamento' }, 'Disponível em breve', dead('Emitir comprovante', 'btn_emitir_comprovante', '', 'margin-top:15px'), 'first')
      : card({ date: '12/07/2026', t: 'Pago' }, 'Comprovante disponível', dead('Emitir comprovante', 'btn_emitir_comprovante', '', 'margin-top:15px'), 'first');
    var two = card({ date: '05/05/2026', t: 'Expirado' }, 'Nenhuma cobrança feita', dead('Gerar novo pix', 'btn_gerar_novo_pix_desabilitado', 'disabled', 'margin-top:15px;background:var(--neutral-100);border-color:transparent'), 'Pix indisponível: O documento já foi pago');
    return back + '<h2 style="margin:38px 24px 0">Pagamentos</h2><h3 style="margin:24px 17px 0">Histórico de pagamentos</h3>' + one + two;
  }

  // ---------- bases (telas que também servem de fundo de sheets) ----------
  var BASES = {
    A02: function () { return screen('A02', homeA(false), tabbar('home')); },
    A07: function () { return screen('A07', homeA(true), tabbar('home')); },
    A08: function () { return screen('A08', agendaVazia(), tabbar('agenda')); },
    A09: function () { return screen('A09', agendaCheia(), tabbar('agenda')); },
    A12: function () { return screen('A12', docsA(true), tabbar('docs')); },
    A13: function () { return screen('A13', docsA(false), tabbar('docs')); },
    B01: function () { return screen('B01', homeB(), tabbar('home')); },
    B02: function () { return screen('B02', docCard('avail'), tabbar('docs')); },
    B10: function () { return screen('B10', docCard('ready'), tabbar('docs')); }
  };
  function withSheet(baseId, sheetHtml) {
    var base = BASES[baseId]().replace('data-base="' + baseId + '"', 'data-base="' + baseId + '" data-sheet="1"');
    return base.replace(/<\/div>$/, sheetHtml + '</div>');
  }
  function baseFor(def) {
    if (BASES[P.from]) P.sheetBase = P.from;
    var id = P.sheetBase && BASES[P.sheetBase] ? P.sheetBase : def;
    if (id === 'A02' && P.booking) id = 'A07';
    if (id === 'A12' || id === 'A13') id = P.booking ? 'A12' : 'A13';
    if (id === 'B02' || id === 'B10') id = ready() ? 'B10' : 'B02';
    return id;
  }

  // ---------- formulário de agendamento (A03) ----------
  function fieldLabel(top, left, t) { return at(top, t, 'sub', 'left:' + left + 'px;white-space:nowrap'); }
  function formSheet() {
    var f = P.form, e = P.errors;
    function opt(list, val) { return list.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join(''); }
    function sel(id, field, ph, list, top) {
      return at(top, '<select class="inp' + (f[field] ? '' : ' ph') + (e[field] ? ' err' : '') + '" data-field="' + field + '" data-id="' + id + '"><option value="" disabled' + (f[field] ? '' : ' selected') + ' hidden>' + (e[field] || ph) + '</option>' + opt(list, f[field]) + '</select>', 'fld');
    }
    var html =
      fieldLabel(42, 34, 'Município') +
      at(65, '<input class="inp' + (e.municipio ? ' err' : '') + '" data-field="municipio" data-id="campo_municipio" list="munis" placeholder="' + (e.municipio || 'Itajaí') + '" autocomplete="off" value="' + esc(f.municipio) + '"><datalist id="munis"><option>Itajaí</option><option>Goiânia</option><option>Jataí</option><option>São Paulo</option><option>Rio de Janeiro</option></datalist>', 'fld') +
      fieldLabel(114, 34, 'Motivo') + sel('campo_motivo', 'motivo', 'Emissão de documento', ['Emissão de documento', 'Regularização', 'Alistamento'], 137) +
      fieldLabel(185, 34, 'Unidade') + sel('campo_unidade', 'unidade', 'Unidade Centro', ['Unidade Centro', 'Unidade Norte', 'Unidade Sul'], 208) +
      fieldLabel(256, 34, 'Data') + fieldLabel(256, 183, 'Horários disponíveis') +
      at(280, '<div class="inp sm' + (e.data ? ' err' : '') + '" data-ui="pop:cal" data-id="campo_data"><span class="ic"></span><span' + (f.data ? '' : ' class="dis"') + '>' + (f.data ? br(f.data) : (e.data || '00/00/0000')) + '</span></div>', '', 'left:31px;width:142px') +
      at(280, '<div class="inp sm' + (e.hora ? ' err' : '') + '" data-ui="pop:slots" data-id="campo_horario"><span' + (f.hora ? '' : ' class="dis"') + ' style="white-space:nowrap">' + (f.hora || e.hora || 'Selecione o horário') + '</span></div>', '', 'left:183px;width:180px') +
      at(329, '<span class="link link44" style="font:400 14px/17px var(--font)" data-go="A04" data-id="link_o_que_levar">O que preciso levar?</span>', '', 'left:31px') +
      at(365, ui('Realizar agendamento', 'btn_realizar_agendamento', 'submit-book'), 'fld');
    return html;
  }
  function calendar() {
    var m = P.ui.month || { y: 2026, m: 10 };
    var first = new Date(m.y, m.m, 1).getDay();
    var days = new Date(m.y, m.m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < first; i++) cells += '<span class="cal-e"></span>';
    for (var d = 1; d <= days; d++) {
      var s = iso(m.y, m.m, d), ok = selectable(s);
      cells += '<span class="cal-d' + (ok ? '' : ' off') + (P.form.data === s ? ' sel' : '') + '"' + (ok ? ' data-ui="cal-pick:' + s + '" data-id="dia_' + s + '"' : ' data-id="dia_indisponivel"') + '>' + d + '</span>';
    }
    var canPrev = m.y > 2026 || m.m > 10, canNext = m.y < 2027 || (m.y === 2027 && m.m < 1);
    return at(24,
      '<div class="cal-head"><span class="cal-nav' + (canPrev ? '' : ' off') + '"' + (canPrev ? ' data-ui="cal-prev" data-id="mes_anterior"' : '') + '>‹</span><span>' + MESES[m.m] + ' ' + m.y + '</span><span class="cal-nav' + (canNext ? '' : ' off') + '"' + (canNext ? ' data-ui="cal-next" data-id="mes_seguinte"' : '') + '>›</span></div>' +
      '<div class="cal-grid cal-dow"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>' +
      '<div class="cal-grid">' + cells + '</div><span class="cal-x" data-ui="pop:close" data-id="fechar_calendario">Fechar</span>', 'pop');
  }
  function slotsPop() {
    if (!P.form.data) {
      return at(0, '<div class="opts"><div class="o" style="color:var(--text-secondary);border:0;height:auto;padding:12px;font-size:14px;line-height:20px" data-ui="pop:close" data-id="horario_sem_data">Escolha uma data primeiro.</div></div>', 'pop', 'left:183px;right:auto;width:180px;bottom:208px;top:auto');
    }
    function row(h) {
      var off = taken(P.form.data, h);
      return '<div class="o' + (off ? ' off' : '') + (P.form.hora === h ? ' sel' : '') + '"' + (off ? ' data-id="horario_indisponivel"' : ' data-ui="slot:' + h + '" data-id="horario_' + h.replace(':', '') + '"') + '>' + h + '</div>';
    }
    return at(0, '<div class="opts"><div class="g">Manhã</div>' + SLOTS_AM.map(row).join('') + '<div class="g">Tarde</div>' + SLOTS_PM.map(row).join('') + '</div>', 'pop', 'left:183px;right:auto;width:180px;bottom:208px;top:auto');
  }

  // ---------- telas ----------
  window.SCREENS = {
    // ===== Cenário A =====
    A01: function () {
      return screen('A01', '<div style="padding:0 24px"><h1 style="margin-top:210px">Exército Brasileiro</h1><p class="body sec" style="margin-top:8px">login</p>' +
        go('Entrar com Gov.br', 'btn_entrar_govbr', 'A02', '', 'margin-top:24px') + '</div>');
    },
    A02: function () { return BASES.A02(); },
    A03: function () {
      var b = baseFor('A02');
      return withSheet(b, sheet(formSheet() + (P.ui.pop === 'cal' ? calendar() : '') + (P.ui.pop === 'slots' ? slotsPop() : ''), b));
    },
    A04: function () {
      var b = baseFor('A02');
      return withSheet(b, sheet(
        at(64, 'O que preciso levar?', 'h3 c', 'left:0;right:0') +
        at(110, '<div class="ibox"><b></b><b></b><b></b></div>', '', 'left:50%;margin-left:-40px') +
        at(221, 'Documento com foto<br>Comprovante de alistamento', 'label c', 'left:0;right:0;color:var(--text-primary);font-size:14px;line-height:20px') +
        at(269, '<span class="link link44" style="font:400 14px/17px var(--font)" data-id="ver_detalhes">Ver detalhes</span>', 'c', 'left:0;right:0') +
        at(360, go('Voltar', 'btn_voltar', 'back', 'secondary'), 'fld'), 'back'));
    },
    A06: function () {
      return withSheet(baseFor('A02'), sheet(
        at(119, '<div class="circ">' + check() + '</div>', '', 'left:0;right:0') +
        at(262, 'Agendamento realizado com sucesso!', 'h3 c', 'left:60px;right:60px') +
        at(362, go('Ver agendamentos', 'btn_ver_agendamentos', 'A09'), 'fld')));
    },
    A07: function () { return BASES.A07(); },
    A08: function () { return BASES.A08(); },
    A09: function () { return BASES.A09(); },
    A10: function () {
      return withSheet('A09', sheet(
        at(45, 'Junta militar', 'h3 c', 'left:0;right:0') +
        at(84, '<div class="card" style="margin:0;display:flex;flex-direction:column;gap:7px;line-height:24px"><div class="body"><b>Data:</b> 12/07/2026</div><div class="body"><b>Horário:</b> 11:00</div><div class="body"><b>Motivo:</b> Regularização</div><div class="body"><b>Status:</b> Resolvido</div></div>', 'fld') +
        at(241, go('Voltar', 'btn_voltar', 'back', 'secondary'), 'fld'), 'back', 's366'));
    },
    A12: function () { return BASES.A12(); },
    A13: function () { return BASES.A13(); },
    A14: function () { return screen('A14', perfil(), tabbar('perfil')); },
    A16: function () { return screen('A16', pagamentos(), tabbar('perfil')); },

    // ===== Cenário B =====
    B01: function () { return BASES.B01(); },
    B02: function () { return BASES.B02(); },
    B03: function () { return screen('B03', docCard('open'), tabbar('docs')); },
    B04: function () {
      if (BASES[P.from]) P.sheetBase = P.from;
      var b = P.sheetBase === 'B01' ? 'B01' : 'B02';
      return withSheet(b, sheet(
        at(119, '<div class="circ" style="font-size:28px">◆</div>', '', 'left:0;right:0') +
        at(224, 'Pagar CDI com Pix', 'body c', 'left:0;right:0') +
        at(261, 'R$ 60,00', 'h3 c', 'left:0;right:0;font-weight:700') +
        at(362, ui('Gerar Pix', 'btn_gerar_pix', 'pix-gen'), 'fld'), 'back'));
    },
    B05: function () {
      return screen('B05',
        '<div style="height:0"></div>' + topbar('Pix gerado') +
        '<div class="label c" style="text-align:center;margin-top:10px">Valor</div>' +
        '<h1 style="text-align:center;margin-top:1px">R$ 60,00</h1>' +
        '<div class="qr" data-id="qr"><svg viewBox="0 0 220 220"><path d="M0 0L220 220M220 0L0 220" stroke="#bdbdbd" stroke-width="1"/></svg><span>QR code</span></div>' +
        '<div style="display:flex;margin:12px 33px 0"><span class="tag" style="width:100%;justify-content:center">Expira em <b id="pixtimer" style="font-weight:400;margin-left:4px">29:59</b></span></div>' +
        '<div class="body sec" style="margin:22px 24px 0">Pix copia e cola</div>' +
        '<div class="field" style="margin:2px 24px 0" data-id="codigo_pix"><span class="v">' + PIX_CODE + '</span></div>' +
        '<div class="btn" data-tap="copy" data-copy="' + PIX_CODE + '" data-id="btn_copiar_pix" style="margin:12px 31px 0;width:auto">Copiar codigo Pix</div>' +
        '<p class="label c" style="text-align:center;margin:24px 46px 0">Após pagar, a confirmação aparece nesta tela. Não pague duas vezes: use sempre o mesmo Pix.</p>' +
        '<div class="btn secondary hard" data-ui="pix-paid" data-id="btn_ja_paguei" style="margin:20px 31px 0;width:auto">Já paguei</div>');
    },
    // confirmação em bottom sheet (usada a partir do 2º Pix, depois de expirar)
    B05P: function () {
      var base = window.SCREENS.B05().replace('data-base="B05"', 'data-base="B05" data-sheet="1"');
      return base.replace(/<\/div>$/, sheet(
        at(66, '<div class="circ">' + check() + '</div>', '', 'left:0;right:0') +
        at(166, 'Pagamento recebido', 'h3 c', 'left:0;right:0') +
        at(198, 'R$ 60,00', 'body c sec', 'left:0;right:0') +
        at(307, go('Acompanhar', 'btn_acompanhar', 'B09'), 'fld') +
        at(367, go('Voltar ao início', 'btn_voltar_inicio', 'B01', 'secondary'), 'fld')) + '</div>');
    },
    B06: function () {
      return screen('B06',
        topbar('Pix expirado') +
        '<div class="circ big" style="margin-top:112px">!</div>' +
        '<h3 style="text-align:center;margin-top:8px">Este Pix expirou</h3>' +
        '<p class="label" style="text-align:center;margin:11px 0 0">Nenhuma cobrança foi feita.<br>Gere um novo Pix para continuar.</p>' +
        ui('Gerar novo Pix', 'btn_gerar_novo_pix', 'pix-gen', '', 'margin:49px 31px 0;width:auto') +
        go('Voltar aos documentos', 'btn_voltar_documentos', 'B02', 'secondary', 'margin:12px 31px 0;width:auto'));
    },
    B08: function () {
      return screen('B08',
        topbar('Pix recebido', false) +
        '<div class="circ big" style="margin-top:112px">' + check(44) + '</div>' +
        '<h3 style="text-align:center;margin-top:8px">Pagamento recebido</h3>' +
        '<p class="label" style="text-align:center;margin:11px 0 0">Estamos emitindo seu CDI</p>' +
        '<div class="label" style="margin:25px 24px 0;color:var(--text-primary)">Protocolo</div>' +
        '<div class="field" style="margin:1px 24px 0"><span class="v">000000210201012</span>' + '<span class="link link44" style="text-decoration:none" data-tap="copy" data-copy="000000210201012" data-id="copiar_protocolo">Copiar</span></div>' +
        '<div class="tl" style="margin-top:12px"><div class="r d"><i></i>Pix pago</div><div class="r n"><i></i>Emitindo documento</div><div class="r"><i></i>CDI disponível</div></div>' +
        go('Acompanhar', 'btn_acompanhar', 'B09', '', 'margin:23px 31px 0;width:auto') +
        go('Voltar ao início', 'btn_voltar_inicio', 'B01', 'secondary', 'margin:12px 31px 0;width:auto'));
    },
    B09: function () { return screen('B09', docCard(docState() === 'ready' ? 'ready' : 'proc'), tabbar('docs')); },
    B10: function () { return BASES.B10(); },
    B11: function () {
      return withSheet('B10', sheet(
        at(54, 'Dispensa de incorporação (CDI)', 'h3 c', 'left:0;right:0') +
        at(110, '<div class="ibox"><b></b><b></b><b></b></div>', '', 'left:50%;margin-left:-40px') +
        at(218, 'Gostaria de emitir o documento digitalmente?', 'body c', 'left:53px;right:53px') +
        at(307, ui('Emitir documento', 'btn_emitir_documento', 'emit-start'), 'fld') +
        at(367, go('Voltar', 'btn_voltar', 'back', 'secondary'), 'fld'), 'back'));
    },
    B12: function () {
      return withSheet('B10', sheet(
        at(54, 'Emitindo documento', 'h3 c', 'left:0;right:0') +
        at(165, '<div class="dots" data-id="carregando"><i></i><i></i><i></i></div>', '', 'left:0;right:0') +
        at(205, 'Por favor aguarde', 'body c sec', 'left:0;right:0') +
        at(362, go('Voltar', 'btn_voltar', 'B10', 'secondary'), 'fld')));
    },
    B13: function () {
      return withSheet('B10', sheet(
        at(54, 'Concluído', 'h3 c', 'left:0;right:0') +
        at(119, '<div class="circ">' + check() + '</div>', '', 'left:0;right:0') +
        at(216, 'Documento emitido e baixado no seu dispositivo!', 'body c', 'left:53px;right:53px') +
        at(362, go('Concluir', 'btn_concluir', 'B10'), 'fld')));
    },
    B14: function () { return screen('B14', pagamentos(), tabbar('perfil')); }
  };

  // ---------- ações internas (data-ui) ----------
  var UI = {
    pop: function (w) {
      if (w === 'close') { P.ui.pop = null; return true; }
      P.ui.pop = P.ui.pop === w ? null : w;
      if (w === 'cal' && P.ui.pop) {
        var s = P.form.data || TODAY;
        P.ui.month = { y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 };
      }
      return true;
    },
    'cal-prev': function () { var m = P.ui.month; P.ui.month = m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 }; return true; },
    'cal-next': function () { var m = P.ui.month; P.ui.month = m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 }; return true; },
    'cal-pick': function (s) { if (P.form.data !== s) P.form.hora = ''; P.form.data = s; P.ui.pop = null; delete P.errors.data; return true; },
    slot: function (h) { P.form.hora = h; P.ui.pop = null; delete P.errors.hora; return true; },
    'submit-book': function () {
      var f = P.form, msgs = { municipio: 'Digite o município', motivo: 'Selecione o motivo', unidade: 'Selecione a unidade', data: 'Selecione a data', hora: 'Selecione o horário' };
      var miss = [];
      P.errors = {};
      P.ui.pop = null;
      Object.keys(msgs).forEach(function (k) { if (!f[k] || !String(f[k]).trim()) { P.errors[k] = msgs[k]; miss.push(k); } });
      if (miss.length) { P.log('form_error', { note: 'faltou: ' + miss.join(',') }); return true; }
      P.booking = { data: f.data, hora: f.hora, unidade: f.unidade, municipio: f.municipio.trim(), motivo: f.motivo };
      P.form = {};
      return 'A06';
    },
    'pix-gen': function () { P.pix.status = 'open'; P.pix.t0 = Date.now(); P.pix.n = (P.pix.n || 0) + 1; return 'B05'; },
    'pix-paid': function () {
      P.pix.status = 'paid';
      P.pix.paidAt = Date.now();
      return P.pix.n >= 2 ? 'B05P' : 'B08';
    },
    'emit-start': function () { return 'B12'; }
  };
  window.UI = UI;

  // ---------- ganchos chamados pelo app.js ----------
  P.resetScenario = function (sc) {
    P.sc = sc; P.form = {}; P.errors = {}; P.ui = { pop: null, month: null };
    P.booking = null; P.pix = { status: 'none', t0: 0, paidAt: 0, n: 0 }; P.from = null; P.sheetBase = null;
  };
  P.onTaskStart = function (task) {
    P.form = {}; P.errors = {}; P.ui.pop = null; P.from = null; P.sheetBase = null;
    if (task.id === 'A2' && !P.booking) P.booking = DEFAULT_BOOKING;
    if (task.id === 'B1') P.pix = { status: 'none', t0: 0, paidAt: 0, n: 0 };
    if (task.id === 'B2') P.pix = { status: 'expired', t0: 0, paidAt: 0, n: 1 };
  };
  var timers = [];
  P.afterRender = function (id) {
    timers.forEach(clearTimeout); timers = [];
    var el = document.getElementById('pixtimer');
    if (el) {
      (function tick() {
        var e2 = document.getElementById('pixtimer');
        if (!e2) return;
        var left = Math.max(0, 1799 - Math.floor((Date.now() - P.pix.t0) / 1000));
        e2.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
        if (left <= 0 && P.pix.status === 'open') { P.pix.status = 'expired'; return P.go('B06'); }
        timers.push(setTimeout(tick, 1000));
      })();
    }
    if (id === 'B12') timers.push(setTimeout(function () { if (P.cur() === 'B12') P.go('B13'); }, 2800));
    if (id === 'B09' || (id === 'B01' && docState() === 'proc')) {
      var left = PROCESS_MS - (Date.now() - P.pix.paidAt);
      if (left > 0) timers.push(setTimeout(function () { if (P.cur() === id) P.rerender(); }, left + 50));
    }
  };
})();
