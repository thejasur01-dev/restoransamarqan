import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NotFoundContent } from "@/components/NotFoundContent";

// Unmatched URLs render outside the (site) group, so the chrome is added here.
export default function NotFound() {
  return (
    <>
      <Header />
      <main style={{ flex: 1 }}>
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
