"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { updateUserAuthorization } from "@/lib/actions/profiles";
import { Button, type ButtonStatus } from "@/components/ui/Button";
import { USER_ROLES, ROLE_LABELS } from "@/lib/constants/roles";
import { APP_DOMAINS, DOMAIN_LABELS } from "@/lib/constants/domains";
import type { Profile } from "@/lib/types/database";
import type { ActionResult } from "@/lib/types";

type Props = { user: Profile };

const initialState: ActionResult<Profile> = { data: null, error: null };

export function EditAuthorizationForm({ user }: Props) {
  const [state, formAction, isPending] = useActionState(updateUserAuthorization, initialState);

  const succeeded = state.data !== null;

  // Save morph (polish §03): the button confirms — sage re-tint + check draw +
  // "Saved" — holds 1.8s, then returns to idle. Fires once per submission.
  const handledSaveRef = useRef<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state.data && state.data !== handledSaveRef.current) {
      handledSaveRef.current = state.data;
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1800);
      return () => clearTimeout(t);
    }
  }, [state.data]);

  const saveStatus: ButtonStatus = isPending ? "pending" : saved ? "success" : "idle";

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={user.id} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Role + Domain */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label
              htmlFor="edit_role"
              style={labelStyle}
            >
              Role <span style={{ color: "var(--color-danger)", lineHeight: 1 }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="edit_role"
                name="role"
                defaultValue={user.role}
                required
                style={selectStyle}
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <ChevronDown style={chevronStyle} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label
              htmlFor="edit_domain"
              style={labelStyle}
            >
              Domain <span style={{ color: "var(--color-danger)", lineHeight: 1 }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="edit_domain"
                name="domain"
                defaultValue={user.domain}
                required
                style={selectStyle}
              >
                {APP_DOMAINS.map((d) => (
                  <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>
                ))}
              </select>
              <ChevronDown style={chevronStyle} />
            </div>
          </div>
        </div>

        {/* Warning note */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize:   "var(--text-xs)",
            color:      "var(--color-warning-text)",
            background: "var(--color-warning-light)",
            border:     "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)",
            borderRadius: "var(--radius-sm)",
            padding:    "var(--space-3) var(--space-4)",
            margin:     0,
          }}
        >
          Changing role or domain immediately affects what this person can see and do. All changes are audited.
        </p>

        {/* Feedback */}
        {state.error && (
          <div
            role="alert"
            style={{
              padding:      "var(--space-3) var(--space-4)",
              background:   "var(--color-danger-light)",
              border:       "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)",
              borderRadius: "var(--radius-sm)",
              fontFamily:   "var(--font-sans)",
              fontSize:     "var(--text-sm)",
              color:        "var(--color-danger-text)",
            }}
          >
            {state.error}
          </div>
        )}
        {succeeded && (
          <div
            role="status"
            style={{
              padding:      "var(--space-3) var(--space-4)",
              background:   "var(--color-success-light)",
              border:       "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)",
              borderRadius: "var(--radius-sm)",
              fontFamily:   "var(--font-sans)",
              fontSize:     "var(--text-sm)",
              color:        "var(--color-success-text)",
            }}
          >
            Authorization updated.
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display:        "flex",
            justifyContent: "flex-end",
            paddingTop:     "var(--space-2)",
          }}
        >
          <Button
            variant="primary"
            type="submit"
            status={saveStatus}
            loadingLabel="Saving…"
            successLabel="Saved"
          >
            Update Authorization
          </Button>
        </div>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily:    "var(--font-sans)",
  fontSize:      "var(--text-2xs)",
  fontWeight:    "var(--weight-semibold)",
  color:         "var(--theme-text-tertiary)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  display:       "flex",
  gap:           "var(--space-1)",
};

const selectStyle: React.CSSProperties = {
  width:            "100%",
  padding:          "var(--space-2) var(--space-3)",
  paddingRight:     "var(--space-8)",
  background:       "var(--theme-paper-subtle)",
  border:           "1px solid var(--theme-paper-border)",
  borderRadius:     "var(--radius-sm)",
  fontFamily:       "var(--font-sans)",
  fontSize:         "var(--text-sm)",
  color:            "var(--theme-text-primary)",
  cursor:           "pointer",
  outline:          "none",
  appearance:       "none",
  WebkitAppearance: "none",
  boxSizing:        "border-box",
};

const chevronStyle: React.CSSProperties = {
  position:      "absolute",
  right:         "var(--space-3)",
  top:           "50%",
  transform:     "translateY(-50%)",
  width:         "12px",
  height:        "12px",
  strokeWidth:   1.5,
  color:         "var(--theme-text-tertiary)",
  pointerEvents: "none",
};
