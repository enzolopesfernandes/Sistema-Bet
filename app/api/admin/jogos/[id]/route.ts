import type { NextRequest } from "next/server";
import { readAuthBody, authJson } from "@/src/lib/api/auth";
import { adminRequestUser } from "@/src/lib/admin/access";
import { adminFailure } from "@/src/lib/api/admin";
import { saveGame } from "@/src/lib/admin/games";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const body = await readAuthBody(request), user = await adminRequestUser(request); return authJson(await saveGame(user.id, (await params).id, body)); }
  catch (error) { return adminFailure(error); }
}
