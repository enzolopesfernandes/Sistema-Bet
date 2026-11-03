import "server-only";

import { NextResponse } from "next/server";
import { AuthError } from "@/src/lib/auth/errors";

class AuthRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function authJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    fetchSite === "cross-site" ||
    (origin !== null && origin !== new URL(request.url).origin)
  ) {
    throw new AuthRequestError("A origem da solicitação não é permitida", 403);
  }
}

export async function readAuthBody(request: Request): Promise<unknown> {
  assertSameOrigin(request);

  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new AuthRequestError("Envie os dados no formato JSON", 415);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new AuthRequestError("Informe os dados solicitados", 400);

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new AuthRequestError("Os dados enviados excedem o tamanho permitido", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuthRequestError("Os dados enviados são inválidos", 400);
  }
}

export function authFailure(error: unknown, fallbackMessage: string) {
  if (error instanceof AuthRequestError) {
    return authJson({ message: error.message }, error.status);
  }
  if (error instanceof AuthError) {
    const status = error.code === "EMAIL_EM_USO" ? 409 :
      error.code === "CONTA_INDISPONIVEL" ? 403 : 401;
    const fieldErrors = error.code === "EMAIL_EM_USO" ||
      error.code === "CONTA_NAO_ENCONTRADA"
      ? { email: error.message }
      : error.code === "SENHA_INCORRETA" ? { senha: error.message } : undefined;
    return authJson({ message: error.message, fieldErrors }, status);
  }

  return authJson({ message: fallbackMessage }, 503);
}
