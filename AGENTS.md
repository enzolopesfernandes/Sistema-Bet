# AGENTS.md — Sistema Bet

> Mapa de entrada para agentes. Leia este arquivo inteiro antes de alterar o repositório. Não há guias de domínio ainda; este arquivo é a fonte das decisões de estrutura.

## Como trabalhar neste repositório

1. Classifique a mudança: UI/RSC, API, negócio/banco ou infraestrutura.
2. Confirme no código o que já existe. A documentação registra decisões; ela não substitui rotas, exports, schema nem scripts.
3. Preserve as fronteiras de camada. Não antecipe módulos de negócio que ainda não foram pedidos.
4. Atualize este arquivo quando mudar um contrato de pasta, a stack ou uma regra estrutural.

## Contexto

Sistema de apostas em pt-BR, com fins educacionais. O objetivo é exercitar o desenho de um produto de bets: listagens, fluxos de aposta e saldos simulados.

Não há dinheiro real. Valores, odds, depósitos, saques e prêmios, quando existirem, são fictícios e não produzem efeito financeiro. Não integre gateway de pagamento, PIX, cartão, carteira real nem casa de apostas operando com dinheiro. Não trate saldo, aposta ou prêmio como obrigação de pagamento.

O schema contém models de usuários, autenticação e apostas. Não implemente tabelas, páginas ou regras de aposta sem um pedido explícito.

## Stack

Next.js 16 App Router, React 19, TypeScript 5, Prisma 6 (`^6.12.0`) com MySQL, SCSS Modules, Tailwind 4 e Sass.

Autenticação própria com Argon2id para senhas e SHA-256 para hashes de tokens de sessão. Ícones do MUI, com Emotion e `AppRouterCacheProvider` de `@mui/material-nextjs` no layout raiz para os estilos renderizados no servidor. Testes com Vitest 4.

Next 16 e React 19 possuem APIs diferentes de versões anteriores. Antes de aplicar padrões antigos, consulte `node_modules/next/dist/docs/` e os tipos instalados.

`next.config.ts` define `agentRules: false` para o Next não reescrever este arquivo.

O desenvolvimento usa `next dev --webpack`, inclusive no atalho local. O Turbopack instalado neste ambiente causou recarregamentos contínuos ao abrir os formulários; Webpack foi validado no navegador. O build de produção permanece com `next build`.

## Estrutura

```text
app/
  layout.tsx, page.tsx, globals.css   casca do App Router
  (stubs)/                            páginas; a URL não inclui "stubs"
  api/                                handlers HTTP
components/
  auth/                               UI de autenticação
  layout/header/                      casca compartilhada
  page/<página>/                      componentes daquela página
  ui/                                 primitivos visuais
src/
  context/                            contextos leves
  data/                               dados estáticos, sem banco
  hooks/
  lib/                                negócio e o único acesso ao Prisma
    api/                              helpers de request usados pelos handlers
    prisma.ts                         instância única do Prisma Client
  styles/                             tokens e mixins SCSS
  generated/prisma/                   client gerado; não editar e não versionar
lib/                                  utilitários sem banco
prisma/schema.prisma                  datasource MySQL
public/
scripts/
tests/
  fixtures/, helpers/, integration/, unit/
```

| Área | Local |
|---|---|
| Páginas RSC e paginação | `app/` e `app/(stubs)/` |
| Handlers HTTP | `app/api/` |
| UI de cada página | `components/page/<página>/` |
| Casca e primitivos | `components/layout/`, `components/ui/` |
| Negócio e Prisma | `src/lib/` |
| Contexto, hooks, estilos e dados estáticos | `src/context/`, `src/hooks/`, `src/styles/`, `src/data/` |
| Utilitários sem banco | `lib/` |
| Schema | `prisma/` |
| Testes | `tests/` |
| Assets estáticos | `public/` |

O alias `@/*` aponta para a raiz do repositório.

## Regras de divisão

- `app/(stubs)/<recurso>/page.tsx` é uma página fina do App Router. Ela lê `searchParams`, chama funções de `src/lib` e renderiza componentes. A paginação de listagens passa por essa página, com `searchParams` (`page` e o tamanho de página), não por estado de cliente nem por uma biblioteca de paginação.
- Os componentes dessa página ficam em `components/page/<recurso>/`. A página não acumula a árvore visual.
- `app/api/<recurso>/route.ts` valida o request, chama funções de `src/lib` e serializa a resposta. A rota não aplica regra de negócio nem acessa o banco.
- Somente `src/lib/` importa `src/lib/prisma`, `src/generated/prisma/client` ou `@prisma/client`, e somente `src/lib/prisma.ts` executa `new PrismaClient()`.
- `src/lib/prisma.ts` é a única instância. Reutilize o export default. O client gerado sai em `src/generated/prisma` e está no `.gitignore`.
- `src/data/` e `lib/` não acessam o banco. `lib/` fica para utilitário puro, como formatação e `cn`.
- Uma feature nova ganha, quando fizer sentido, `app/(stubs)/<recurso>/`, `app/api/<recurso>/`, `components/page/<recurso>/` e `src/lib/<recurso>/`. Não coloque query Prisma em `app/` nem em `components/`.
- UI, mensagens, logs e comentários novos ficam em português pt-BR.
- Alteração de `prisma/schema.prisma` exige `npx prisma generate`. Não edite `src/generated/prisma/`.
- O clone local usa `DATABASE_URL` em `.env`. O modelo está em `.env.example`. Não versione segredo.

## Comandos

| Objetivo | Comando |
|---|---|
| Desenvolvimento | `npm run dev` |
| Build e produção local | `npm run build`, `npm run start` |
| Lint | `npm run lint` |
| Testes | `npm test` |
| Gerar o client | `npx prisma generate` |

## Checklist de entrega

- Fronteira UI → página RSC ou `app/api` → `src/lib` → Prisma preservada.
- Paginação de lista feita na `page.tsx` do App Router, com a UI em `components/page/<página>/`.
- Nenhuma integração com dinheiro real, pagamento ou prêmio sacável.
- Erros e textos de interface em pt-BR.
- `npm run lint` nas mudanças de código e, para mudança estrutural, `npm run build`.
- Este arquivo atualizado somente se a regra de pasta, a stack ou o contexto educacional mudar.
