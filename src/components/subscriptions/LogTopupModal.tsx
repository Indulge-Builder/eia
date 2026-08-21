"use client";

// Log a top-up for a top_up-type subscription (prepaid/credit accounts). Amount +
// currency live on the row (each top-up can differ). paid_amount_inr is the manual
// INR that left the account — never auto-converted.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Plus, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { FIELD_LABEL_STYLE, INPUT_STYLE, HELP_TEXT_STYLE, todayIso } from "./form-styles";
import { InvoiceField } from "./InvoiceControls";
import {
  SUBSCRIPTION_CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  type SubscriptionCurrency,
} from "@/lib/constants/subscription-constants";
import type { SubscriptionRow } from "@/lib/types/subscription";
import { addSubscriptionTopupAction } from "@/lib/actions/subscriptions";

type Props = {
  open: boolean;
  onClose: () => void;
  subscription: SubscriptionRow;
  onSaved?: () => void;
};

export function LogTopupModal({ open, onClose, subscription, onSaved }: Props) {
  const toast = useToast;
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<SubscriptionCurrency>(subscription.currency);
  const [inr, setInr] = useState("");
  const [toppedUpAt, setToppedUpAt] = useState(todayIso());
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    amount.trim() !== "" &&
    Number(amount) >= 0 &&
    inr.trim() !== "" &&
    Number(inr) >= 0 &&
    toppedUpAt !== "" &&
    !uploading &&
    !isPending;

  function handleClose() {
    if (isPending) return;
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await addSubscriptionTopupAction({
        subscriptionId: subscription.id,
        topped_up_at: toppedUpAt,
        amount: Number(amount),
        currency,
        paid_amount_inr: Number(inr),
        invoice_path: invoicePath,
        notes: notes.trim() || null,
      });
      if (result.error || !result.data) {
        toast.danger("Top-up not logged", { message: result.error ?? undefined });
        return;
      }
      toast.success("Top-up logged");
      onSaved?.();
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Log Top-up"
      description={subscription.name}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isPending}
            iconLeft={Plus as LucideIcon}
          >
            {isPending ? "Saving…" : "Log Top-up"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Amount + currency + INR */}
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <div style={{ flex: 1.4 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="top-amount">
              Amount
            </label>
            <div style={{ position: "relative" }}>
              <span style={prefixStyle}>{CURRENCY_SYMBOLS[currency]}</span>
              <input
                id="top-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                placeholder="0.00"
                style={{ ...INPUT_STYLE, paddingLeft: "var(--space-7)" }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="top-currency">
              Currency
            </label>
            <select
              id="top-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as SubscriptionCurrency)}
              disabled={isPending}
              style={INPUT_STYLE}
            >
              {SUBSCRIPTION_CURRENCY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="top-inr">
              Paid (INR)
            </label>
            <div style={{ position: "relative" }}>
              <span style={prefixStyle}>₹</span>
              <input
                id="top-inr"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={inr}
                onChange={(e) => setInr(e.target.value)}
                disabled={isPending}
                placeholder="0.00"
                style={{ ...INPUT_STYLE, paddingLeft: "var(--space-7)" }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="top-date">
              Top-up Date
            </label>
            <input
              id="top-date"
              type="date"
              value={toppedUpAt}
              onChange={(e) => setToppedUpAt(e.target.value)}
              disabled={isPending}
              style={INPUT_STYLE}
            />
          </div>
        </div>
        <p style={HELP_TEXT_STYLE}>
          Enter the actual INR that left the account — amounts are never auto-converted.
        </p>

        {/* Invoice + Notes */}
        <div>
          <label className="label-micro" style={FIELD_LABEL_STYLE}>
            Invoice <span style={{ color: "var(--theme-text-tertiary)" }}>(optional)</span>
          </label>
          <InvoiceField
            value={invoicePath}
            onChange={setInvoicePath}
            onError={(m) => toast.danger("Upload failed", { message: m })}
            onUploadingChange={setUploading}
            disabled={isPending}
          />
        </div>

        <div>
          <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="top-notes">
            Notes <span style={{ color: "var(--theme-text-tertiary)" }}>(optional)</span>
          </label>
          <textarea
            id="top-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            rows={2}
            maxLength={2000}
            style={{ ...INPUT_STYLE, resize: "vertical" }}
          />
        </div>
      </div>
    </Modal>
  );
}

const prefixStyle: CSSProperties = {
  position: "absolute",
  left: "var(--space-3)",
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--theme-text-tertiary)",
  fontSize: "var(--text-sm)",
  pointerEvents: "none",
};
