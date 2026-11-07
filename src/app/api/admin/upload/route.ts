import { AdminAuthError, audit, requireAdmin } from "@/lib/admin/auth";
import { MAX_UPLOAD_BYTES, detectImage, saveImage } from "@/lib/admin/uploads";

// Poster upload for the event form. A route handler (not a Server Action) because
// Server Actions cap request bodies at 1 MB.
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin("events");
  } catch (e) {
    if (e instanceof AdminAuthError) return Response.json({ error: "Ruxsat yo'q" }, { status: 403 });
    throw e;
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return Response.json({ error: "Rasm 5 MB dan katta bo'lmasin" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Fayl tanlanmagan" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Rasm 5 MB dan katta bo'lmasin" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!detectImage(bytes)) return Response.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin" }, { status: 415 });

  const url = await saveImage(bytes);
  await audit(admin.id, "upload", "image", url, { size: file.size });
  return Response.json({ url });
}
