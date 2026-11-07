import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { AdminAuthError, requireAdmin } from "@/lib/admin/auth";
import { isJsonRequest } from "@/lib/api";
import { checkInTicket } from "@/lib/seating-admin";

const Body = z.object({ code: z.string().min(1).max(200), eventId: z.number().int().positive().nullable() });

// Door scanner: validates a ticket and marks it used in one atomic step
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin("checkin");
  } catch (e) {
    if (e instanceof AdminAuthError) return Response.json({ ok: false, message: "Ruxsat yo'q — qayta kiring" }, { status: 403 });
    throw e;
  }
  if (!isJsonRequest(request)) return Response.json({ ok: false, message: "Noto'g'ri so'rov" }, { status: 415 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, message: "Noto'g'ri so'rov" }, { status: 400 });

  // QR may contain the bare code or a URL ending with it
  const code = parsed.data.code.trim().split(/[/?#=]/).pop() ?? "";
  const result = await checkInTicket(code, parsed.data.eventId, admin.id);

  let stats = null;
  if (parsed.data.eventId) {
    const rows = await db.execute<{ inside: string; sold: string }>(sql`
      select count(*) filter (where i.checked_in_at is not null) as inside, count(*) as sold
      from order_items i join orders o on o.id = i.order_id
      where o.event_id = ${parsed.data.eventId} and o.status = 'paid'`);
    stats = { inside: Number(rows[0].inside), sold: Number(rows[0].sold) };
  }
  return Response.json({ ...result, stats }, { headers: { "Cache-Control": "no-store" } });
}
