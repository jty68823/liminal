import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { CoworkPanel } from '@/components/cowork/CoworkPanel';
import { AgentWorkspacePanel } from '@/components/cowork/AgentWorkspacePanel';
import { AutoTaskPanel } from '@/components/auto-task/AutoTaskPanel';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Liminal',
  description: 'An open-source AI interface powered by local LLMs',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon-192.png',
  },
  openGraph: {
    title: 'Liminal',
    description: 'An open-source AI interface powered by local LLMs',
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
      try {
        var accent = localStorage.getItem('liminal_accent');
        if (accent) document.documentElement.style.setProperty('--color-accent-primary', accent);
        var fontSize = localStorage.getItem('liminal_font_size');
        var sizeMap = { small: '13px', medium: '15px', large: '17px' };
        if (fontSize && sizeMap[fontSize]) document.body.style.fontSize = sizeMap[fontSize];
      } catch(e) {}
    `,
          }}
        />
        <ClientProviders>
          <div className="flex h-screen overflow-hidden bg-mesh" style={{ background: 'var(--color-bg-primary)' }}>
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative">
              {children}
            </main>
          </div>
          <SettingsPanel />
          <CoworkPanel />
          <AgentWorkspacePanel />
          <AutoTaskPanel />
          <CommandPalette />
          <ConnectionStatus />
        </ClientProviders>
      </body>
    </html>
  );
}
