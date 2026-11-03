import type { NextRequest } from "next/server";
import { adminRequestUser } from "@/src/lib/admin/access";
import { updateUser } from "@/src/lib/admin/users";
import { authJson, readAuthBody } from "@/src/lib/api/auth";
import { adminFailure } from "@/src/lib/api/admin";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await adminRequestUser(request);
    const body = await readAuthBody(request);
    const { id } = await context.params;
    return authJson({ user: await updateUser(admin.id, id, body), message: "Operação realizada com sucesso" });
  } catch (error) { return adminFailure(error); }
}
