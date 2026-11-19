// TELAS DO PROTÓTIPO (média fidelidade) — Cenário A (agendar) e Cenário B (Pix).
// Convenções para o registro dos testes:
//   data-go="ID"     -> navega para a tela ID ("back" volta uma tela)
//   data-tap="copy"  -> reage mas não navega (copiar)
//   data-ui="a:arg"  -> ação interna (calendário, horário, enviar formulário, Pix)
//   data-field="x"   -> campo preenchível
//   data-id="nome"   -> nome do elemento nos logs
// Qualquer toque fora disso é registrado como "toque morto" (o que queremos medir).
(function () {
  'use strict';

  var TODAY = '2026-11-19'; // "hoje" fictício do protótipo
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var PIX_CODE = '00020126580014br.gov.bcb.pix0136exercito-cdi-ficticio-5204000053039865406' + '60.00' + '5802BR6304A1B2';
  var DEFAULT_BOOKING = { data: '2026-11-25', hora: '16:00', unidade: 'Unidade Centro', municipio: 'Itajaí', motivo: 'Emissão de documento' };

  var P = (window.PROTO = {
    sc: null,
    form: {},
    errors: {},
    ui: { cal: false, month: null },
    booking: null,
    pix: { status: 'none', t0: 0 },
    from: null,
    sheetBase: null,
    log: function () {},
    go: function () {},
    rerender: function () {}
  });

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function br(iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }
  function iso(y, m, d) {
    return y + '-' + pad(m + 1) + '-' + pad(d);
  }
  function dow(isoStr) {
    var p = isoStr.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).getDay();
  }
  function selectable(isoStr) {
    var d = dow(isoStr);
    return isoStr > TODAY && d !== 0 && d !== 6; // sem passado, sábado ou domingo
  }
  var SLOTS_AM = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
  var SLOTS_PM = ['14:00', '15:00', '16:00', '17:00', '18:00'];
  function taken(isoStr, hhmm) {
    // alguns horários já ocupados, sempre os mesmos para o mesmo dia
    var h = 0;
    var s = isoStr + hhmm;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % 3 === 0;
  }

  // ---------- peças ----------
  function targets() {
    if (P.sc === 'B') return { home: 'B01', docs: P.pix.status === 'open' ? 'B03' : 'B02', agenda: 'A08', perfil: 'A14' };
    var has = !!P.booking;
    return { home: has ? 'A07' : 'A02', docs: has ? 'A12' : 'A13', agenda: has ? 'A09' : 'A08', perfil: 'A14' };
  }
  function tabbar(active) {
    var t = targets();
    var items = [['home', 'Meu processo'], ['docs', 'Documentos'], ['agenda', 'Agendamento'], ['perfil', 'Perfil']];
    return (
      '<nav class="tabbar">' +
      items
        .map(function (it) {
          return '<div class="tab' + (active === it[0] ? ' on' : '') + '" data-go="' + t[it[0]] + '" data-id="tab_' + it[0] + '">' + it[1] + '</div>';
        })
        .join('') +
      '</nav>'
    );
  }
  function screen(inner, fixed, cls) {
    return '<div class="screen' + (cls ? ' ' + cls : '') + '"><div class="content"><div class="spacer-top"></div>' + inner + '</div>' + (fixed || '') + '</div>';
  }
  function topbar(title) {
    return '<div class="topbar"><div class="back" data-go="back" data-id="voltar">‹</div><h1>' + title + '</h1></div>';
  }
  function sheet(inner, dimGo) {
    return '<div class="sheet-dim"' + (dimGo ? ' data-go="' + dimGo + '" data-id="fundo_escuro"' : '') + '></div><div class="sheet">' + inner + '</div>';
  }
  function kv(k, v) {
    return '<div class="kv"><span class="muted">' + k + '</span><span>' + v + '</span></div>';
  }
  function dis(label, id) {
    return '<div class="btn disabled" data-id="' + id + '">' + label + '</div>';
  }
  function stepper() {
    return (
      '<h2>Onde estou?</h2><div class="stepper">' +
      '<div class="step done"><i></i><span>Alistamento</span></div>' +
      '<div class="step now"><i></i><span>Comparecer à junta</span></div>' +
      '<div class="step"><i></i><span>Dispensado</span></div></div>'
    );
  }
  function activity(extra) {
    return (
      '<h2>Atividade recente</h2>' +
      (extra || '') +
      '<div class="card"><div class="row"><b>Conta gov.br verificada</b><span class="tag">Online</span></div><p class="info">12/11/2026</p></div>'
    );
  }
  function bookingData() {
    return P.booking || DEFAULT_BOOKING;
  }
  function needLink() {
    return '<span class="link link44" data-go="A04" data-id="link_o_que_levar">O que preciso levar?</span>';
  }

  // ---------- conteúdo das telas base ----------
  function homeA(withBooking) {
    var b = bookingData();
    return (
      '<h1 data-id="saudacao">Olá, Rafael!</h1>' +
      '<h2>Status</h2>' +
      '<div class="card" data-id="card_status"><b>Rafael Almeida Nogueira</b><p><span class="tag">CDI indisponível online</span></p>' +
      dis('Emitir CDI', 'btn_emitir_cdi_desabilitado') +
      '<p class="info" style="margin-top:12px">Não é possível emitir online agora. ' + needLink() + '</p>' +
      (withBooking
        ? '<div class="btn" data-go="A09" data-id="btn_ver_agendamento">Ver agendamento</div>'
        : '<div class="btn" data-go="A03" data-id="btn_realizar_agendamento">Realizar agendamento</div>') +
      '</div>' +
      stepper() +
      activity(
        withBooking
          ? '<div class="card"><div class="row"><b>Agendamento</b><span class="tag">Junta militar</span></div><p class="info">' + br(b.data) + '</p></div>'
          : ''
      )
    );
  }
  function agendaVazia() {
    return (
      '<h1>Agendamento</h1><div class="empty"><p><b>Você ainda não possui agendamentos</b></p>' +
      (P.sc === 'B'
        ? '<div class="btn" data-id="btn_realizar_agendamento">Realizar agendamento</div>'
        : '<div class="btn" data-go="A03" data-id="btn_realizar_agendamento">Realizar agendamento</div>') +
      '</div>'
    );
  }
  function agendaCheia() {
    var b = bookingData();
    return (
      '<h1>Agendamento</h1>' +
      '<h2>Próximo agendamento</h2>' +
      '<div class="card" data-id="card_proximo"><b>Junta militar</b>' +
      kv('Horário', b.hora) + kv('Data', br(b.data)) + kv('Local', esc(b.unidade) + ', ' + esc(b.municipio)) +
      '<div class="btn secondary" data-go="A03" data-id="btn_novo_agendamento">Novo agendamento</div></div>' +
      '<h2>Histórico</h2>' +
      '<div class="card"><div class="row"><b>Junta militar • 12/07/2026</b><span class="link link44" data-go="A10" data-id="btn_expandir">Expandir</span></div></div>'
    );
  }
  function docs(withBooking) {
    return (
      '<h1>Meus documentos</h1>' +
      '<div class="card" data-id="card_cdi"><div class="row"><b>CDI</b><span class="tag">Indisponível online</span></div>' +
      '<p class="info">A emissão online não está disponível. Procure um atendimento presencial.</p>' +
      (withBooking
        ? '<div class="btn" data-go="A09" data-id="btn_ver_agendamento">Ver agendamento</div>'
        : '<div class="btn" data-go="A03" data-id="btn_realizar_agendamento">Realizar agendamento</div>') +
      '</div>'
    );
  }
  function perfil() {
    var pay = P.sc === 'B' ? 'B09' : 'A16';
    return (
      '<h1>Perfil</h1>' +
      '<div class="card"><b>Rafael Almeida Nogueira</b></div>' +
      '<div class="menu"><div class="item" data-go="' + pay + '" data-id="item_pagamentos">Pagamentos <span>›</span></div>' +
      '<div class="item" data-id="item_editar_perfil">Editar perfil <span>›</span></div></div>' +
      '<h2>Preferências</h2>' +
      '<div class="menu"><div class="item" data-id="item_configuracoes">Configurações <span>›</span></div>' +
      '<div class="item" data-id="item_tema">Tema <span>›</span></div>' +
      '<div class="item" data-id="item_termos">Termos e privacidade <span>›</span></div></div>' +
      '<div class="btn secondary" data-id="btn_sair">Sair</div>'
    );
  }
  function homeB() {
    return (
      '<h1 data-id="saudacao">Olá, Rafael!</h1>' +
      '<h2>Status</h2>' +
      '<div class="card" data-id="card_status"><b>Rafael Almeida Nogueira</b><p><span class="tag">CDI disponível para emitir</span></p>' +
      '<div class="btn" data-go="B04" data-id="btn_emitir_cdi">Emitir CDI</div></div>' +
      stepper() +
      activity()
    );
  }
  function docsB() {
    return (
      '<h1>Meus documentos</h1>' +
      '<div class="card" data-id="card_cdi"><div class="row"><b>CDI</b><span class="tag">Disponível para emitir</span></div>' +
      '<div class="btn" data-go="B04" data-id="btn_emitir_cdi">Emitir CDI</div></div>'
    );
  }
  function docsPix() {
    return (
      '<h1>Meus documentos</h1>' +
      '<div class="card" data-id="card_cdi"><div class="row"><b>CDI</b><span class="tag">Pagamento em aberto</span></div>' +
      '<div class="btn" data-go="B05" data-id="btn_ver_pix">Ver Pix em aberto</div>' +
      '<p class="info" style="margin-top:12px">Atenção: gerar outro Pix pode causar cobrança duplicada. Pague o Pix em aberto.</p></div>'
    );
  }

  // base de um bottom sheet = a tela de onde ele foi aberto
  var BASES = {
    A02: function () { return screen(homeA(false), tabbar('home')); },
    A07: function () { return screen(homeA(true), tabbar('home')); },
    A08: function () { return screen(agendaVazia(), tabbar('agenda')); },
    A09: function () { return screen(agendaCheia(), tabbar('agenda')); },
    A12: function () { return screen(docs(true), tabbar('docs')); },
    A13: function () { return screen(docs(false), tabbar('docs')); },
    B01: function () { return screen(homeB(), tabbar('home')); },
    B02: function () { return screen(docsB(), tabbar('docs')); }
  };
  function withSheet(baseId, sheetHtml) {
    var base = (BASES[baseId] || BASES.A02)();
    return base.replace(/<\/div>$/, sheetHtml + '</div>');
  }
  function baseFor(defaultId) {
    if (BASES[P.from]) P.sheetBase = P.from;
    var id = P.sheetBase && BASES[P.sheetBase] ? P.sheetBase : defaultId;
    // a base reflete o estado atual (ex.: já existe agendamento)
    if (id === 'A02' && P.booking) id = 'A07';
    if (id === 'A12' || id === 'A13') id = P.booking ? 'A12' : 'A13';
    return id;
  }

  // ---------- formulário de agendamento (A03) ----------
  function err(k) {
    return P.errors[k] ? '<div class="err" data-id="erro_' + k + '">' + P.errors[k] + '</div>' : '';
  }
  function calendar() {
    var m = P.ui.month || { y: 2026, m: 10 };
    var first = new Date(m.y, m.m, 1).getDay();
    var days = new Date(m.y, m.m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < first; i++) cells += '<span class="cal-empty"></span>';
    for (var d = 1; d <= days; d++) {
      var s = iso(m.y, m.m, d);
      var ok = selectable(s);
      cells +=
        '<span class="cal-day' + (ok ? '' : ' off') + (P.form.data === s ? ' sel' : '') + '"' +
        (ok ? ' data-ui="cal-pick:' + s + '" data-id="dia_' + s + '"' : ' data-id="dia_indisponivel"') + '>' + d + '</span>';
    }
    var canPrev = m.y > 2026 || m.m > 10;
    var canNext = m.y < 2027 || (m.y === 2027 && m.m < 1);
    return (
      '<div class="calendar" data-id="calendario"><div class="cal-head">' +
      '<span class="cal-nav' + (canPrev ? '' : ' off') + '"' + (canPrev ? ' data-ui="cal-prev" data-id="mes_anterior"' : '') + '>‹</span>' +
      '<b>' + MESES[m.m] + ' ' + m.y + '</b>' +
      '<span class="cal-nav' + (canNext ? '' : ' off') + '"' + (canNext ? ' data-ui="cal-next" data-id="mes_seguinte"' : '') + '>›</span></div>' +
      '<div class="cal-grid cal-dow"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>' +
      '<div class="cal-grid">' + cells + '</div></div>'
    );
  }
  function slotsHtml() {
    if (!P.form.data) return '<p class="info">Escolha uma data para ver os horários.</p>';
    function chip(h) {
      var off = taken(P.form.data, h);
      return '<span class="slot' + (off ? ' off' : '') + (P.form.hora === h ? ' sel' : '') + '"' +
        (off ? ' data-id="horario_indisponivel"' : ' data-ui="slot:' + h + '" data-id="horario_' + h.replace(':', '') + '"') + '>' + h + '</span>';
    }
    return (
      '<p class="caption">Manhã</p><div class="slots">' + SLOTS_AM.map(chip).join('') + '</div>' +
      '<p class="caption">Tarde</p><div class="slots">' + SLOTS_PM.map(chip).join('') + '</div>'
    );
  }
  function formSheet() {
    var f = P.form;
    function opt(list, val, ph) {
      return '<option value="">' + ph + '</option>' + list.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('');
    }
    return sheet(
      '<h2>Agendar atendimento</h2>' +
        '<label class="lbl">Município</label>' +
        '<input class="in" data-field="municipio" data-id="campo_municipio" list="munis" placeholder="Digite o município" autocomplete="off" value="' + esc(f.municipio) + '">' +
        '<datalist id="munis"><option>Itajaí</option><option>Goiânia</option><option>Jataí</option><option>São Paulo</option><option>Rio de Janeiro</option></datalist>' + err('municipio') +
        '<label class="lbl">Motivo</label>' +
        '<select class="in" data-field="motivo" data-id="campo_motivo">' + opt(['Emissão de documento', 'Regularização', 'Alistamento'], f.motivo, 'Selecione o motivo') + '</select>' + err('motivo') +
        '<label class="lbl">Unidade</label>' +
        '<select class="in" data-field="unidade" data-id="campo_unidade">' + opt(['Unidade Centro', 'Unidade Norte', 'Unidade Sul'], f.unidade, 'Selecione a unidade') + '</select>' + err('unidade') +
        '<label class="lbl">Data</label>' +
        '<div class="in pick" data-ui="cal-toggle" data-id="campo_data">' + (f.data ? br(f.data) : '<span class="muted">Selecione a data</span>') + '</div>' +
        (P.ui.cal ? calendar() : '') + err('data') +
        '<label class="lbl">Horários disponíveis</label>' + slotsHtml() + err('hora') +
        '<p class="need">' + needLink() + '</p>' +
        '<div class="btn" data-ui="submit-book" data-id="btn_realizar_agendamento">Realizar agendamento</div>',
      baseFor('A02')
    );
  }

  // ---------- Pix ----------
  function pixSheet() {
    return sheet(
      '<h2>Pagar CDI com Pix</h2><p class="amount">R$ 60,00</p>' +
        '<p class="info">Você gera o código Pix e paga no aplicativo do seu banco.</p>' +
        '<div class="btn" data-ui="pix-gen" data-id="btn_gerar_pix">Gerar Pix</div>',
      'back'
    );
  }
  function timeLeft() {
    var left = Math.max(0, (29 * 60 + 59) - Math.floor((Date.now() - P.pix.t0) / 1000));
    return pad(Math.floor(left / 60)) + ':' + pad(left % 60);
  }

  window.SCREENS = {
    // ---------- Cenário A ----------
    A01: function () {
      return screen(
        '<div class="login"><h1>Exército Brasileiro</h1><p class="info">Acesse com sua conta gov.br para continuar.</p>' +
          '<div class="btn" data-go="A02" data-id="btn_entrar_govbr">Entrar com Gov.br</div></div>', '', 'center');
    },
    A02: function () { return BASES.A02(); },
    A03: function () { return withSheet(baseFor('A02'), formSheet()); },
    A04: function () {
      var b = baseFor('A02');
      return withSheet(
        b,
        sheet(
          '<h2>O que preciso levar?</h2>' +
            '<div class="card"><b>Documento com foto</b><p class="info">RG ou CNH, original.</p></div>' +
            '<div class="card"><b>Comprovante de alistamento</b><p class="info">Se tiver, leve o comprovante.</p></div>' +
            '<div class="link link44" data-id="ver_detalhes">Ver detalhes</div>' +
            '<div class="btn" data-go="back" data-id="btn_voltar">Voltar</div>',
          'back'
        )
      );
    },
    A06: function () {
      return withSheet(
        baseFor('A02'),
        sheet('<h2 data-id="titulo_sucesso">Agendamento realizado com sucesso!</h2><div class="btn" data-go="A09" data-id="btn_ver_agendamentos">Ver agendamentos</div>')
      );
    },
    A07: function () { return BASES.A07(); },
    A08: function () { return BASES.A08(); },
    A09: function () { return BASES.A09(); },
    A10: function () {
      return withSheet(
        'A09',
        sheet(
          '<h2>Junta militar • 12/07/2026</h2>' + kv('Data', '12/07/2026') + kv('Horário', '11:00') + kv('Motivo', 'Regularização') + kv('Status', 'Resolvido') +
            '<div class="btn" data-go="back" data-id="btn_voltar">Voltar</div>',
          'back'
        )
      );
    },
    A12: function () { return BASES.A12(); },
    A13: function () { return BASES.A13(); },
    A14: function () { return screen(perfil(), tabbar('perfil')); },
    A16: function () {
      return screen(
        topbar('Pagamentos') +
          '<div class="card"><div class="row"><b>12/07/2026</b><span class="tag">Pago</span></div><p>R$ 60,00</p>' +
          '<div class="btn secondary" data-id="btn_emitir_comprovante">Emitir comprovante</div></div>' +
          '<div class="card"><div class="row"><b>05/05/2026</b><span class="tag">Expirado</span></div><p>R$ 60,00</p>' +
          dis('Gerar novo Pix', 'btn_gerar_novo_pix_desabilitado') + '</div>',
        tabbar('perfil')
      );
    },

    // ---------- Cenário B ----------
    B01: function () { return BASES.B01(); },
    B02: function () { return BASES.B02(); },
    B03: function () { return screen(docsPix(), tabbar('docs')); },
    B04: function () {
      if (BASES[P.from]) P.sheetBase = P.from;
      return withSheet(P.sheetBase === 'B02' ? 'B02' : 'B01', pixSheet());
    },
    B05: function () {
      return screen(
        topbar('Pix gerado') +
          '<p class="amount center-t">R$ 60,00</p>' +
          '<div class="qr" data-id="qr"></div>' +
          '<p class="center-t">Expira em <b id="pixtimer">' + timeLeft() + '</b></p>' +
          '<p class="label">Pix copia e cola</p><div class="code" data-id="codigo_pix">' + PIX_CODE + '</div>' +
          '<div class="btn" data-tap="copy" data-copy="' + PIX_CODE + '" data-id="btn_copiar_pix">Copiar código Pix</div>' +
          '<p class="info" style="margin-top:12px">Pague no aplicativo do seu banco. Depois de pagar, toque em "Já paguei".</p>' +
          '<div class="btn secondary" data-ui="pix-paid" data-id="btn_ja_paguei">Já paguei</div>',
        '', ''
      );
    },
    B06: function () {
      return screen(
        topbar('Pix expirado') +
          '<div class="empty"><p><b>Este Pix expirou</b></p><p class="info">Gere um novo Pix para concluir o pagamento.</p>' +
          '<div class="btn" data-ui="pix-gen" data-id="btn_gerar_novo_pix">Gerar novo Pix</div>' +
          '<div class="btn secondary" data-go="B02" data-id="btn_voltar_documentos">Voltar aos documentos</div></div>'
      );
    },
    B08: function () {
      return screen(
        topbar('Pagamento recebido') +
          '<div class="card"><p class="label">Protocolo</p><div class="row"><b>000000210201012</b><span class="link link44" data-tap="copy" data-copy="000000210201012" data-id="copiar_protocolo">Copiar</span></div></div>' +
          '<div class="timeline"><div class="tl done"><i></i>Pix pago</div><div class="tl now"><i></i>Emitindo documento</div><div class="tl"><i></i>CDI disponível</div></div>' +
          '<div class="btn" data-go="B09" data-id="btn_acompanhar">Acompanhar</div>' +
          '<div class="btn secondary" data-go="B01" data-id="btn_voltar_inicio">Voltar ao início</div>'
      );
    },
    B09: function () {
      return screen(
        topbar('Pagamentos') +
          '<div class="card"><div class="row"><b>19/11/2026</b><span class="tag">Em processamento</span></div><p>R$ 60,00</p>' +
          '<div class="btn secondary" data-id="btn_emitir_comprovante">Emitir comprovante</div></div>' +
          '<div class="card"><div class="row"><b>05/05/2026</b><span class="tag">Expirado</span></div><p>R$ 60,00</p></div>',
        tabbar('perfil')
      );
    }
  };

  // ---------- ações internas (data-ui) ----------
  var UI = {
    'cal-toggle': function () {
      P.ui.cal = !P.ui.cal;
      if (P.ui.cal) {
        var s = P.form.data || '2026-11-19';
        P.ui.month = { y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 };
      }
      return true;
    },
    'cal-prev': function () {
      var m = P.ui.month;
      P.ui.month = m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 };
      return true;
    },
    'cal-next': function () {
      var m = P.ui.month;
      P.ui.month = m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 };
      return true;
    },
    'cal-pick': function (s) {
      if (P.form.data !== s) P.form.hora = '';
      P.form.data = s;
      P.ui.cal = false;
      delete P.errors.data;
      return true;
    },
    slot: function (h) {
      P.form.hora = h;
      delete P.errors.hora;
      return true;
    },
    'submit-book': function () {
      var f = P.form;
      var msgs = { municipio: 'Informe o município', motivo: 'Selecione o motivo', unidade: 'Selecione a unidade', data: 'Selecione a data', hora: 'Selecione um horário' };
      var miss = [];
      P.errors = {};
      Object.keys(msgs).forEach(function (k) {
        if (!f[k] || !String(f[k]).trim()) {
          P.errors[k] = msgs[k];
          miss.push(k);
        }
      });
      if (miss.length) {
        P.log('form_error', { note: 'faltou: ' + miss.join(',') });
        return true;
      }
      P.booking = { data: f.data, hora: f.hora, unidade: f.unidade, municipio: f.municipio.trim(), motivo: f.motivo };
      P.form = {};
      P.ui.cal = false;
      return 'A06';
    },
    'pix-gen': function () {
      P.pix = { status: 'open', t0: Date.now() };
      return 'B05';
    },
    'pix-paid': function () {
      P.pix.status = 'paid';
      return 'B08';
    }
  };
  window.UI = UI;

  // ---------- ganchos chamados pelo app.js ----------
  P.resetScenario = function (sc) {
    P.sc = sc;
    P.form = {};
    P.errors = {};
    P.ui = { cal: false, month: null };
    P.booking = null;
    P.pix = { status: 'none', t0: 0 };
    P.from = null;
    P.sheetBase = null;
  };
  P.onTaskStart = function (task) {
    P.form = {};
    P.errors = {};
    P.ui.cal = false;
    P.from = null;
    P.sheetBase = null;
    if (task.id === 'A2' && !P.booking) P.booking = DEFAULT_BOOKING;
    if (task.id === 'B1') P.pix = { status: 'none', t0: 0 };
    if (task.id === 'B2') P.pix = { status: 'expired', t0: 0 };
  };
  P.afterRender = function () {
    var el = document.getElementById('pixtimer');
    if (!el) return;
    var iv = setInterval(function () {
      var e2 = document.getElementById('pixtimer');
      if (!e2) return clearInterval(iv);
      e2.textContent = timeLeft();
    }, 1000);
  };
})();
