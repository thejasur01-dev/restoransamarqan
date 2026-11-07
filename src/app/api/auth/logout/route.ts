import { isJsonRequest, jsonError, noStore } from "@/lib/api";
import { logout } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  await logout();
  return Response.json({ ok: true }, { headers: noStore });
}
