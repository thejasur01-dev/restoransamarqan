import { noStore, jsonError } from "@/lib/api";
import { readCartToken } from "@/lib/cart-cookie";
import { getSaleEvent, getSeatMap } from "@/lib/seating";

// Live seat availability for the hall plan. Never cached: it changes with every sale.
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[slug]/seats">) {
  const { slug } = await ctx.params;
  const event = await getSaleEvent(slug);
  if (!event) return jsonError("not_found", "Tadbir topilmadi", 404);
  const map = await getSeatMap(event, await readCartToken());
  return Response.json({ ...map, onSale: event.onSale }, { headers: noStore });
}
