import { MobileTabBar } from '@/components/mobile/MobileTabBar';

/**
 * The four everyday rooms ride the bar — Home, Requests, Activity,
 * Profile — with Elaya lifted at center. Screens scroll under a
 * floating tab bar; bottom clearance = bar 64 + float 16 + breath.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main
        className="flex-1 flex flex-col gap-3.5 px-5 pb-[120px]"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
      >
        {children}
      </main>
      <MobileTabBar />
    </>
  );
}
