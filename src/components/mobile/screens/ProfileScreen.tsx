'use client';

import { useState } from 'react';
import { FileText, MessageCircle, Plane, SlidersVertical } from 'lucide-react';
import { SettingRow, MobileToggle, MobileStepper } from '../controls';
import { DEMO_PERSONA } from '../demo-data';

/**
 * Profile — the settings grammar (§03 Row controls): 64-high rows
 * on surface-high with toggle / stepper / disclosure. Sign out
 * lives in the drawer only, never here.
 */
export function ProfileScreen() {
  const [quietHours, setQuietHours] = useState(true);
  const [guests, setGuests] = useState(2);

  return (
    <>
      <h1
        className="text-[22px] font-semibold text-(--neu-text-primary) px-1 m-0"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        Profile
      </h1>

      <div className="flex items-center gap-3.5 px-1 pb-1">
        <span
          className="w-14 h-14 shrink-0 rounded-full bg-(--neu-surface-high) border border-(--neu-edge-strong) flex items-center justify-center text-base font-semibold text-(--neu-accent-deep)"
          style={{ boxShadow: 'var(--neu-shadow-raised)' }}
        >
          {DEMO_PERSONA.initials}
        </span>
        <span className="flex flex-col">
          <span
            className="text-[17px] font-semibold text-(--neu-text-primary)"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {DEMO_PERSONA.name}
          </span>
          <span className="text-xs text-(--neu-text-tertiary)">{DEMO_PERSONA.email}</span>
        </span>
      </div>

      <span
        className="text-[11px] font-semibold text-(--neu-accent-deep) px-1"
        style={{ letterSpacing: '0.14em' }}
      >
        PREFERENCES
      </span>

      <SettingRow title="Quiet hours" sub="Only urgent matters before 08:00">
        <MobileToggle on={quietHours} onChange={setQuietHours} label="Quiet hours" />
      </SettingRow>

      <SettingRow title="Guests" sub="Cabin configuration follows">
        <MobileStepper value={guests} onChange={setGuests} />
      </SettingRow>

      <SettingRow
        title="Preferred carrier"
        sub="Gulfstream G650 · NetJets"
        icon={Plane}
        iconToken="var(--neu-powder-deep)"
        onClick={() => {}}
      />

      <span
        className="text-[11px] font-semibold text-(--neu-accent-deep) px-1 pt-1"
        style={{ letterSpacing: '0.14em' }}
      >
        THE HOUSE
      </span>

      <SettingRow title="Documents" sub="Passports, memberships, papers" icon={FileText} onClick={() => {}} />
      <SettingRow title="Fine tuning" sub="Themes, notices, quiet things" icon={SlidersVertical} onClick={() => {}} />
      <SettingRow title="Reach the house" sub="A person, whenever you wish" icon={MessageCircle} onClick={() => {}} />
    </>
  );
}
