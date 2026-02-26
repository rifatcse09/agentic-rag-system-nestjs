import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agentic RAG',
  description: 'Upload documents and ask questions powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Agentic RAG
            </a>
            <nav className="flex gap-6 text-sm font-medium text-neutral-500">
              <a href="/" className="transition hover:text-neutral-900">
                Upload
              </a>
              <a href="/chat" className="transition hover:text-neutral-900">
                Chat
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
