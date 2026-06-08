import "./globals.css";

export const metadata = {
  title: "চিঠি - স্মৃতির পাতায় কিছু কথা",
  description: "মন খুলে চিঠি লিখুন মনের মানুষকে, প্রকাশ করুন গোপন কথা এবং খুঁজে নিন তার উত্তরপত্র।",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
