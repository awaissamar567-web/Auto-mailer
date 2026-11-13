import '@fontsource-variable/geist';
import '@fontsource-variable/doto/full.css'; // weight + ROND (rounded dots) axes
import '@fontsource/open-sauce-sans/300.css';
import '@fontsource/open-sauce-sans/400.css';
import '@fontsource/open-sauce-sans/500.css';
import './globals.css';

export const metadata = {
  title: 'Creator Mailer',
  description: 'Personalized creator outreach from your Gmail.',
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1 };

// Applies the saved mode before first paint. Dark is the default.
const MODE_SCRIPT =
  "(function(){try{var m=localStorage.getItem('creator-mailer-mode');if(m==='light'||m==='dark')document.documentElement.setAttribute('data-mode',m);}catch(e){}})();";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-mode="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
