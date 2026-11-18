import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClientRoot } from '../components/portal/ClientRoot';
import './globals.css';

export const metadata: Metadata = {
  title: 'KeyGo Admin',
  description: 'KeyGo car rental and fleet management portal',
  icons: '/favicon.png',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
