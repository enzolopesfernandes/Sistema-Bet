/** IDs negativos identificam partidas locais; positivos pertencem ao provedor. */
export function validMatchId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value !== 0 && Math.abs(value) <= 2147483647;
}
