import { createHash } from "node:crypto";

/** IDs estáveis impedem duplicar mercados e seleções em operações simultâneas. */
export function matchEntityId(fixtureId: number, entity: string) {
  const hash = createHash("sha256").update(`sistema-bet:${fixtureId}:${entity}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
