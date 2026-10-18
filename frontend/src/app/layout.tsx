import type { Metadata, Viewport } from "next";
import { Google_Sans, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

// the rudraai.online type system: Inter Tight (display), Google Sans (UI and body), JetBrains Mono (labels)
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["500", "600", "700"] });
const googleSans = Google_Sans({ variable: "--font-gsans", subsets: ["latin"], weight: ["400", "500", "700"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Rankwise · SEO, AEO & GEO website audit", template: "%s · Rankwise" },
  description:
    "Paste a URL and see how Google, answer engines and AI assistants like ChatGPT read your site, with a prioritised list of fixes.",
};

export const viewport: Viewport = { themeColor: "#09090b", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} ${googleSans.variable} ${jetbrains.variable} dark h-full antialiased`}>
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
