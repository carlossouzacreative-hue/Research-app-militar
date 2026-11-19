// Tarefas de cada cenário. O texto aparece no cartão antes da tarefa; o moderador também lê em voz alta.
// "start" é a tela em que a tarefa começa; "success" é a tela que conta como sucesso.
window.TASKS = {
  A: [
    { id: 'A1', texto: 'A emissão online do CDI não está disponível. Marque um atendimento presencial.', start: 'A01', success: 'A04' },
    { id: 'A2', texto: 'Descubra quando é o seu atendimento.', start: 'A05', success: 'A06' }
  ],
  B: [
    { id: 'B1', texto: 'O seu CDI está disponível. Pague a taxa com Pix.', start: 'B01', success: 'B05' },
    { id: 'B2', texto: 'O Pix expirou. Gere outro.', start: 'B06', success: 'B07', opcional: true }
  ]
};
