import { TopNav } from '@/components/TopNav';

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <TopNav />
      <main>{children}</main>
    </div>
  );
}
