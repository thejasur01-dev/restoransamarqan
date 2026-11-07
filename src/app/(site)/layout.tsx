import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="content" style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
