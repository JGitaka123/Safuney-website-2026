"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Select, Textarea } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

interface OpenInvoice {
  id: string;
  number: string;
  total: string;
}

/** Small helper: one busy state and one message per form, so two forms cannot confuse each other. */
function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  return { pending, result, setResult, start };
}

/**
 * What finance does to an order after the fact: settle an invoice the money arrived for, record a
 * payment that came in outside the site, or credit part of it back.
 *
 * Each is its own form on purpose. These are the actions that move money on paper, and a shared
 * submit button is how the wrong one gets clicked.
 */
export function FinancePanel({
  orderNumber,
  openInvoices,
  canRecordPayment,
  canIssueCredit,
  markPaid,
  recordPayment,
  creditNote,
}: {
  orderNumber: string;
  openInvoices: OpenInvoice[];
  canRecordPayment: boolean;
  canIssueCredit: boolean;
  markPaid: (invoiceId: string, reference: string, receivedOn: string) => Promise<AdminResult>;
  recordPayment: (orderNumber: string, amountKes: string, reference: string) => Promise<AdminResult>;
  creditNote: (orderNumber: string, amountKes: string, reason: string) => Promise<AdminResult>;
}) {
  const settle = useAction();
  const record = useAction();
  const credit = useAction();
  const [invoiceId, setInvoiceId] = useState(openInvoices[0]?.id ?? "");
  const [settleRef, setSettleRef] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  return (
    <section className="mt-8 border border-line bg-surface p-5">
      <h2 className="text-h3">Finance</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {canIssueCredit && openInvoices.length > 0 && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              settle.start(async () => settle.setResult(await markPaid(invoiceId, settleRef, receivedOn)));
            }}
          >
            <h3 className="text-body font-medium text-ink">Settle an invoice</h3>
            <Select label="Invoice" id="settle-invoice" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} — {i.total}
                </option>
              ))}
            </Select>
            <Input label="Reference the money arrived with" id="settle-ref" value={settleRef} onChange={(e) => setSettleRef(e.target.value)} placeholder="Bank or M-Pesa reference" />
            <Input label="Received on" id="settle-date" type="date" helper="Leave empty for today." value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
            {settle.result ? <Alert variant={settle.result.ok ? "success" : "error"}>{settle.result.message}</Alert> : null}
            <Button type="submit" variant="primary" size="sm" busy={settle.pending} busyLabel="Saving…">
              Mark settled
            </Button>
          </form>
        )}

        {canRecordPayment && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              record.start(async () => record.setResult(await recordPayment(orderNumber, amount, paymentRef)));
            }}
          >
            <h3 className="text-body font-medium text-ink">Record a payment</h3>
            <p className="text-caption text-ink-muted">Money that arrived outside the site — a transfer, cash at the depot, a paybill entry the callback missed.</p>
            <Input label="Amount (KES)" id="pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="12,500" />
            <Input label="Reference" id="pay-ref" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            {record.result ? <Alert variant={record.result.ok ? "success" : "error"}>{record.result.message}</Alert> : null}
            <Button type="submit" variant="secondary" size="sm" busy={record.pending} busyLabel="Saving…">
              Record
            </Button>
          </form>
        )}

        {canIssueCredit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              credit.start(async () => credit.setResult(await creditNote(orderNumber, creditAmount, creditReason)));
            }}
          >
            <h3 className="text-body font-medium text-ink">Issue a credit note</h3>
            <p className="text-caption text-ink-muted">A return, a short delivery, or an agreed adjustment. It reduces what the account owes.</p>
            <Input label="Amount (KES)" id="credit-amount" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} inputMode="decimal" />
            <Textarea label="Reason" id="credit-reason" helper="This appears on the credit note." rows={2} value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
            {credit.result ? <Alert variant={credit.result.ok ? "success" : "error"}>{credit.result.message}</Alert> : null}
            <Button type="submit" variant="secondary" size="sm" busy={credit.pending} busyLabel="Saving…">
              Issue
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
