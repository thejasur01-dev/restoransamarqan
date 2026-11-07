import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuyWidget } from "@/components/buy/BuyWidget";
import { Spinner } from "@/components/Spinner";
import { readCartToken } from "@/lib/cart-cookie";
import { getSaleEvent, getSeatMap } from "@/lib/seating";

export const metadata: Metadata = { title: "Chipta sotib olish", robots: { index: false } };

async function Widget({ params }: { params: PageProps<"/e/[slug]/buy">["params"] }) {
  const { slug } = await params;
  const event = await getSaleEvent(slug);
  if (!event) notFound();
  const map = await getSeatMap(event, await readCartToken());
  return <BuyWidget slug={slug} initialMap={map} onSale={event.onSale} />;
}

// Full-viewport purchase screen: hall plan, cart with hold timer, checkout.
export default function BuyPage({ params }: PageProps<"/e/[slug]/buy">) {
  return (
    <Suspense fallback={<Spinner />}>
      <Widget params={params} />
    </Suspense>
  );
}
