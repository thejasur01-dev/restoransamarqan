import { z } from "zod";
import { isJsonRequest, jsonError, noStore } from "@/lib/api";
import { AuthError, requestLoginCode } from "@/lib/auth";
import { normalizeUzPhone } from "@/lib/phone";

const Body = z.object({ phone: z.string().max(40), viaSms: z.boolean().optional() });

// Sends a one-time login code to the phone (Telegram first, SMS as fallback)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeUzPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return jsonError("invalid", "Telefon raqamini +998 XX XXX XX XX ko'rinishida kiriting", 400);

  try {
    const result = await requestLoginCode(phone, { viaSms: parsed.data.viaSms });
    return Response.json(result, { headers: noStore });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.code, message: e.message, retryAfter: e.retryAfter }, { status: e.status, headers: noStore });
    }
    console.error(e);
    return jsonError("server", "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", 500);
  }
}
