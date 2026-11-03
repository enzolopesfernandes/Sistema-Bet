# Administração: usuários e odds

O painel também inclui jogos, promoções e aprovação de saques simulados. O [guia dos módulos complementares](modulos-complementares.md) registra os novos fluxos, a migração e o gerenciamento da própria conta.

Implementação baseada nos casos de uso **Gerenciar Usuários** e **Gerenciar Odds**, nos diagramas de sequência e comunicação correspondentes e no diagrama de classes da pasta `../Documentos`. A [análise de requisitos](requisitos-administracao.md) também está incluída neste repositório.

## Ambiente local preparado

Neste computador, o MySQL 8.4.13 foi instalado como processo local em `../.tools`, ouvindo apenas em `127.0.0.1:3307`. O banco `Sistema_Bet_DB` já recebeu o schema atualizado. As credenciais do banco estão no `.env`, que é ignorado pelo Git.

Para iniciar o banco e o aplicativo, execute `iniciar-local.cmd` na pasta do projeto. Acesse **http://localhost:3000**; o painel fica em **http://localhost:3000/admin**. Use o endereço `localhost` também no navegador, pois é a origem utilizada pelo Next para validar as solicitações neste ambiente.

`parar-local.cmd` encerra os processos deste ambiente. Os dados permanecem em `../.tools/mysql-local/data`. Os atalhos dependem das ferramentas portáteis já preparadas neste workspace; em outro computador, siga a configuração manual abaixo.

As contas `admin@sistema-bet.test` e `apostador@sistema-bet.test` foram criadas para desenvolvimento local, com senhas aleatórias salvas em `../.tools/acessos-locais.txt`. A conta de apostador recebeu 100 créditos fictícios na verificação inicial. As senhas e o diretório `.tools` não são enviados ao repositório.

Cadastro, login, autorização administrativa, bloqueio/desbloqueio, revogação de sessão, conflito de edição, recarga idempotente e saldo foram verificados por HTTP com o MySQL real. Para carregar partidas, configure `API_FOOTBALL_KEY` no `.env` com a chave da sua conta. A API-Football ainda não foi validada com uma chave neste ambiente.

## Preparar o banco

Neste workspace, o Node.js portátil foi instalado em `FootBall/.tools/node-v22.23.4-win-x64`. Se `npm` não estiver disponível no terminal PowerShell, execute a partir de `FootBall/Sistema-Bet`:

```powershell
$env:Path = (Resolve-Path '..\.tools\node-v22.23.4-win-x64').Path + ';' + $env:Path
node --version
```

Nesse terminal, use `npm.cmd` e `npx.cmd` no lugar de `npm` e `npx` nos comandos abaixo. Isso altera o PATH apenas da sessão atual. As dependências já foram instaladas neste workspace.

Configure `.env` a partir de `.env.example` com suas credenciais MySQL e chave API-Football. O banco esperado é `Sistema_Bet_DB`. O projeto continua usando créditos fictícios.

Para um banco vazio de desenvolvimento:

```sql
CREATE DATABASE IF NOT EXISTS Sistema_Bet_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```sh
npm install
npx prisma db push
npx prisma generate
npm run dev
```

Para um banco que já usa a versão anterior deste repositório, aplique **uma única vez** a atualização incremental:

```sh
npx prisma db execute --file prisma/migrations/202611010001_odds_administrativas/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

Ela acrescenta apenas `selecao.odd_manual`, inicialmente falso, preservando registros e apostas anteriores. Não execute esse SQL se a coluna já foi criada pelo `db push`. O repositório não tem histórico completo de criação de tabelas para uso de `migrate deploy`.

## Primeiro administrador

Cadastre sua conta em `/cadastro`. No cliente MySQL, conectado ao banco correto, substitua o e-mail abaixo pelo da conta que deve administrar o projeto:

```sql
UPDATE usuario
SET papel = 'ADMINISTRADOR', atualizado_em = CURRENT_TIMESTAMP
WHERE email = 'seu-email@exemplo.com' AND status = 'ATIVO';

SELECT nome, email, papel, status
FROM usuario
WHERE email = 'seu-email@exemplo.com';
```

Esse procedimento é uma configuração local feita pelo responsável pelo banco. Não há senha padrão, elevação de privilégio pelo cadastro público nem endpoint HTTP para promover contas. Entre nessa conta e acesse `/admin`; o menu da conta também mostra **Administração**.

## Fluxos e decisões de implementação

### Usuários

- `/admin` lista e busca por nome/e-mail, com paginação RSC por `page` e `pageSize` (10 ou 20).
- Consultar/editar abre as informações da conta; alterações passam por revisão e confirmação. Cancelar descarta a edição e retorna ao painel.
- Os campos editáveis são nome, e-mail e situação (ativa ou bloqueada). Uma conta suspensa já existente pode manter sua situação, ser bloqueada ou desbloqueada. Criar uma nova suspensão não faz parte deste fluxo.
- Contas administrativas, inclusive a própria, são somente consulta nesse painel. A documentação pede verificar permissão, mas não define uma hierarquia entre administradores; essa limitação evita retirar o acesso administrativo por acidente.
- Bloquear a conta ou alterar seu e-mail revoga as sessões existentes. Desbloquear não reativa sessões revogadas; o usuário deve entrar novamente.
- E-mail duplicado, campos inválidos, ausência de usuário e edição concorrente são tratados. A comparação usa dados anteriores e data da atualização, sem confiar em um identificador de administrador enviado pelo cliente.
- Alteração, revogação de sessões e auditoria são gravadas na mesma transação serializável.

### Odds

- `/admin?aba=odds` lista os próximos jogos retornados pela consulta existente (até 12 na janela de sete dias). A busca por ID permite consultar outra partida brasileira coberta pela API.
- Somente jogos não iniciados, mercados abertos e seleções abertas/pendentes podem receber novas odds. O mercado continua sendo resultado do tempo regulamentar 1X2: mandante, empate e visitante.
- Valores devem ser maiores que 1 e menores que 100.000.000, com até quatro casas decimais. O limite superior acompanha a coluna `Decimal(12,4)`; estes limites concretizam uma validação que os documentos não detalham numericamente.
- A tela exibe as odds atuais, recebe as novas, apresenta uma revisão e só grava após confirmação. O motivo é opcional, com até 500 caracteres.
- Salvar ativa `odd_manual` nas três seleções. As cotações administrativas prevalecem sobre API e fallback simulado, inclusive quando uma nova aposta é registrada. Restaurar o controle ao provedor não faz parte desta entrega.
- A leitura administrativa acontece fora do cache de três horas da API. Se o banco estiver indisponível, a listagem não oferece cotações que possam ignorar uma edição administrativa.
- Jogos que ainda não receberam apostas são persistidos no primeiro salvamento, usando os mesmos identificadores estáveis do fluxo existente.
- A transação revalida a cotação vigente e rejeita uma edição desatualizada. A confirmação de aposta também verifica a cotação manual na transação antes de debitar o saldo.
- `item_aposta.odd_contratada`, `aposta.odd_total` e o retorno das apostas anteriores são preservados.
- `historico_odds` registra cada seleção alterada (inclusive a ativação manual com o mesmo valor); `auditoria_admin` registra a operação. A tela permite consultar as últimas 20 alterações por partida.

### APIs e permissões

| Método | Rota | Conteúdo |
| --- | --- | --- |
| PATCH | `/api/admin/usuarios/ID` | `nome`, `email`, `status`, `anterior` com nome/e-mail/status/atualizadoEm recebidos da listagem |
| PATCH | `/api/admin/odds/ID_API` | `odds: {home,draw,away}`, `anterior: {home,draw,away}`, `motivo` opcional; odds são strings decimais |
| GET | `/api/admin/odds/ID_API` | Últimas 20 alterações da partida |

Páginas e APIs exigem administrador autenticado; as escritas revalidam o administrador ativo dentro da transação. APIs retornam `Cache-Control: no-store`, rejeitam escritas de outra origem e não expõem hashes ou tokens. Identidade e papel enviados pelo cliente não concedem permissão.

## Verificação

```sh
npm test
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p tests/tsconfig.json
npm run build
```

Os testes automatizados verificam autorização, paginação, validações, bloqueio/desbloqueio, revogação, conflitos, persistência de odds, histórico e preservação da cotação contratada. A camada de persistência é simulada nesses testes: eles não acessam o MySQL nem a conta API-Football.

Para validar manualmente após configurar o banco: crie um administrador e um apostador, confirme a negação de acesso do apostador a `/admin`, bloqueie/desbloqueie a conta, edite uma odd futura, confira a nova cotação na página do jogo e confirme que uma aposta anterior conserva sua odd. Abra a edição em duas abas para conferir a rejeição de valores desatualizados.
