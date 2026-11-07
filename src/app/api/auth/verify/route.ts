import { z } from "zod";
import { isJsonRequest, jsonError, noStore } from "@/lib/api";
import { site } from "@/lib/site";
import { AuthError, verifyLoginCode } from "@/lib/auth";
import { normalizeUzPhone } from "@/lib/phone";

const Body = z.object({ phone: z.string().max(40), code: z.string().regex(/^\d{4,8}$/) });

// Checks the code and sets the session cookie; the account is created on first login
export async function POST(request: Request) {
  if (!site.features.phoneLogin) return jsonError("not_found", "Not found", 404);
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeUzPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return jsonError("invalid_code", "Kodni to'g'ri kiriting", 400);

  try {
    await verifyLoginCode(phone, parsed.data.code);
    return Response.json({ phone }, { headers: noStore });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e.code, e.message, e.status);
    console.error(e);
    return jsonError("server", "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", 500);
  }
}
