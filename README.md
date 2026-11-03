# Sistema-Bet

Projeto educacional com Next.js, Prisma e MySQL. Não utiliza dinheiro real.

O [histórico de alterações](docs/historico-de-alteracoes.md) reúne as entregas feitas desde o código original, os testes e os limites do ambiente preparado.

Jogos locais, promoções nas apostas, edição da própria conta e saques simulados com aprovação estão disponíveis. Consulte [o guia dos módulos complementares](docs/modulos-complementares.md) para os fluxos, regras e atualização do banco.

No workspace já preparado, execute `iniciar-local.cmd` e abra **http://localhost:3000**. Use `parar-local.cmd` para encerrar o aplicativo e o MySQL locais. Credenciais e detalhes estão no [guia do ambiente local](docs/administracao.md#ambiente-local-preparado). Esses atalhos utilizam as ferramentas de `../.tools`, que não são versionadas.

## Execução

1. Instale as dependências com `npm install`.
2. Configure `DATABASE_URL` em `.env`, seguindo `.env.example`.
3. O banco deve conter as tabelas descritas em `prisma/schema.prisma`. Para um banco **vazio** de desenvolvimento, execute `npx prisma db push`. Para atualizar o banco existente da versão anterior, aplique uma única vez `npx prisma db execute --file prisma/migrations/202610310001_apostas_saldo/migration.sql --schema prisma/schema.prisma`. O SQL adiciona o identificador externo do jogo e o tipo de recarga simulada, preservando os registros existentes. O projeto foi iniciado com um banco existente, sem histórico de migrações de criação; esse SQL é uma atualização incremental, não uma inicialização via `migrate deploy`.
4. Execute `npx prisma generate` e `npm run dev`.
5. Acesse `/` para a tela inicial, `/cadastro` para criar uma conta ou `/login` para entrar.

## Jogos na tela inicial

- Configure `API_FOOTBALL_KEY` em `.env` com a chave de [API-Football / API-Sports](https://www.api-football.com/documentation-v3). A integração usa o endpoint `/fixtures` e o header `x-apisports-key` exclusivamente no servidor; não use uma variável `NEXT_PUBLIC_` para essa chave.
- São consultadas as partidas de hoje e dos três dias anteriores e seguintes, no fuso `America/Sao_Paulo`. As respostas válidas têm cache compartilhado de três horas para reduzir o consumo da cota. O alcance dos dados depende da cobertura e do plano contratado na API.
- O carrossel mostra até 12 partidas futuras, em ordem de início. Os resultados incluem apenas jogos encerrados (`FT`, `AET`, `PEN`) com os dois placares definidos, ordenados do mais recente ao mais antigo. A listagem tem três colunas no desktop e paginação na página RSC por `?page=1&pageSize=12` (12 ou 24 por página).
- A tela exibe exclusivamente competições cujo `league.country` seja `Brazil` (ou `Brasil`), traduzido para `Brasil` nos cards. Competições internacionais, estrangeiras ou sem país identificado são descartadas antes do limite do carrossel e das consultas de odds. O endpoint `/fixtures` continua sendo consultado por data; o filtro é aplicado no servidor antes de armazenar a resposta no cache.
- As consultas de listagem não gravam jogos e odds no MySQL. O reaproveitamento usa o Data Cache do Next.js (`unstable_cache`), com revalidação de três horas. Na confirmação de uma aposta, o jogo, o mercado 1X2 e a seleção utilizada passam a ser persistidos, vinculados pelo identificador da API-Football. Limpeza do cache e múltiplas instâncias sem cache compartilhado ainda podem gerar chamadas repetidas ao provedor.
- Ausência de chave, falhas do provedor e listas vazias têm estados próprios; dados de demonstração não são exibidos como jogos reais. Falhas parciais preservam os dados recebidos.
- O cabeçalho oferece Gerenciar conta, Histórico de Apostas, Recarregar Saldo e Saques simulados. Administradores também acessam o painel administrativo.

## Detalhes da partida

Os cards de próximos jogos e resultados abrem `/jogos/ID`, uma página pública com placar, situação, data em Brasília, competição, rodada, temporada, estádio, cidade, árbitro e placares por período. A consulta `/fixtures?id=ID&timezone=America/Sao_Paulo` também retorna eventos, estatísticas, escalações e estatísticas dos jogadores em uma única chamada. A tela exibe os lances em ordem cronológica, o comparativo das equipes, os titulares, reservas, formação e técnico, além de minutos, nota, gols, assistências e defesas dos jogadores, conforme os dados disponíveis.

Os detalhes têm cache compartilhado de três horas por partida e chave (identificada apenas por hash), com horário da consulta exibido na página. A navegação não faz prefetch para evitar consultas de detalhes antes do clique. Somente partidas brasileiras são aceitas. Dados ausentes permanecem como não informados, com estados próprios de carregamento, indisponibilidade e partida não encontrada. As odds de jogos futuros reutilizam a integração e o cache existentes. Nenhuma consulta de detalhes grava no banco.

## Odds

As partidas futuras exibem cotações 1X2 (mandante, empate e visitante), consultadas em `/odds?fixture=ID&bet=1`. É usado o primeiro conjunto completo e válido de uma mesma fonte retornada pela API, identificado no card com a data de atualização quando disponível. Na falta de cobertura, são usadas as cotações simuladas estáveis por partida já existentes no projeto. Cotações do provedor têm cache de três horas; são feitas até 12 consultas adicionais por atualização da lista, com concorrência limitada a três. Esse consumo deve ser considerado na cota do plano da API. As cotações servem exclusivamente às apostas educacionais, sem pagamentos. Partidas encerradas não exibem odds.

## Apostas, saldo e histórico

- `/saldo` exige sessão e permite recarregar gratuitamente de 0,01 a 10.000,00 créditos fictícios por solicitação. O único método é Créditos de demonstração. Não há integração de pagamento, dados de cartão, PIX ou saque. A carteira NORMAL começa em zero e é criada na primeira operação.
- Em `/jogos/ID`, partidas ainda não iniciadas oferecem aposta simples em mandante, empate ou visitante. O servidor verifica horário, situação do jogo, mercado, seleção, odd e saldo. O mercado considera os 90 minutos e acréscimos, sem prorrogação ou pênaltis. A aposta aceita de 0,01 a 10.000,00 créditos; o retorno potencial inclui o valor apostado.
- Débito, aposta, snapshots e movimentação são gravados na mesma transação serializável. Carteiras usam versão e atualização condicional para impedir saldo negativo. Conflitos de concorrência são repetidos até três vezes; falhas desfazem a transação. Valores usam Prisma Decimal e retornos são arredondados para centésimos.
- Recargas e apostas exigem uma chave UUID de idempotência. Repetir a mesma chave com o mesmo conteúdo não repete a movimentação; outra conta ou conteúdo diferente recebe erro. Na interface, uma tentativa após falha de rede mantém a chave enquanto os dados permanecem iguais.
- `/apostas` exige sessão e pagina no servidor por `?page=1&pageSize=10` (10 ou 20 registros). Mostra jogo, palpite, data em Brasília, valor, odd, status e possível retorno. Os detalhes consultam novamente o servidor e incluem resultado, valor obtido, data de conclusão e aviso de aposta pendente. Histórico vazio e falhas de consulta têm mensagens distintas.
- Ao abrir o histórico com apostas pendentes, ou clicar em Atualizar resultados, o servidor confere até seis partidas iniciadas por consulta. As consultadas há mais tempo têm prioridade para que jogos antigos indisponíveis não impeçam a conferência dos demais. Jogos `FT`, `AET` e `PEN` usam o placar do tempo regulamentar; sem placar confiável, a aposta continua pendente. `CANC` estorna o valor. Jogos adiados, interrompidos ou abandonados aguardam confirmação. Ganhos e estornos geram créditos fictícios na carteira, uma única vez, na mesma transação da liquidação.
- A conferência reutiliza o cache de três horas dos detalhes. Ela ocorre ao consultar o histórico, sem agendador em segundo plano; em contas com mais de seis partidas pendentes, novas consultas continuam a conferência. Falhas do provedor preservam o histórico e o saldo. Apostas antigas com múltiplas seleções ou sem vínculo com o identificador externo são exibidas, mas não liquidadas automaticamente por este fluxo de apostas simples.
- APIs e detalhes sempre usam a conta da sessão, ignorando identificadores de usuário enviados pelo cliente. Respostas privadas usam `Cache-Control: no-store`, e escritas rejeitam solicitações de outra origem.

## Autenticação

- Cadastro com nome, e-mail normalizado e senha com pelo menos oito caracteres. O índice único do banco também protege contra cadastros simultâneos com o mesmo e-mail.
- Senhas com [Argon2id](https://github.com/ranisalt/node-argon2), salt aleatório, memória de 64 MiB, três iterações e paralelismo 1.
- Sessão de sete dias com token aleatório de 256 bits. Apenas o digest SHA-256 é salvo no campo existente `sessao.refresh_token_sha256`; esse campo identifica a sessão opaca. Não há fluxo separado de refresh nem emissão de JWT.
- Cookie HttpOnly, SameSite=Lax, Path=/ e Secure em produção, que exige HTTPS.
- O login substitui e revoga a sessão anterior apresentada pelo navegador. O logout revoga a sessão no banco e remove o cookie.
- Após o login, o usuário volta à tela inicial com o menu da conta. `/jogos` preserva a validação de acesso no servidor e redireciona para `/`. A validação rejeita sessões expiradas, revogadas e usuários inativos.
- As APIs não retornam senhas, hashes nem tokens em JSON. As mensagens distintas de conta inexistente e senha incorreta seguem o caso de uso fornecido.
- Ícones de [Material UI](https://mui.com/material-ui/material-icons/).

## Endpoints

| Método | Rota | Dados |
| --- | --- | --- |
| POST | `/api/auth/cadastro` | JSON: `nome`, `email`, `senha` |
| POST | `/api/auth/login` | JSON: `email`, `senha` |
| POST | `/api/auth/logout` | Cookie de sessão |
| GET | `/api/auth/sessao` | Retorna os dados públicos do usuário autenticado |
| GET | `/api/saldo` | Retorna `saldo` em créditos fictícios |
| POST | `/api/saldo/recarga` | JSON: `valor` (string), `metodo: CREDITOS_DEMONSTRACAO`, `idempotencyKey` (UUID) |
| GET | `/api/apostas` | Histórico da conta, com `page` e `pageSize` |
| POST | `/api/apostas` | JSON: `jogoId` (ID da API), `selecao: home/draw/away`, `valor` e `odd` (strings), `idempotencyKey` (UUID) |
| GET | `/api/apostas/ID` | Detalhes de uma aposta da conta autenticada |
| POST | `/api/apostas/atualizar-resultados` | Confere resultados e liquida ganhos e estornos fictícios |

## Painel administrativo

Administradores acessam `/admin` para buscar e editar apostadores, bloquear/desbloquear contas e definir odds 1X2 de jogos futuros. As operações exigem confirmação, validam permissões no servidor e registram auditoria. Odds administrativas prevalecem nas novas apostas; as já contratadas são preservadas.

Consulte [Configuração e uso da administração](docs/administracao.md) para preparar `Sistema_Bet_DB`, configurar o primeiro administrador e conhecer os fluxos e APIs. As atualizações incrementais devem ser aplicadas em ordem, conforme a versão do banco: `202610310001_apostas_saldo`, `202611010001_odds_administrativas` e `202611020001_modulos_restantes`. Partidas locais cadastradas pelo administrador podem ser usadas sem API-Football; partidas do provedor exigem a chave.

## Verificação

`npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build`.

Os testes cobrem validação, criptografia, propriedade de apostas, recarga, saldo insuficiente, idempotência, concorrência, paginação, liquidação de ganhos/perdas/cancelamentos e integração dos handlers com os serviços usando persistência simulada. `npm test` não altera o banco configurado no `.env`.
