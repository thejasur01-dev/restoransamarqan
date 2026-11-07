import type { Metadata } from "next";
import { TextPage } from "@/components/TextPage";

export const metadata: Metadata = { title: "Foydalanish qoidalari" };

export default function RulesPage() {
  return (
    <TextPage title="Foydalanish qoidalari">
      {/* TODO: replace with the legal text (offer agreement, refunds, personal data) before launch */}
      <p>Foydalanish qoidalari va ommaviy oferta matni tez orada joylashtiriladi.</p>
    </TextPage>
  );
}
