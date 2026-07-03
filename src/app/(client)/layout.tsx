import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/services/profiles-service';

/**
 * The Indulge CLIENT app shell (design_handoff_mobile_system).
 * A separate surface from the staff dashboard: one warm material,
 * one scroll axis, everything sized for the hand (44 floor).
 *
 * Customers have no auth yet (the Elaya customer persona is
 * stubbed), so this surface is gated behind a staff session as an
 * internal preview; the screens run on specimen demo data.
 */
export default async function ClientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) redirect('/login');

  return (
    <div className="min-h-dvh bg-(--neu-canvas)">
      <div className="mx-auto max-w-[430px] min-h-dvh flex flex-col">{children}</div>
    </div>
  );
}
