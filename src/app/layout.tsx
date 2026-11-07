import type { Metadata, Viewport } from "next";
import { Roboto, Pacifico } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const logoFont = Pacifico({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.listTitle} — ${site.name}`, template: `%s — ${site.name}` },
  description: `${site.tagline.join(" ")}. Chiptalarni onlayn xarid qiling.`,
  openGraph: { siteName: site.name, type: "website", locale: "uz_UZ" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d39",
};

// Site chrome (header/footer) lives in (site)/layout; the ticket purchase screen is full-viewport.
export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${roboto.variable} ${logoFont.variable}`}>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
