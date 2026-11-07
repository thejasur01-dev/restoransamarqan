import { z } from "zod";
import { handleApiError, isJsonRequest, jsonError, noStore } from "@/lib/api";
import { ensureCartToken } from "@/lib/cart-cookie";
import { clientIp, hit } from "@/lib/rate-limit";
import { getSaleEvent, getSeatMap, holdSeatGroup, releaseSeatGroup } from "@/lib/seating";

const Body = z.object({
  seatId: z.number().int().positive(),
  action: z.enum(["add", "remove"]),
});

// Adds or removes a seat's whole group (e.g. a table) to/from the visitor's cart.
// Responds with the fresh seat map so the client needs no second request.
export async function POST(request: Request, ctx: RouteContext<"/api/events/[slug]/hold">) {
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid", "Noto'g'ri so'rov", 400);

  // Stops one client from locking up a hall with many fake carts. Generous because
  // mobile operators put many real users behind one IP.
  if (parsed.data.action === "add" && !(await hit(`hold:ip:${await clientIp()}`, 120, 600))) {
    return jsonError("rate_limited", "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring.", 429);
  }

  const { slug } = await ctx.params;
  try {
    const event = await getSaleEvent(slug);
    const token = await ensureCartToken();
    if (parsed.data.action === "add") await holdSeatGroup(event, token, parsed.data.seatId);
    else await releaseSeatGroup(event, token, parsed.data.seatId);
    return Response.json(await getSeatMap(event!, token), { headers: noStore });
  } catch (e) {
    return handleApiError(e);
  }
}
