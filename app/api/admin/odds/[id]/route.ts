import type { NextRequest } from "next/server";
import { adminRequestUser } from "@/src/lib/admin/access";
import { getOddsHistory, updateOdds } from "@/src/lib/admin/odds";
import { authJson, readAuthBody } from "@/src/lib/api/auth";
import { adminFailure } from "@/src/lib/api/admin";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const admin = await adminRequestUser(request);
    const { id } = await context.params;
    return authJson({ history: await getOddsHistory(admin.id, Number(id)) });
  } catch (error) { return adminFailure(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const admin = await adminRequestUser(request);
    const body = await readAuthBody(request);
    const { id } = await context.params;
    return authJson({ ...await updateOdds(admin.id, Number(id), body), message: "Odds atualizadas com sucesso" });
  } catch (error) { return adminFailure(error); }
}
