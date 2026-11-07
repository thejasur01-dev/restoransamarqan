import { z } from "zod";
import { handleApiError, isJsonRequest, jsonError, noStore } from "@/lib/api";
import { getCurrentCustomer } from "@/lib/auth";
import { readCartToken } from "@/lib/cart-cookie";
import { normalizeUzPhone } from "@/lib/phone";
import { createOrder, getSaleEvent } from "@/lib/seating";
import { site } from "@/lib/site";

const email = z.string().trim().toLowerCase().max(200);
const comment = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

// With phone login the verified phone is the identity and email is optional.
const LoggedInBody = z.object({
  email: email
    .optional()
    .transform((v) => v || null)
    .pipe(z.email().nullable()),
  comment,
  acceptRules: z.literal(true),
});

// Without it (like the reference site) the buyer types both email and phone.
const GuestBody = z.object({
  email: email.pipe(z.email()),
  phone: z.string().transform((v, ctx) => {
    const phone = normalizeUzPhone(v);
    if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
    return phone ?? "";
  }),
  comment,
  acceptRules: z.literal(true),
});

function validationMessage(field: PropertyKey | undefined) {
  if (field === "email") return "Email manzilini to'g'ri kiriting";
  if (field === "phone") return "Telefon raqamini +998 XX XXX XX XX ko'rinishida kiriting";
  if (field === "acceptRules") return "Foydalanish qoidalariga rozilik bildiring";
  return "Ma'lumotlarni tekshiring";
}

export async function POST(request: Request, ctx: RouteContext<"/api/events/[slug]/order">) {
  if (!isJsonRequest(request)) return jsonError("invalid", "Noto'g'ri so'rov", 415);
  const json = await request.json().catch(() => null);

  let buyer: { customerId: number | null; phone: string; email: string | null; comment: string | null };
  if (site.features.phoneLogin) {
    const customer = await getCurrentCustomer();
    if (!customer) return jsonError("unauthorized", "Telefon raqamingizni tasdiqlang", 401);
    const parsed = LoggedInBody.safeParse(json);
    if (!parsed.success) return jsonError("invalid", validationMessage(parsed.error.issues[0]?.path[0]), 400);
    buyer = { customerId: customer.id, phone: customer.phone, email: parsed.data.email, comment: parsed.data.comment };
  } else {
    const parsed = GuestBody.safeParse(json);
    if (!parsed.success) return jsonError("invalid", validationMessage(parsed.error.issues[0]?.path[0]), 400);
    buyer = { customerId: null, ...parsed.data };
  }

  const { slug } = await ctx.params;
  const token = await readCartToken();
  if (!token) return jsonError("empty", "Savat bo'sh. O'rindiqlarni tanlang.", 409);

  try {
    const event = await getSaleEvent(slug);
    const order = await createOrder(event, token, buyer);
    return Response.json({ orderId: order.id }, { status: 201, headers: noStore });
  } catch (e) {
    return handleApiError(e);
  }
}
