import type { Metadata, Viewport } from "next";
import { Google_Sans, Inter, Lato } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const googleSans = Google_Sans({ variable: "--font-gsans", subsets: ["latin"], weight: ["400", "500"] });
const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["300", "400", "700"] });

export const metadata: Metadata = {
  title: { default: "Rankwise · SEO, AEO & GEO website audit", template: "%s · Rankwise" },
  description:
    "Paste a URL and see how Google, answer engines and AI assistants like ChatGPT read your site, with a prioritised list of fixes.",
};

export const viewport: Viewport = { themeColor: "#0b0c0f", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${googleSans.variable} ${lato.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-3 focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
