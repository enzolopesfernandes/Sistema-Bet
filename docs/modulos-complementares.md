# Jogos, promoções, conta e saques simulados

Esta entrega continua os casos de uso da pasta `../Documentos`: **Gerenciar Jogos**, **Gerenciar Promoções**, **Aplicar Promoção**, **Gerenciar Conta**, **Sacar Dinheiro** e **Aprovar Saques**. Os fluxos de pagamento e processamento de saque são adaptados ao contexto educacional estabelecido em `AGENTS.md`: apenas créditos fictícios, sem integração financeira externa.

## Acessos

| Perfil | Página | Operações |
| --- | --- | --- |
| Administrador | `/admin/jogos` | Cadastrar, editar, remover, cancelar e informar resultado de partidas |
| Administrador | `/admin/promocoes` | Cadastrar, editar, pausar, encerrar e remover promoções |
| Administrador | `/admin/saques` | Analisar solicitações, aprovar ou recusar com motivo |
| Conta autenticada | `/conta` | Editar nome/e-mail e alterar senha; apostadores também podem excluir a conta |
| Conta autenticada | `/saques` | Solicitar retirada fictícia e consultar histórico |
| Apostador | `/jogos/ID` | Selecionar promoção durante a confirmação da aposta |

As listagens administrativas e o histórico de saques têm paginação no servidor por `page` e `pageSize` (10 ou 20). Os formulários apresentam revisão, confirmação e cancelamento antes de gravar. Todas as escritas usam a identidade da sessão, conferem a origem da requisição e revalidam a conta/permissão na transação.

## Atualização do banco existente

O ambiente deste workspace já recebeu a atualização. Há uma cópia anterior em `../.tools/mysql-local/antes-modulos-restantes.sql`, contendo dados locais; não deve ser publicada.

Em outro banco que já tenha as duas migrações incrementais anteriores, faça uma cópia e execute **uma única vez**:

```sh
npx prisma db execute --file prisma/migrations/202611020001_modulos_restantes/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

Para banco vazio, continue usando `npx prisma db push` e `npx prisma generate`. Não execute o SQL incremental depois do `db push`. O repositório não contém a migração inicial completa necessária a `migrate deploy`.

A atualização adiciona a tabela `saque`, dois tipos de movimentação, identificação local e controle de edição dos jogos, controle de edição/remoção das promoções, exclusão lógica de contas e o benefício contratado nas apostas. Os registros anteriores são preservados.

## Regras adotadas onde os documentos não detalham o comportamento

### Jogos

- Uma partida local não depende da API-Football. Seu ID público é o negativo de `jogo.local_id`; IDs positivos continuam pertencendo ao provedor. As seleções mantêm identificadores estáveis para apostas, odds e liquidação.
- O cadastro exige equipes diferentes, campeonato, início futuro e três odds 1X2 válidas. O horário do formulário é interpretado no fuso do computador; detalhes e cards usam o fuso de Brasília.
- Jogos persistidos a partir da API também aparecem no gerenciamento. Após uma alteração administrativa, seus dados locais prevalecem sobre o cache do provedor. Uma partida ainda não persistida pode ser incorporada pelo fluxo de definição de odds existente.
- Editar dados básicos ou remover só é permitido antes do início e sem apostas. Isso evita modificar o objeto de apostas já contratadas. Odds têm seu fluxo próprio, que preserva os valores anteriores das apostas.
- Cancelamento e resultado são definitivos. O placar do tempo regulamentar admite inteiros de 0 a 99 e só pode ser registrado após o início.
- A remoção é lógica. Uma versão numérica rejeita edição desatualizada; alterações de odds também incrementam essa versão.
- O histórico do apostador confere resultados administrativos e da API. Cancelamentos podem ser estornados mesmo antes do horário originalmente agendado. O processamento continua por consulta ao histórico ou pelo botão Atualizar resultados, sem tarefa em segundo plano.

### Promoções

- Campos: nome, descrição, código opcional, benefício, período, aposta mínima obrigatória, jogo opcional, limite global opcional, limite por usuário e situação.
- O bônus em créditos é fixo, de 0,01 a 10.000; ele entra na carteira normal após o débito da aposta. O apostador precisa ter saldo para a aposta inteira antes de receber o bônus.
- O aumento de odds vai de 0,01% a 100% e incide sobre o lucro: `1 + (odd - 1) × (1 + percentual / 100)`. A cotação contratada usa quatro casas decimais. Exemplo: odd 2,00 com 25% resulta em 2,25.
- Cada aposta aceita uma promoção. A listagem considera período, jogo e usos disponíveis; o bilhete mostra a condição mínima e a estimativa de benefício. Não é preciso digitar o código, que funciona como identificação administrativa.
- Período, situação, versão, valor mínimo e contadores são revalidados na mesma transação serializável da aposta. Duas tentativas pelo último uso não podem consumir o mesmo limite.
- Uma promoção alterada ou indisponível exige revisar a escolha; a aposta não é confirmada silenciosamente sem o benefício solicitado.
- Idempotência compara também a promoção e sua versão. A odd original solicitada e o benefício contratado ficam registrados para que reenvios não gerem outra aposta ou outro bônus.
- Edições/remoções não alteram benefícios de apostas existentes. O bônus já concedido permanece caso a partida seja cancelada; o estorno devolve apenas o valor apostado e não reabre o limite da promoção. Essa é uma regra explícita da simulação, não uma fórmula definida pelos documentos.

### Conta

- Nome, e-mail, senha e exclusão exigem a senha atual. A edição compara a versão temporal recebida da página e rejeita alterações concorrentes.
- Alterar e-mail ou senha revoga todas as sessões. O usuário entra novamente com os dados novos.
- A exclusão de apostador exige saldo zero em todas as carteiras, ausência de apostas pendentes e ausência de saques pendentes. A conta administrativa não pode se excluir neste fluxo.
- A exclusão é lógica: bloqueia o acesso, substitui nome/e-mail/senha, remove o perfil e tokens de recuperação e revoga sessões. As operações e auditorias anteriores são preservadas; não se trata de apagar todo registro histórico. Contas excluídas não aparecem no gerenciamento de usuários nem podem ser desbloqueadas por ele.

### Saques

- Método único: retirada de créditos de demonstração. Nenhuma informação bancária é coletada.
- Valor entre 0,01 e 10.000 por solicitação. O saldo é debitado uma única vez ao solicitar, funcionando como reserva.
- O administrador vê dados do solicitante, valor, método e data. Aprovar conclui o processamento simulado e não debita novamente. Contas bloqueadas não recebem aprovação.
- Recusar exige motivo e devolve os créditos, inclusive se a conta estiver bloqueada. O histórico mostra a decisão e o motivo.
- Idempotência e transação impedem solicitações/devoluções duplicadas. Repetir a mesma decisão é inofensivo; tentar uma decisão diferente após conclusão gera conflito.
- Essa sequência resolve a divergência documental entre descontar ao solicitar e descontar ao processar: o desconto ocorre apenas na solicitação.

## APIs adicionadas

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST | `/api/admin/jogos` | Cadastro de jogo local |
| PATCH | `/api/admin/jogos/UUID` | Salvar, remover, cancelar ou registrar resultado, com `versao` |
| POST | `/api/admin/promocoes` | Cadastro de promoção |
| PATCH | `/api/admin/promocoes/UUID` | Edição ou remoção, com `versao` |
| GET | `/api/promocoes?jogo=ID` | Benefícios disponíveis para a conta e partida |
| PATCH | `/api/conta` | `acao: dados/senha/excluir`, `senhaAtual`, `anterior` e campos da operação |
| POST | `/api/saques` | `valor`, `metodo: CREDITOS_DEMONSTRACAO`, `idempotencyKey` |
| PATCH | `/api/admin/saques/UUID` | `decisao: APROVADO/RECUSADO`, `motivo` |

`POST /api/apostas` também aceita `promocaoId` e `promocaoVersao`. Ausência desses campos mantém o fluxo anterior.

## Verificação e ambiente

`npm run dev` e `iniciar-local.cmd` usam Webpack. A versão de Turbopack instalada neste Windows recarregava a página repetidamente durante a interação, fechando os formulários. A mudança foi verificada no Edge em 390 px e 1440 px. O build de produção continua usando `next build`.

```sh
npm test
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p tests/tsconfig.json
npm run build
```

Nesta entrega, passaram 224 testes automatizados, lint, TypeScript e build de produção. Foram concluídas 63 verificações HTTP com MySQL real e verificações visuais/interativas no Edge em 390 px e 1440 px. Os testes comuns usam persistência simulada. A entrega também foi verificada por HTTP com MySQL real, contas temporárias e operações concorrentes, incluindo promoções, estornos, aprovação/recusa, alteração de senha e exclusão lógica.

Para experimentar: entre como administrador, cadastre uma partida futura e uma promoção vinculada ao ID dela; entre como apostador, recarregue créditos e faça uma aposta. Solicite um saque em `/saques` e aprove-o com a conta administrativa. Para conferir estorno, cancele a partida e atualize o histórico do apostador.

Jogos reais continuam dependendo de `API_FOOTBALL_KEY`. Não foi criada conta nem obtida chave externa nesta implementação.
