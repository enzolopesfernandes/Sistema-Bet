export class BetError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
    this.name = "BetError";
  }
}
