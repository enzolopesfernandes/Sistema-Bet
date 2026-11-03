# Histórico de alterações desde o código original

Comparação com o commit `b48ac4b` do repositório `Pedro-SousaM/Sistema-Bet`, usado como ponto de partida. Registro atualizado em 2 de novembro de 2026.

## O que já existia

O código original já implementava cadastro, login, listagem e detalhes de jogos, odds da API com alternativa simulada, apostas simples, histórico, liquidação de resultados e recarga de créditos. Também já continha autenticação, testes, estrutura Next.js/Prisma/MySQL e tabelas para vários dos módulos previstos. As entregas abaixo ampliaram esses fluxos; não representam uma criação do aplicativo do zero.

## Administração de usuários e odds

Entregue no commit `88ee290` e posteriormente integrado aos novos módulos.

- Painel `/admin`, acessível pelo menu de administradores, com busca de usuários por nome/e-mail e paginação.
- Consulta e edição de nome, e-mail e situação do apostador, com revisão, confirmação e cancelamento.
- Bloqueio/desbloqueio de contas; bloqueio ou alteração de e-mail revoga as sessões. Contas administrativas são somente consulta nesse painel.
- Tratamento de e-mail duplicado, dados inválidos e alterações simultâneas, além de auditoria na mesma transação.
- Gerenciamento de odds 1X2 de jogos futuros, seleção por lista ou ID, validação de valores, confirmação e motivo opcional.
- Persistência de jogos antes da primeira aposta e prioridade das odds administrativas sobre as cotações da API e as simuladas.
- Histórico das alterações de odds, com responsável e consulta das últimas 20 alterações por partida.
- Revalidação das odds na confirmação da aposta. Cotações e retornos já contratados são preservados.
- Migração incremental `202611010001_odds_administrativas`, que adiciona `selecao.odd_manual`; utilização das tabelas existentes de histórico e auditoria.
- Testes de permissões, edição, bloqueio, sessões, conflitos, odds e preservação de apostas anteriores.

## Gerenciamento de jogos

- Página `/admin/jogos` para cadastrar partidas locais, editar, remover, cancelar e informar o placar do tempo regulamentar.
- Cadastro com equipes diferentes, campeonato, data futura e odds iniciais de mandante, empate e visitante.
- Partidas locais funcionam sem chave API-Football. Recebem IDs públicos negativos; IDs positivos continuam identificando partidas do provedor.
- Integração com a tela inicial, detalhes, bilhete de aposta, administração de odds e histórico.
- Gerenciamento também das partidas do provedor já persistidas. Alterações administrativas prevalecem sobre os dados em cache.
- Edição de dados básicos e remoção permitidas apenas antes do início e sem apostas. Remoção lógica preserva os registros.
- Proteção contra alterações simultâneas. Cancelamento e resultado são definitivos; placares só podem ser informados após o início.
- Integração da liquidação com resultados administrativos e estorno de jogos cancelados, inclusive antes do horário agendado.

## Promoções

- Página `/admin/promocoes` para cadastrar, editar, pausar, encerrar e remover promoções.
- Configuração de nome, descrição, código opcional, período, aposta mínima, partida opcional e limites de utilização global e por usuário.
- Dois benefícios: bônus fixo em créditos fictícios e aumento percentual da parte de lucro da odd.
- Seleção de uma promoção por aposta, com condição mínima e prévia do benefício no bilhete.
- Validação de disponibilidade, versão, período, valor e limites dentro da transação da aposta, incluindo disputas pelo último uso.
- Registro do benefício contratado e da odd solicitada, preservando o histórico após edições da promoção e impedindo bônus duplicado por reenvio.
- Exibição da promoção nos detalhes da aposta. Na simulação, o bônus concedido permanece em caso de cancelamento do jogo; o estorno devolve o valor apostado e não reabre o limite de utilização.

## Gerenciamento da própria conta

- Página `/conta`, substituindo o antigo modal informativo de configurações.
- Edição de nome/e-mail, alteração de senha e exclusão lógica de conta de apostador, sempre com senha atual.
- Validação de e-mail duplicado e edição concorrente. Alterar e-mail ou senha revoga as sessões e exige novo login.
- Exclusão condicionada a saldo zero em todas as carteiras e ausência de apostas ou saques pendentes. Administradores não podem se excluir por esse fluxo.
- Exclusão bloqueia acesso, substitui os dados de identificação e senha, remove perfil e tokens de recuperação e revoga sessões, preservando operações e auditoria.
- Contas excluídas deixam de aparecer no gerenciamento e não podem ser desbloqueadas nele.

## Saques simulados

- Página `/saques` para solicitar retirada de créditos fictícios e consultar o histórico paginado.
- Página `/admin/saques` para analisar, aprovar ou recusar solicitações; recusa exige motivo.
- Débito único na solicitação, como reserva. Aprovação conclui o processamento sem novo débito; recusa devolve os créditos uma única vez.
- Proteção contra saldo insuficiente, reenvios e decisões concorrentes ou incompatíveis.
- Auditoria administrativa e exibição de situação e motivo no histórico. Nenhum dado bancário é coletado ou pagamento real é executado.

## Banco, APIs e interface

- Migração incremental `202611020001_modulos_restantes`, preservando os dados existentes: tabela de saques, tipos de movimentação, identificação local e versões de jogos, controle de promoções, exclusão lógica de contas e dados do benefício nas apostas.
- APIs para jogos, promoções, conta e saques, seguindo a separação entre handlers, regras de negócio e Prisma.
- Permissões verificadas no servidor e dentro das transações; revalidação de conta ativa nas operações de saldo e apostas.
- Controles de edição concorrente e reaproveitamento da idempotência nas novas operações para evitar movimentações duplicadas.
- Formulários compartilhados com revisão, confirmação, cancelamento, bloqueio durante envio e mensagens de erro/sucesso.
- Novos links no menu e no painel, paginação no servidor e ajustes de estilos para uso em celular.
- Correção do alcance dos estilos de botões administrativos, que afetavam o cabeçalho, e ajuste dos campos de data ao tema escuro.
- Utilitário compartilhado para validar IDs de partidas locais e externas sem dependência circular.

## Ambiente local e execução

Parte dos atalhos e da documentação foi entregue no commit `10d7566`.

- Instalação local de Node.js 22.23.4 e MySQL 8.4.13 portáteis, dependências e geração do cliente Prisma.
- Criação e configuração de `Sistema_Bet_DB`, com MySQL local em `127.0.0.1:3307`, e ajuste de `.env.example` para o nome solicitado.
- Criação de contas locais de administrador e apostador, com senhas aleatórias guardadas fora do repositório; saldo inicial de demonstração de 100 créditos para o apostador.
- Atalhos `iniciar-local.cmd` e `parar-local.cmd`, apoiados por `scripts/local.cjs`, para iniciar e encerrar os processos locais preservando o banco.
- Ajuste do arquivo de dependências resolvidas para incluir o pacote `yaml` necessário à instalação.
- Desenvolvimento alterado para `next dev --webpack` após constatar recarregamentos contínuos com Turbopack neste Windows. O build de produção continua com `next build`.
- Cópia local do banco antes da migração mais recente e verificação de correspondência entre o banco e o schema Prisma.
- Preparação de partida e promoção de demonstração para testar o fluxo sem a API externa. Esses registros pertencem ao banco local e não são enviados com o código.
- Publicação no repositório privado `Enzo-Lopes-Fernandes/Sistema-Bet`, mantendo `origin` apontado para o projeto original e `enzo` para o repositório de trabalho.

## Documentação e verificação

- Leitura dos casos de uso e diagramas fornecidos em `../Documentos` antes das implementações.
- Análise de requisitos em `docs/requisitos-administracao.md`, guia administrativo em `docs/administracao.md` e regras dos novos módulos em `docs/modulos-complementares.md`.
- Atualizações no README e no guia de trabalho `AGENTS.md`, incluindo instalação, migrações e execução local.
- Na entrega dos módulos complementares: **224 testes automatizados aprovados**, lint, verificações TypeScript e build de produção concluídos.
- **63 verificações HTTP com MySQL real**, incluindo operações concorrentes, limites de promoções, estornos, saques e gerenciamento da conta.
- Verificações visuais e interativas no Edge em 390 px e 1440 px, incluindo revisão/cancelamento/confirmação de formulários e seleção de promoção.

## Limites da entrega

Todos os valores são créditos fictícios. Jogos reais continuam dependendo de uma chave API-Football, ainda não configurada neste ambiente. Não foi criada conta externa nem integração de pagamento. A conferência de resultados acontece na consulta/atualização do histórico, sem agendador em segundo plano. O envio ao GitHub publica o código; não cria hospedagem do aplicativo.

Credenciais, `.env`, ferramentas portáteis, banco, cópias de segurança, capturas de tela e dados locais de teste ficam fora da publicação. Para regras detalhadas e comandos de atualização, consulte os guias dos módulos.
