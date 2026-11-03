export type AdminUser = {
  id: string; nome: string; email: string; papel: "APOSTADOR" | "ADMINISTRADOR";
  status: "ATIVO" | "SUSPENSO" | "BLOQUEADO"; atualizadoEm: string;
};
export type AdminPagination = { page: number; pageSize: number; total: number; totalPages: number };
export type OddsValues = { home: string; draw: string; away: string };
export const OUTCOMES = ["home", "draw", "away"] as const;
export const OUTCOME_LABELS = { home: "Mandante", draw: "Empate", away: "Visitante" };
export type OddsHistory = { id: string; selecao: string; anterior: string; nova: string; motivo: string | null; alteradaEm: string; admin: string };

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function validOdd(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,8}(\.\d{1,4})?$/.test(value) && Number(value) > 1 && Number(value) < 100000000;
}

export function parseAdminPagination(params: { page?: string | string[]; pageSize?: string | string[] }) {
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  return { page: Number.isSafeInteger(page) ? page : 1, pageSize: params.pageSize === "20" ? 20 : 10 };
}
