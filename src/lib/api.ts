import "server-only";
import { SaleError } from "./seating";

export function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps expected sale failures to clean JSON; anything else is logged and hidden from the client. */
export function handleApiError(e: unknown) {
  if (e instanceof SaleError) return jsonError(e.code, e.message, e.status);
  console.error(e);
  return jsonError("server", "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", 500);
}

/** Rejects cross-site and non-JSON writes (a form on another site can't send application/json). */
export function isJsonRequest(request: Request) {
  return (request.headers.get("content-type") ?? "").startsWith("application/json");
}

export const noStore = { "Cache-Control": "no-store" } as const;
