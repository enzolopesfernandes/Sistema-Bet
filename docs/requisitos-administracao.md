# Análise da documentação e escopo da primeira entrega

Esta análise antecede a implementação. A prioridade escolhida é o painel administrativo de usuários e odds. Nenhuma funcionalidade nova foi implementada nesta revisão.

## Fontes examinadas

- `Casos de Uso-20261102T011951Z-1-001/Casos de Uso/Detalhamento de Casos de Uso- Bets.docx`: leitura integral dos 17 casos de uso, incluindo cenários principais, alternativos e de exceção, e inspeção do diagrama geral.
- `Documentação de Diagramas de Sequência e Classes.docx`: inspeção do diagrama de classes e dos diagramas de sequência de Gerenciar Usuários, Gerenciar Odds, Gerenciar Jogos, Apostar em Jogo e Aprovar Saques.
- `Diagramas de Comunicação- Bets-20261102T011954Z-1-001/Diagramas de Comunicação- Bets/Documentação de Diagramas de Comunicação.docx`: inspeção dos diagramas de Gerenciar Usuários e Gerenciar Odds.
- `Documentação de Diagramas de Sequência e Classes(1).docx`: o texto extraído é equivalente e o conjunto de imagens tem os mesmos hashes da versão sem `(1)`. Os nomes internos das imagens variam; isso não representa outra versão dos diagramas.
- Código do repositório `../Sistema-Bet`, especialmente schema Prisma, autenticação, sessões, consulta de jogos/odds e confirmação de apostas. A comparação é estática; a aplicação ainda não foi validada em execução neste ambiente.

Os arquivos `.asta` e os demais diagramas individuais não foram examinados integralmente. A análise visual concentra-se no escopo escolhido e nas suas dependências.

## Inventário dos casos de uso

| Ator | Casos documentados |
| --- | --- |
| Apostador | Criar Conta; Realizar Login; Recarregar Saldo; Verificar Saldo; Visualizar Jogos; Visualizar Histórico de Apostas; Aplicar Promoção; Apostar em Jogo; Sacar Dinheiro; Gerenciar Conta |
| Administrador | Gerenciar Jogos; Gerenciar Odds; Gerenciar Promoções; Gerenciar Usuários; Aprovar Saques |
| Sistema de Pagamento externo | Processar Saque; Processar Pagamento |

## Requisitos da primeira entrega

### Gerenciar Usuários

O caso de uso e os diagramas descrevem este fluxo:

1. O administrador acessa Gerenciar Usuários na sua tela principal.
2. O sistema lista as contas cadastradas.
3. O administrador busca ou seleciona uma conta e consulta suas informações.
4. Escolhe visualizar informações, editar dados, bloquear ou desbloquear a conta.
5. O sistema apresenta os campos ou opções da operação.
6. O administrador confirma; o sistema verifica se a operação é permitida e a executa.
7. O sistema informa o sucesso e exibe os dados atualizados.
8. Cancelar antes da confirmação retorna à tela principal administrativa.

Estados de exceção que fazem parte do requisito:

- Nenhum usuário cadastrado.
- Busca sem correspondência, com possibilidade de nova busca.
- Falha ao carregar os dados da conta.
- Operação não permitida para o usuário selecionado.
- Falha ao executar a operação.
- Falha ao atualizar a informação exibida após a operação.

A documentação não inclui exclusão de usuários nem promoção a administrador nesse caso de uso. Excluir a própria conta e alterar senha aparecem em **Gerenciar Conta**, do apostador, e são outro escopo.

### Gerenciar Odds / Definir Odds

As duas denominações aparecem nos documentos para o mesmo fluxo:

1. O administrador acessa Definir Odds.
2. O sistema lista os jogos disponíveis para configuração.
3. O administrador seleciona um jogo e visualiza suas informações e odds atuais.
4. Informa novas odds e confirma a alteração.
5. O sistema verifica a validade dos valores e sua consistência para o jogo.
6. Atualiza e persiste as odds.
7. Exibe “Odds atualizadas com sucesso” e as novas cotações.
8. Cancelar antes da confirmação retorna à tela principal administrativa.

Estados de exceção documentados:

- “Nenhum jogo disponível para configuração de odds”.
- “Informe valores válidos para as odds”.
- “As odds informadas não podem ser aplicadas ao jogo selecionado”.
- “Não foi possível atualizar as odds neste momento”.
- “Ocorreu um problema ao exibir as odds atualizadas”.

## Modelo de domínio e correspondência com o código

| Documentação | Código existente | Consequência para a implementação |
| --- | --- | --- |
| Usuário, Apostador e Administrador | `usuario`, com `papel` APOSTADOR/ADMINISTRADOR e `status` ATIVO/SUSPENSO/BLOQUEADO | Reutilizar identidade e sessão; acrescentar autorização administrativa no servidor. |
| Verificar permissão antes de executar operação | Sessões já rejeitam usuários inativos, mas não há painel administrativo | Autorizar páginas e APIs; não depender apenas da visibilidade de botões. |
| Jogo e definição de odds | `jogo`, `mercado`, `selecao.odd_atual` | O modelo físico detalha mercados e seleções além do diagrama conceitual. |
| `Jogo_Apostado.oddAplicada` separado de `Jogo.odd` | `item_aposta.odd_contratada` e `aposta.odd_total` separados de `selecao.odd_atual` | Preservar a cotação contratada nas apostas existentes. Essa regra é uma interpretação coerente com ambos os modelos. |
| Interfaces, controles e repositórios nos diagramas | Componentes/páginas, handlers HTTP e serviços de `src/lib` com Prisma | Manter a divisão de responsabilidades sem exigir classes com os mesmos nomes do UML. |
| Persistência das alterações | Tabelas `historico_odds` e `auditoria_admin` já previstas no schema | Podem apoiar rastreabilidade; uma tela de auditoria não é exigida pelos casos de uso. |

O diagrama usa `double` para valores e odds; o banco existente usa `Decimal`. Preservar `Decimal` é uma escolha de implementação compatível com a intenção do modelo, evitando perda de precisão.

## Diferenças relevantes encontradas no código

1. **Não há páginas ou APIs administrativas.** A existência das tabelas não significa que os casos de uso estejam implementados.
2. **A autenticação já identifica o papel do usuário.** `src/lib/auth/session.ts` retorna `papel`, mas `requireUser` apenas exige login.
3. **As odds vêm do provedor ou de simulação.** `src/lib/jogos/odds.ts` consulta API-Football com cache de três horas e possui fallback simulado.
4. **A confirmação da aposta sobrescreve `selecao.odd_atual`.** `src/lib/apostas/service.ts` atualiza esse campo no `upsert`; adicionar apenas um formulário administrativo faria a cotação editada perder sua prioridade.
5. **A cotação contratada já é armazenada na aposta.** Deve continuar independente das edições futuras.
6. **Jogos e seleções são persistidos ao apostar.** O administrador precisa conseguir configurar também um jogo que ainda não tenha recebido apostas. Isso exige tratar a criação/vinculação local ao selecionar ou salvar, sem confundir com o CRUD completo de Gerenciar Jogos.
7. **Bloqueio já é respeitado na autenticação e na consulta de sessão.** Falta a operação administrativa que modifica o estado da conta.

## Pontos que a documentação não define

Estes pontos são decisões de implementação pendentes, não requisitos que se possa atribuir aos documentos:

- Limites numéricos, precisão e critérios concretos de consistência das odds.
- Quais situações de jogo permitem edição de odds; o fluxo atual de apostas aceita apenas partidas não iniciadas.
- Prioridade entre cotações administrativas, API-Football e fallback, e eventual opção para restaurar a cotação do provedor.
- Campos editáveis pelo administrador e política para alterar a própria conta ou outra conta administrativa.
- Significado operacional dos níveis de acesso citados no diagrama de classes.
- Procedimento para criar o primeiro administrador.
- Forma de resolver alterações simultâneas feitas por dois administradores.

Para a futura implementação, a base proposta é manter o mercado 1X2 já existente, preservar apostas contratadas, validar permissões no servidor e impedir que uma atualização do provedor ou uma nova aposta apague silenciosamente a definição administrativa. Esses são critérios técnicos derivados da integração com o código, não transcrições do caso de uso.

## Divergências fora da primeira entrega

- **Saques:** Sacar Dinheiro menciona desconto ao solicitar; Processar Saque também menciona desconto após confirmação. Aprovar Saques acrescenta aprovação antes de encaminhar ao processamento. O fluxo precisa ser unificado antes da implementação para evitar débito duplicado e esclarecer reserva, aprovação e processamento.
- **Pagamentos:** os documentos incluem um sistema externo. `Sistema-Bet/AGENTS.md` e README definem o aplicativo atual como educacional, com créditos fictícios. Essa diferença não impede usuários e odds, mas deve ser considerada quando o módulo de pagamentos/saques entrar no escopo.
- **Promoções:** são aplicadas durante a aposta, com validação de condições e atualização do benefício. Não se resumem a uma página de cupons. O modelo existente distingue bônus em créditos e aumento de odds; os documentos não detalham todas as fórmulas.
- **Diagrama de classes:** contém o método genérico `operation21()` em Administrador. Ele não especifica uma funcionalidade implementável.

## Critérios para verificar a primeira entrega

- Um apostador não acessa nem executa operações administrativas.
- A busca distingue lista vazia, ausência de correspondência e falha de consulta.
- Consultar, editar, bloquear e desbloquear seguem confirmação e cancelamento conforme o fluxo documentado.
- A situação da conta é respeitada pela autenticação.
- A tela de odds mostra o jogo e as cotações atuais antes da alteração.
- Valores inválidos e jogos indisponíveis não geram gravação.
- Cancelar não grava alterações.
- Após sucesso, a tela exibe os valores efetivamente persistidos.
- Novas apostas utilizam a cotação administrativa vigente, e apostas anteriores mantêm a cotação contratada.
- Falhas e conflitos não deixam alterações parciais no banco.

## Estado do ambiente durante a revisão

O repositório foi clonado em `Sistema-Bet`. Node.js portátil foi baixado para `.tools`, mas a instalação das dependências não terminou com sucesso. MySQL e a chave API-Football ainda não foram configurados. Nenhuma alteração de schema, migração ou funcionalidade administrativa foi aplicada; `git status --short` estava vazio ao conferir a interrupção.
