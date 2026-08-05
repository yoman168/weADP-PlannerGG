import { ThemeProvider } from 'next-themes';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WE-ADK',
  description:
    'AI-assisted delivery pipeline: a project holds concept sketches (Sketcher), a requirements spec and working screens (Builder), and harness-based development (Developer).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
