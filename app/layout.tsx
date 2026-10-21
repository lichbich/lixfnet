import type { Metadata } from 'next';
import { Inter, Playfair_Display, Bebas_Neue } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
});

export const metadata: Metadata = {
  title: 'LIXFNET - Xem phim, series trực tuyến đỉnh cao',
  description: 'Xem các bộ phim, chương trình truyền hình trực tuyến hoặc phát trực tiếp tới TV thông minh, máy tính, thiết bị di động với LIXFNET.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} ${bebas.variable} h-full bg-[#141414] text-[#e5e5e5] antialiased`}
    >
      <head>
        {/* Strip browser extension injected attributes (Bitdefender TrafficLight, IDM) immediately to guarantee clean DOM */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof MutationObserver !== 'undefined') {
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes') {
                        if (
                          m.attributeName === 'bis_skin_checked' ||
                          m.attributeName === 'bis_register' ||
                          (m.attributeName && m.attributeName.indexOf('__processed_') === 0)
                        ) {
                          m.target.removeAttribute(m.attributeName);
                        }
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['bis_skin_checked', 'bis_register']
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#141414] text-[#e5e5e5] font-sans selection:bg-red-600 selection:text-white"
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
