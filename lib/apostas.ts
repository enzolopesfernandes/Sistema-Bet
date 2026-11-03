import { validMatchId } from "./match-id";

export const BET_MESSAGES = {
  required: "Preencha todas as informações para continuar",
  invalidAmount: "Informe um valor válido para recarga",
  invalidStake: "Informe um valor válido para a aposta",
  rechargeSuccess: "Saldo recarregado com sucesso",
  rechargeFailed: "Não foi possível concluir o pagamento. Tente novamente",
  balanceFailed: "Não foi possível atualizar o saldo da conta",
  historyEmpty: "Nenhuma aposta foi encontrada em seu histórico",
  historyFailed: "Não foi possível carregar o histórico de apostas neste momento",
  detailsFailed: "Não foi possível exibir os detalhes da aposta selecionada",
  detailsInvalid: "Ocorreu um problema ao carregar as informações da aposta",
  pending: "Esta aposta ainda está em andamento e não possui resultado final",
  insufficient: "Saldo insuficiente. Recarregue seus créditos fictícios para apostar.",
} as const;

export const DEMO_METHOD = "CREDITOS_DEMONSTRACAO";
export const MAX_AMOUNT = 10000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OUTCOMES = ["home", "draw", "away"] as const;
export type BetOutcome = typeof OUTCOMES[number];
export type BetStatus = "PENDENTE" | "GANHA" | "PERDIDA" | "ANULADA";
export type BetItemResult = "PENDENTE" | "GANHOU" | "PERDEU" | "ANULADA";
export type BetSummary = {
  promocao?: string | null;
  id: string;
  valor: string;
  odd: string;
  retornoPotencial: string;
  valorObtido: string | null;
  status: BetStatus;
  criadaEm: string;
  liquidadaEm: string | null;
  itens: { jogo: string; mercado: string; selecao: string; odd: string; resultado: BetItemResult }[];
};
export type BetPagination = { page: number; pageSize: number; total: number; totalPages: number };

export const BET_STATUS_LABELS: Record<BetStatus, string> = {
  PENDENTE: "Em andamento", GANHA: "Ganha", PERDIDA: "Perdida", ANULADA: "Anulada",
};
export const ITEM_RESULT_LABELS: Record<BetItemResult, string> = {
  PENDENTE: "Aguardando resultado", GANHOU: "Ganhou", PERDEU: "Perdeu", ANULADA: "Anulada",
};
export const formatCredits = (value: string | number) => `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} créditos`;
export const formatOdd = (value: string | number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value));

export function isBetSummary(value: unknown): value is BetSummary {
  const bet = asRecord(value);
  const amount = (item: unknown) => typeof item === "string" && /^\d+(\.\d+)?$/.test(item) && Number.isFinite(Number(item));
  return typeof bet.id === "string" && UUID_PATTERN.test(bet.id)
    && typeof bet.status === "string" && Object.hasOwn(BET_STATUS_LABELS, bet.status)
    && amount(bet.valor) && amount(bet.odd) && amount(bet.retornoPotencial)
    && (bet.valorObtido === null || amount(bet.valorObtido))
    && typeof bet.criadaEm === "string" && Number.isFinite(Date.parse(bet.criadaEm))
    && (bet.liquidadaEm === null || (typeof bet.liquidadaEm === "string" && Number.isFinite(Date.parse(bet.liquidadaEm))))
    && Array.isArray(bet.itens) && bet.itens.length > 0 && bet.itens.every((value) => {
      const item = asRecord(value);
      return [item.jogo, item.mercado, item.selecao].every((field) => typeof field === "string" && field.trim())
        && amount(item.odd) && typeof item.resultado === "string" && Object.hasOwn(ITEM_RESULT_LABELS, item.resultado);
    });
}

/** Normaliza valores em centésimos sem arredondar entradas com casas excedentes. */
export function parseAmount(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{1,5}([.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents < 1 || cents > MAX_AMOUNT * 100) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function parsePagination(params: { page?: string | string[]; pageSize?: string | string[] }) {
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  return { page: Number.isSafeInteger(page) ? page : 1, pageSize: params.pageSize === "20" ? 20 : 10 };
}

export function validateRecharge(body: unknown) {
  const data = asRecord(body);
  if (!data.valor || !data.metodo) return { message: BET_MESSAGES.required };
  const valor = parseAmount(data.valor);
  if (!valor) return { message: BET_MESSAGES.invalidAmount };
  if (data.metodo !== DEMO_METHOD) return { message: "Selecione o método de recarga simulada" };
  if (typeof data.idempotencyKey !== "string" || !UUID_PATTERN.test(data.idempotencyKey)) return { message: "Identificador da solicitação inválido. Atualize a página." };
  return { data: { valor, metodo: DEMO_METHOD, idempotencyKey: data.idempotencyKey } };
}

export function validateBet(body: unknown) {
  const data = asRecord(body);
  const valor = parseAmount(data.valor);
  if (!valor) return { message: BET_MESSAGES.invalidStake };
  if (!validMatchId(data.jogoId)) return { message: "Selecione um jogo válido" };
  if (!OUTCOMES.includes(data.selecao as BetOutcome)) return { message: "Selecione um resultado para apostar" };
  if (typeof data.odd !== "string" || !/^\d{1,8}(\.\d{1,4})?$/.test(data.odd) || Number(data.odd) <= 1) return { message: "A cotação informada é inválida" };
  if (typeof data.idempotencyKey !== "string" || !UUID_PATTERN.test(data.idempotencyKey)) return { message: "Identificador da solicitação inválido. Atualize a página." };
  if (data.promocaoId != null && (typeof data.promocaoId !== "string" || !UUID_PATTERN.test(data.promocaoId) || !Number.isInteger(data.promocaoVersao) || Number(data.promocaoVersao) < 0)) return { message: "Selecione uma promoção válida" };
  return { data: { valor, jogoId: data.jogoId, selecao: data.selecao as BetOutcome, odd: data.odd, idempotencyKey: data.idempotencyKey, promocaoId: data.promocaoId as string | null | undefined, promocaoVersao: data.promocaoVersao as number | undefined } };
}

function asRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}
