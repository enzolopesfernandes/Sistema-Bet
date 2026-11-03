import type { NextRequest } from "next/server";
import { readAuthBody, authJson } from "@/src/lib/api/auth";
import { adminRequestUser } from "@/src/lib/admin/access";
import { adminFailure } from "@/src/lib/api/admin";
import { savePromotion } from "@/src/lib/promocoes/service";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const body = await readAuthBody(request), user = await adminRequestUser(request); return authJson(await savePromotion(user.id, (await params).id, body)); }
  catch (error) { return adminFailure(error); }
}
