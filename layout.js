import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const font = IBM_Plex_Sans({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font' });

export const metadata = { title: 'IWMS: Inventory & Warehouse Management', description: 'Inventory & Warehouse Management System' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.variable}>{children}</body>
    </html>
  );
}
