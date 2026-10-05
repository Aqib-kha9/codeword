import "./globals.css";

export const metadata = {
  title: "SafeText — Encrypt & Decrypt",
  description:
    "Text ke password se taala laga de aur khol de — ekdum aasan. Sab kuchh tohar browser me hi hola, kuchh bhi bahar na jai.",
  manifest: "/manifest.webmanifest",
  applicationName: "SafeText",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SafeText",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f4f1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bho">
      <body>{children}</body>
    </html>
  );
}
