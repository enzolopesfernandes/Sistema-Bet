import type { NextRequest } from "next/server";
import { readAuthBody, authJson } from "@/src/lib/api/auth";
import { adminRequestUser } from "@/src/lib/admin/access";
import { adminFailure } from "@/src/lib/api/admin";
import { saveGame } from "@/src/lib/admin/games";
export async function POST(request: NextRequest) {
  try { const body = await readAuthBody(request), user = await adminRequestUser(request); return authJson(await saveGame(user.id, null, body), 201); }
  catch (error) { return adminFailure(error); }
}
