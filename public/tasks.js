// Tarefas de cada cenário. O texto aparece no cartão antes da tarefa; o moderador também lê em voz alta.
// "start" é a tela em que a tarefa começa; "success" é a tela que conta como sucesso.
window.TASKS = {
  A: [
    { id: 'A1', texto: 'Seu objetivo é emitir o seu CDI.', start: 'A02', success: 'A06' },
    { id: 'A2', texto: 'Descubra quando é o seu atendimento.', start: 'A07', success: 'A09' }
  ],
  B: [
    { id: 'B1', texto: 'Seu objetivo é emitir o seu CDI.', start: 'B01', success: ['B06', 'B07'] },
    { id: 'B2', texto: 'Seu objetivo é emitir o seu CDI.', start: 'B01', success: 'B05P' },
    { id: 'B3', texto: 'Seu objetivo continua o mesmo: emitir o seu CDI.', start: 'B01', success: 'B13' },
    { id: 'B4', texto: 'Confira, no aplicativo, o histórico dos seus pagamentos de Pix.', start: 'B01', success: 'B14' }
  ]
};
