import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { argon2id, hash, verify } from "argon2";

export function hashPassword(password: string) {
  return hash(password, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function isSessionToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/u.test(token);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest();
}
