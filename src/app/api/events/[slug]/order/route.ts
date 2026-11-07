import { z } from "zod";
import { handleApiError, isJsonRequest, jsonError, noStore } from "@/lib/api";
import { readCartToken } from "@/lib/cart-cookie";
import { createOrder, getSaleEvent } from "@/lib/seating";
import { normalizeUzPhone } from "@/lib/phone";

const Body = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(200)),
  phone: z.string().transform((v, ctx) => {
    const phone = normalizeUzPhone(v);
    if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
    return phone ?? "";
  }),
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
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "email"
        ? "Email manzilini to'g'ri kiriting"
        : field === "phone"
          ? "Telefon raqamini +998 XX XXX XX XX ko'rinishida kiriting"
          : field === "acceptRules"
            ? "Foydalanish qoidalariga rozilik bildiring"
            : "Ma'lumotlarni tekshiring";
    return jsonError("invalid", message, 400);
  }

  const { slug } = await ctx.params;
  const token = await readCartToken();
  if (!token) return jsonError("empty", "Savat bo'sh. O'rindiqlarni tanlang.", 409);

  try {
    const event = await getSaleEvent(slug);
    const { email, phone, comment } = parsed.data;
    const order = await createOrder(event, token, { email, phone, comment });
    return Response.json({ orderId: order.id }, { status: 201, headers: noStore });
  } catch (e) {
    return handleApiError(e);
  }
}
