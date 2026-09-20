import "./globals.css";

export const metadata = {
  title: "TableServe — QR Menu & Ordering",
  description: "Scan, browse, order — the QR menu platform for restaurants and hotels.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
