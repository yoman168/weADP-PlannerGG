export function generateStaticParams() {
  return [{ screenId: '_' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
