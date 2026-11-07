import { readImage } from "@/lib/admin/uploads";

// Uploaded posters. Names are content hashes, so a file never changes: cache it forever.
export async function GET(_request: Request, ctx: RouteContext<"/media/[name]">) {
  const { name } = await ctx.params;
  const file = await readImage(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
