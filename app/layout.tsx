import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Scentrave ERP',
  description: 'Billing, inventory, and CRM for Scentrave perfumes and attars.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
