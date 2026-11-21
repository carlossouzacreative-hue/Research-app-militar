# Protótipo de teste: App Exército (CDI)

Protótipo de **média fidelidade**, feito em código, para os testes de usabilidade do case acadêmico de redesign da emissão do CDI. Projeto acadêmico, com dados fictícios e sem vínculo com o Exército Brasileiro.

Cada participante faz os dois cenários (A: agendar atendimento, B: pagar com Pix), com a ordem alternada. O servidor roda no seu PC, um túnel do Cloudflare deixa o link acessível pelo celular das pessoas, e tudo que elas fazem é registrado em dois lugares: no log local e no Microsoft Clarity.

## O que instalar (uma vez)

No PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Cloudflare.cloudflared
```

Feche e abra o PowerShell depois de instalar.

## Primeira vez

```powershell
git clone <endereço do repositório>
cd prototipo-cdi
```

1. Crie o projeto em [clarity.microsoft.com](https://clarity.microsoft.com) e cole o **Project ID** em `config.json` (campo `clarityId`).
2. Rode `.\scripts\iniciar.ps1`.

Se o PowerShell bloquear scripts: `Set-ExecutionPolicy -Scope Process Bypass` e rode de novo.

## Na hora do teste

`.\scripts\iniciar.ps1` atualiza do GitHub (`git pull`), sobe o servidor e o túnel e escreve na tela:

- o link de cada participante, por exemplo `https://xxxx.trycloudflare.com/?p=P1`;
- o link do **painel do moderador** (só para você), com a tabela de status e botões para marcar "Com ajuda", "Abandonou" ou uma nota.

O endereço do túnel muda a cada vez que ele é reiniciado. Mande o link novo para cada pessoa. Ctrl+C encerra tudo.

Teste sozinho antes, com o link do P1 no seu celular, e depois apague a pasta `data\sessions`.

## Controle por PowerShell

| Comando | O que faz |
| --- | --- |
| `.\scripts\status.ps1` | Mostra ordem e status (Pendente, Em andamento, Ok) de cada pessoa |
| `.\scripts\definir.ps1 P3 BA` | Define a ordem (`AB` ou `BA`). Cria o participante se não existir |
| `.\scripts\marcar.ps1 P2 B "Com ajuda"` | Ajusta um status à mão |
| `.\scripts\resumo.ps1` | Gera `data\resumo_tarefas.csv` e `data\resumo_telas.csv` |
| `.\scripts\atualizar.ps1` | Baixa a versão nova do GitHub |

Os dados ficam em `data\` (fora do Git): `participantes.json`, `sessions\P1.jsonl`, os CSVs e o token do painel.

## O que é registrado

Entrada e saída de cada tela (tempo), cada toque (elemento e se foi **toque morto**, em algo que não responde), início e fim de cada tarefa, se chegou à tela de sucesso, se a pessoa tocou em "Terminei a tarefa" e as marcações do moderador. Os mesmos marcos vão para o Clarity como eventos (`A1_inicio`, `B1_sucesso_tela`…) e tags (`participante`, `cenario`, `ordem`, `tarefa`). Nos arquivos só aparecem IDs (P1, P2…), nunca nomes.

## Onde ficam as telas (já vêm do Figma)

- `public/screens.js`: uma entrada por tela. Use `data-go="ID"` para navegar (`back` volta), `data-tap` para elementos que reagem sem navegar, `data-ui` para ações internas (calendário, Pix) e `data-id` para dar nome ao elemento nos logs. Tudo que não tiver `data-go` ou `data-tap` conta como toque morto.
- `public/tasks.js`: texto de cada tarefa, tela em que começa e tela que conta como sucesso.
- `public/style.css`: tokens (cores, tipografia, raios) iguais aos do Figma.

Tela cheia no celular; moldura de iPhone 393×852 no computador.

## Quando o link para de funcionar

O túnel gratuito (trycloudflare) não tem garantia de disponibilidade. Plano B: publicar a pasta `public` no Cloudflare Pages (o log local deixa de funcionar nesse caso, o Clarity continua).

## Estrutura

```
server.js                 servidor Node (sem dependências)
config.json               clarityId, porta
participantes.exemplo.json  modelo; a cópia real fica em data/
public/                   protótipo e painel do moderador
scripts/                  scripts PowerShell
tools/resumo.js           gera os CSVs do resumo
```

## Liberação das tarefas pelo moderador

- O Pix da tarefa B expira em 10 segundos de propósito (só o primeiro; o segundo dura 30 minutos). A pessoa vê o erro e precisa gerar outro.
- Cada tarefa só começa quando você toca em **Liberar** ao lado do participante, no painel. Até lá o botão dele fica cinza ("Aguardando o moderador…").
- O painel mostra se a pessoa está no site (● no site), em que etapa está e destaca em amarelo quem está esperando liberação.
- "Reiniciar" (só A, só B ou tudo) volta a pessoa ao começo daquele cenário, zera o status e guarda o log antigo em `data\arquivo` (nada é apagado). Pede para digitar o ID do participante para confirmar. Abrir o link com `&reset=1` zera só o navegador de quem abriu.
- Ao chegar na tela de sucesso, o protótipo congela e mostra "Missão completa ✓" até a pessoa tocar em "Terminei a tarefa".
- Tela cheia: no Android o toque em "Começar" já pede tela cheia. No iPhone/Android, abra o link e use "Adicionar à tela inicial", depois abra pelo ícone.

## Cenário B (4 tarefas, todas partindo da home)

O estado do CDI aparece nos cards (Início e Documentos) e na tela Pagamentos e só muda quando a pessoa age ou quando você usa o painel.

1. **B1**: gerar o Pix; o primeiro expira em 10 s e a pessoa vê "Pix expirado".
2. **B2**: "Seu Pix expirou. Efetue o pagamento novamente." A pessoa gera outro Pix (30 min, sem botão "Já paguei"). Quando ela disser que pagou, toque em **1. Aprovar pagamento** no painel: abre "Pagamento recebido" na tela dela.
3. **B3**: card em "Pagamento pendente". Com a pessoa olhando, toque em **2. Liberar emissão**: o card muda ao vivo para "Disponível para emitir". Ela emite o documento (confirmar, emitindo, concluído).
4. **B4**: conferir o histórico de Pix em Perfil > Pagamentos.

A home sempre abre o sheet de pagamento: para ver "Pix expirado" ou "Pagamento pendente" a pessoa vai em Documentos. O texto de introdução avisa que o teste é limitado e a tela final agradece.


## Roteiro e anotações (tela única)

`notas.html?t=TOKEN` (também há um link "Abrir Anotações" no painel). É a tela da sessão: à esquerda o roteiro completo (antes de chamar, abertura, perguntas iniciais, tarefas, perguntas finais, encerramento e regras) com os campos de anotação ao lado de cada etapa; à direita o painel do moderador do participante escolhido (liberar, aprovar pagamento, encerrar tarefa, reiniciar, definir nome). Em telas estreitas o painel vai para baixo. Escolha o participante: as tarefas aparecem na ordem do teste dele, com a tarefa atual destacada. Para cada tarefa: resultado (sim / com ajuda / não), nota de 1 a 7 (1 = muito difícil, 7 = muito fácil), toques errados, frase literal e o que mudar. Também há perfil, sugestões e perguntas finais. Salva sozinho em `data/notas/Pn.json`.
