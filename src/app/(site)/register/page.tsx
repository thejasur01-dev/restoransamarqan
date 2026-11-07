import type { Metadata } from "next";
import { TextPage } from "@/components/TextPage";

export const metadata: Metadata = { title: "Tashkilotchilar uchun" };

export default function RegisterPage() {
  return (
    <TextPage title="Tashkilotchilar uchun">
      {/* TODO: organizer sign-up form once the admin panel exists */}
      <p>Tadbiringiz uchun chipta sotishni boshlash uchun biz bilan bog&apos;laning.</p>
    </TextPage>
  );
}
