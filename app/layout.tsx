import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Personal Finance Tracker',
  description: 'Track your finances via Telegram bot with Google Sheets integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
