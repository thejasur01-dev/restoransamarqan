import { isJsonRequest, jsonError, noStore } from "@/lib/api";
import { site } from "@/lib/site";
import { logout } from "@/lib/auth";

export async function POST(request: Request) {
  if (!site.features.phoneLogin) return jsonError("not_found", "Not found", 404);
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  await logout();
  return Response.json({ ok: true }, { headers: noStore });
}
