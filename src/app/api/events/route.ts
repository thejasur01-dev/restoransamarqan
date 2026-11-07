import type { NextRequest } from "next/server";
import { listEvents, normalizeListQuery } from "@/lib/events";

// Backs the "load more" button. Data comes from the same cached query as the page.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = normalizeListQuery({
    past: sp.get("past") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
  });
  const data = await listEvents(query);
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
