// TELAS PROVISÓRIAS (placeholders). Substituir pelas telas finais do Figma.
// Convenções para o registro dos testes:
//   data-go="ID"   -> navega para a tela ID ("back" volta uma tela)
//   data-tap="x"   -> elemento que reage mas não navega (chips, copiar)
//   data-group="g" -> chips do mesmo grupo: só um fica marcado
//   data-id="nome" -> nome do elemento nos logs
// Qualquer toque fora de data-go / data-tap é registrado como "toque morto".
(function () {
  function tabbar(active, map) {
    map = map || {};
    var items = [
      ['inicio', 'Início'],
      ['agendamento', 'Agendamento'],
      ['documentos', 'Documentos'],
      ['perfil', 'Perfil']
    ];
    return (
      '<nav class="tabbar">' +
      items
        .map(function (it) {
          var go = map[it[0]] ? ' data-go="' + map[it[0]] + '"' : '';
          return '<div class="tab' + (active === it[0] ? ' on' : '') + '"' + go + ' data-id="tab_' + it[0] + '">' + it[1] + '</div>';
        })
        .join('') +
      '</nav>'
    );
  }
  function note(txt) {
    return '<p class="caption placeholder">[Tela provisória: ' + txt + ']</p>';
  }
  // inner rola; fixed (barra de abas, bottom sheet) fica preso na tela
  function screen(inner, fixed) {
    return '<div class="screen"><div class="content"><div class="spacer-top"></div>' + inner + '</div>' + (fixed || '') + '</div>';
  }

  window.SCREENS = {
    // ---------- Cenário A: agendar atendimento ----------
    A01: screen(
      '<h1 data-id="titulo">Início</h1>' +
        '<div class="card" data-id="card_aviso"><span class="tag">Aviso</span><h2>Emissão online indisponível</h2>' +
        '<p class="info">No momento não é possível emitir o CDI pelo aplicativo. Agende um atendimento presencial.</p>' +
        '<div class="btn" data-go="A02" data-id="btn_agendar">Agendar atendimento</div></div>' +
        note('Início sem agendamento'),
        tabbar('inicio', { inicio: 'A01', agendamento: 'A08' })
    ),
    A02: screen(
      '<div class="back" data-go="back" data-id="voltar">‹ Voltar</div>' +
        '<h1>Escolha o dia e o horário</h1>' +
        '<p class="label">Dia</p><div class="chips">' +
        '<span class="chip" data-tap="dia" data-group="dia" data-id="dia_seg">Seg 24</span>' +
        '<span class="chip" data-tap="dia" data-group="dia" data-id="dia_ter">Ter 25</span>' +
        '<span class="chip" data-tap="dia" data-group="dia" data-id="dia_qua">Qua 26</span></div>' +
        '<p class="label">Horário</p><div class="chips">' +
        '<span class="chip" data-tap="hora" data-group="hora" data-id="hora_09">09:00</span>' +
        '<span class="chip" data-tap="hora" data-group="hora" data-id="hora_10">10:30</span>' +
        '<span class="chip" data-tap="hora" data-group="hora" data-id="hora_14">14:00</span></div>' +
        '<div class="btn" data-go="A03" data-id="btn_continuar">Continuar</div>' +
        note('escolha de dia e horário')
    ),
    A03: screen(
      '<div class="back" data-go="back" data-id="voltar">‹ Voltar</div>' +
        '<h1>Confirme o agendamento</h1>' +
        '<div class="card" data-id="card_resumo"><p class="label">Atendimento presencial</p>' +
        '<p class="info">Documento: CDI<br>Local: Junta de Serviço Militar (fictício)<br>Data e hora: escolhidas na tela anterior</p></div>' +
        '<div class="btn" data-go="A04" data-id="btn_confirmar">Confirmar agendamento</div>' +
        '<div class="btn secondary" data-go="back" data-id="btn_alterar">Alterar</div>' +
        note('confirmação')
    ),
    A04: screen(
      '<h1 data-id="titulo">Agendamento confirmado</h1>' +
        '<div class="card"><p class="label">Seu atendimento está marcado</p>' +
        '<p class="info">Leve um documento com foto. Você pode ver os detalhes em Agendamentos.</p></div>' +
        '<div class="btn" data-go="A06" data-id="btn_ver_agendamentos">Ver agendamentos</div>' +
        '<div class="btn secondary" data-go="A05" data-id="btn_inicio">Voltar ao início</div>' +
        note('sucesso do agendamento')
    ),
    A05: screen(
      '<h1 data-id="titulo">Início</h1>' +
        '<div class="card" data-id="card_proximo"><span class="tag">Agendado</span><h2>Atendimento presencial</h2>' +
        '<p class="info">Toque em Agendamento para ver data e horário.</p></div>' +
        note('Início com agendamento'),
        tabbar('inicio', { inicio: 'A05', agendamento: 'A06' })
    ),
    A06: screen(
      '<h1 data-id="titulo">Agendamentos</h1>' +
        '<div class="card" data-id="card_agendamento"><span class="tag">Confirmado</span><h2>CDI · atendimento presencial</h2>' +
        '<p class="info">Data e hora: Seg 24, 09:00 (fictício)<br>Local: Junta de Serviço Militar (fictício)</p></div>' +
        note('histórico com agendamento'),
        tabbar('agendamento', { inicio: 'A05', agendamento: 'A06' })
    ),
    A08: screen(
      '<h1 data-id="titulo">Agendamentos</h1>' +
        '<div class="card"><p class="info">Você ainda não tem agendamentos.</p>' +
        '<div class="btn" data-go="A02" data-id="btn_agendar">Agendar atendimento</div></div>' +
        note('estado vazio'),
        tabbar('agendamento', { inicio: 'A01', agendamento: 'A08' })
    ),

    // ---------- Cenário B: pagar com Pix ----------
    B01: screen(
      '<h1 data-id="titulo">Início</h1>' +
        '<div class="card" data-id="card_cdi"><span class="tag">Disponível</span><h2>Seu CDI está disponível</h2>' +
        '<p class="info">Pague a taxa para emitir o documento.</p></div>' +
        note('Início com CDI disponível'),
        tabbar('inicio', { inicio: 'B01', documentos: 'B02' })
    ),
    B02: screen(
      '<h1 data-id="titulo">Documentos</h1>' +
        '<div class="card" data-id="card_cdi"><span class="tag">Taxa pendente</span><h2>CDI</h2>' +
        '<p class="info">Taxa de emissão: R$ 60,00 (fictício)</p>' +
        '<div class="btn" data-go="B03" data-id="btn_pagar_pix">Pagar com Pix</div></div>' +
        note('lista de documentos'),
        tabbar('documentos', { inicio: 'B01', documentos: 'B02' })
    ),
    B03: screen(
      '<h1 data-id="titulo">Documentos</h1>' +
        '<div class="card"><span class="tag">Taxa pendente</span><h2>CDI</h2></div>',
        '<div class="sheet-dim" data-go="B02" data-id="fundo_sheet"></div>' +
        '<div class="sheet" data-id="sheet_pix"><h2>Pagar CDI com Pix</h2><p class="info">Valor: R$ 60,00 (fictício)</p>' +
        '<div class="btn" data-go="B04" data-id="btn_gerar_pix">Gerar Pix</div></div>'
    ),
    B04: screen(
      '<div class="back" data-go="B02" data-id="voltar">‹ Voltar</div>' +
        '<h1 data-id="titulo">Pix gerado</h1>' +
        '<div class="card"><div class="qr" data-id="qr"></div>' +
        '<p class="info">Valor: R$ 60,00 (fictício). Expira em 30 minutos.</p>' +
        '<div class="btn secondary" data-tap="copy" data-id="btn_copiar_pix">Copiar código Pix</div></div>' +
        '<div class="btn" data-go="B05" data-id="btn_ja_paguei">Já paguei</div>' +
        note('Pix gerado (QR e copia e cola são ilustrativos)')
    ),
    B05: screen(
      '<h1 data-id="titulo">Documentos</h1>' +
        '<div class="card" data-id="card_cdi"><span class="tag">Pago</span><h2>CDI</h2>' +
        '<p class="info">Pagamento confirmado (fictício). Documento em emissão.</p></div>' +
        note('CDI pago'),
        tabbar('documentos', { inicio: 'B01', documentos: 'B05' })
    ),
    B06: screen(
      '<h1 data-id="titulo">Pix expirado</h1>' +
        '<div class="card"><p class="info">O tempo para pagar acabou. Gere um novo código para continuar.</p>' +
        '<div class="btn" data-go="B07" data-id="btn_gerar_novo">Gerar novo Pix</div></div>' +
        note('Pix expirado')
    ),
    B07: screen(
      '<h1 data-id="titulo">Novo Pix gerado</h1>' +
        '<div class="card"><div class="qr" data-id="qr"></div>' +
        '<p class="info">Valor: R$ 60,00 (fictício). Expira em 30 minutos.</p>' +
        '<div class="btn secondary" data-tap="copy" data-id="btn_copiar_pix">Copiar código Pix</div></div>' +
        note('novo Pix')
    )
  };
})();
