import { Golos_Text, Geist_Mono } from "next/font/google";
import "./globals.css";

const golosText = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Trip Planner",
  description: "Describe a trip in plain language and get an editable itinerary.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // No `h-full`/`min-h-full` pair here on purpose: pinning <html> to
    // height:100% while page sections ask for viewport-height units gives two
    // competing definitions of "full height" and lets short windows overflow.
    // The page containers own their own min-height; body just paints the
    // canvas, which propagates to the whole viewport.
    <html
      lang="en"
      className={`${golosText.variable} ${geistMono.variable} antialiased`}
    >
      <body className="bg-canvas text-ink">{children}</body>
    </html>
  );
}
