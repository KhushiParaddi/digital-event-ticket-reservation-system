import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Evently — Event ticket reservations',
  description: 'Browse events, reserve tickets, and manage bookings.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
