import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LIXFNET',
  description: 'Hệ thống xác thực & bảo mật LIXFNET',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
