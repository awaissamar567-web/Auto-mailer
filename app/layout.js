import '@fontsource-variable/jetbrains-mono';
import './globals.css';

export const metadata = {
  title: 'Creator Mailer',
  description: 'Personalized creator outreach from your Gmail.',
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1 };

// Applies the saved theme before first paint. Monolith (dark) is the default.
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('creator-mailer-theme');if(t==='daylight'||t==='monolith')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="monolith" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
