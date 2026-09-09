import { ThemeProvider } from 'next-themes';
import type { Metadata } from 'next';
import { ToastContainer } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'WE-ADK',
  description:
    'AI-assisted delivery pipeline: a project holds concept sketches (Sketcher), a requirements spec and working screens (Builder), and harness-based development (Developer).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Exactly the viewport, so a full-height app shell cannot leave a band
          of body background showing beneath it. */}
      <body className="h-dvh overflow-hidden font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
