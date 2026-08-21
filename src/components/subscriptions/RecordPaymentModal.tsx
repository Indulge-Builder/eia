"use client";

// Record a payment for a monthly/yearly/other subscription. Currency is never
// auto-converted: `rate` is the original-currency amount, `paid_amount_inr` the
// manually-entered INR. Due date defaults to the current cycle; paid date to today.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { FIELD_LABEL_STYLE, INPUT_STYLE, HELP_TEXT_STYLE, todayIso } from "./form-styles";
import { InvoiceField } from "./InvoiceControls";
import { CURRENCY_SYMBOLS } from "@/lib/constants/subscription-constants";
import type { SubscriptionRow } from "@/lib/types/subscription";
import { currentDueDateISO } from "@/lib/utils/subscription-status";
import { addSubscriptionPaymentAction } from "@/lib/actions/subscriptions";

type Props = {
  open: boolean;
  onClose: () => void;
  subscription: SubscriptionRow;
  onSaved?: () => void;
};

export function RecordPaymentModal({ open, onClose, subscription, onSaved }: Props) {
  const toast = useToast;
  const router = useRouter();

  const [rate, setRate] = useState(subscription.amount != null ? String(subscription.amount) : "");
  const [inr, setInr] = useState("");
  const [dueDate, setDueDate] = useState(currentDueDateISO(subscription, new Date()) ?? todayIso());
  const [paidAt, setPaidAt] = useState(todayIso());
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const symbol = CURRENCY_SYMBOLS[subscription.currency];
  const canSubmit =
    rate.trim() !== "" &&
    Number(rate) >= 0 &&
    inr.trim() !== "" &&
    Number(inr) >= 0 &&
    dueDate !== "" &&
    paidAt !== "" &&
    !uploading &&
    !isPending;

  function handleClose() {
    if (isPending) return;
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await addSubscriptionPaymentAction({
        subscriptionId: subscription.id,
        due_date: dueDate,
        paid_at: paidAt,
        rate: Number(rate),
        paid_amount_inr: Number(inr),
        invoice_path: invoicePath,
        notes: notes.trim() || null,
      });
      if (result.error || !result.data) {
        toast.danger("Payment not recorded", { message: result.error ?? undefined });
        return;
      }
      toast.success("Payment recorded");
      onSaved?.();
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record Payment"
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
            iconLeft={CheckCircle2 as LucideIcon}
          >
            {isPending ? "Saving…" : "Record Payment"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Rate (original currency) + INR */}
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="pay-rate">
              Rate ({subscription.currency})
            </label>
            <div style={{ position: "relative" }}>
              <span style={prefixStyle}>{symbol}</span>
              <input
                id="pay-rate"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                disabled={isPending}
                placeholder="0.00"
                style={{ ...INPUT_STYLE, paddingLeft: "var(--space-7)" }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="pay-inr">
              Paid (INR)
            </label>
            <div style={{ position: "relative" }}>
              <span style={prefixStyle}>₹</span>
              <input
                id="pay-inr"
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
        </div>
        <p style={HELP_TEXT_STYLE}>
          Enter the actual INR that left the account — amounts are never auto-converted.
        </p>

        {/* Due date + Paid date */}
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="pay-due">
              Due Date
            </label>
            <input
              id="pay-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isPending}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="pay-paid">
              Paid Date
            </label>
            <input
              id="pay-paid"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              disabled={isPending}
              style={INPUT_STYLE}
            />
          </div>
        </div>

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
          <label className="label-micro" style={FIELD_LABEL_STYLE} htmlFor="pay-notes">
            Notes <span style={{ color: "var(--theme-text-tertiary)" }}>(optional)</span>
          </label>
          <textarea
            id="pay-notes"
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
