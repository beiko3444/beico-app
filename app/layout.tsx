import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Noto_Sans_JP, Inter } from "next/font/google"; // Import new fonts
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "ベイコ・ベイトルアー | 小売店・卸売業者向け",
  description: "ベイコ・ベイトルアー 小売店・卸売業者向け For retailers & distributors",

  openGraph: {
    title: "ベイコ・ベイトルアー",
    description: "小売店・卸売業者向け | For retailers & distributors",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BEIKO BAIT",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${notoSansJP.variable} ${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}