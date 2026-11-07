import { z } from "zod";
import { handleApiError, isJsonRequest, jsonError, noStore } from "@/lib/api";
import { getCurrentCustomer } from "@/lib/auth";
import { readCartToken } from "@/lib/cart-cookie";
import { createOrder, getSaleEvent } from "@/lib/seating";

const Body = z.object({
  // Optional: the verified phone is the customer's identity; email is only for receipts
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .transform((v) => v || null)
    .pipe(z.email().nullable()),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  acceptRules: z.literal(true),
});

export async function POST(request: Request, ctx: RouteContext<"/api/events/[slug]/order">) {
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);

  // Orders belong to a verified phone, so the buyer can always find their tickets again
  const customer = await getCurrentCustomer();
  if (!customer) return jsonError("unauthorized", "Telefon raqamingizni tasdiqlang", 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "email" ? "Email manzilini to'g'ri kiriting" : field === "acceptRules" ? "Foydalanish qoidalariga rozilik bildiring" : "Ma'lumotlarni tekshiring";
    return jsonError("invalid", message, 400);
  }

  const { slug } = await ctx.params;
  const token = await readCartToken();
  if (!token) return jsonError("empty", "Savat bo'sh. O'rindiqlarni tanlang.", 409);

  try {
    const event = await getSaleEvent(slug);
    const order = await createOrder(event, token, {
      customerId: customer.id,
      phone: customer.phone,
      email: parsed.data.email,
      comment: parsed.data.comment,
    });
    return Response.json({ orderId: order.id }, { status: 201, headers: noStore });
  } catch (e) {
    return handleApiError(e);
  }
}
