import { redirect } from "next/navigation";
import { requireUser } from "@/src/lib/auth/session";

export default async function Page() {
  await requireUser();
  redirect("/");
}
