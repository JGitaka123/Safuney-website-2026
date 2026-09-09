"use client";

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { KENYAN_COUNTIES, normaliseKenyanMobile, type KenyanCounty } from "@safuney/config";
import { Alert, Button, Input, PhoneInput, ProgressSteps, Select, Textarea } from "@safuney/ui";
import {
  placeOrderAction,
  quoteDeliveryAction,
  type CheckoutContext,
  type PlaceOrderInput,
} from "@/lib/checkout/actions";
import { MpesaPending } from "./mpesa-pending";
import { OrderSummaryPanel, type SerializedCartLine } from "./order-summary-panel";

export interface CheckoutWizardProps {
  cart: {
    itemCount: number;
    totalQuantity: number;
    subtotalMinorUnits: string;
    subtotalLabel: string;
    vatMinorUnits: string;
    vatLabel: string;
    totalMinorUnits: string;
    totalLabel: string;
    weightGrams: number;
    lines: SerializedCartLine[];
  };
  context: CheckoutContext;
}

const STEPS = ["Contact", "Delivery", "Payment", "Review"] as const;

export function CheckoutWizard({ cart, context }: CheckoutWizardProps) {
  const router = useRouter();
  const formSummaryId = useId();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSubmitting, startTransition] = useTransition();

  // Contact state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "DELIVERY">("DELIVERY");
  const [county, setCounty] = useState<string>("Nairobi");
  const [town, setTown] = useState("");
  const [line1, setLine1] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");

  // Delivery quote dynamic state
  const [quotedFeeLabel, setQuotedFeeLabel] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "CARD" | "COD" | "INVOICE">("MPESA");
  const [mpesaPhone, setMpesaPhone] = useState("");

  // Review & Meta
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Validation & Server errors
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Active prompt screen (e.g. M-Pesa STK waiting)
  const [mpesaPrompt, setMpesaPrompt] = useState<{
    orderNumber: string;
    accessToken: string;
    phone: string;
    totalLabel: string;
  } | null>(null);

  // Handle county selection to trigger server quote
  const handleCountyChange = async (selectedCounty: string) => {
    setCounty(selectedCounty);
    setDeliveryError(null);
    if (!selectedCounty) {
      setQuotedFeeLabel(null);
      return;
    }
    const res = await quoteDeliveryAction(selectedCounty);
    if (res.ok) {
      setQuotedFeeLabel(res.free ? "Free" : res.feeLabel);
      setAvailableSlots(res.slots);
      if (res.slots.length > 0 && !deliverySlot) {
        setDeliverySlot(res.slots[0]!);
      }
    } else {
      setDeliveryError(res.message);
      setQuotedFeeLabel(null);
    }
  };

  // Step 0 validation -> move to Step 1
  const handleNextFromContact = () => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errors["contact.name"] = "Enter the name of the person placing the order.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors["contact.email"] = "Enter a valid email address; the order confirmation goes there.";
    }
    const cleanPhone = normaliseKenyanMobile(phone);
    if (!cleanPhone) {
      errors["contact.phone"] = "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Check the highlighted contact fields.");
      return;
    }
    setFieldErrors({});
    setFormError(null);
    if (!mpesaPhone && cleanPhone) {
      // Pre-fill mpesa phone with contact phone
      setMpesaPhone(phone);
    }
    // Pre-quote Nairobi delivery if not yet quoted
    if (deliveryMethod === "DELIVERY" && county && !quotedFeeLabel && !deliveryError) {
      void handleCountyChange(county);
    }
    setCurrentStep(1);
  };

  // Step 1 validation -> move to Step 2
  const handleNextFromDelivery = () => {
    const errors: Record<string, string> = {};
    if (deliveryMethod === "DELIVERY") {
      if (!county) {
        errors["delivery.county"] = "Choose the delivery county.";
      }
      if (!town.trim() || town.trim().length < 2) {
        errors["delivery.town"] = "Enter the town, estate, or area.";
      }
      if (deliveryError) {
        errors["delivery.county"] = deliveryError;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Check the highlighted delivery fields.");
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setCurrentStep(2);
  };

  // Step 2 validation -> move to Step 3
  const handleNextFromPayment = () => {
    const errors: Record<string, string> = {};
    const selected = context.methods.find((m) => m.method === paymentMethod);
    if (!selected || !selected.available) {
      errors["paymentMethod"] = selected?.reason ?? "This payment method is currently unavailable.";
    }
    if (paymentMethod === "MPESA") {
      const activePhone = mpesaPhone.trim() || phone.trim();
      if (!normaliseKenyanMobile(activePhone)) {
        errors["payment.mpesaPhone"] = "Enter a valid Kenyan mobile number for the M-Pesa request.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Check the payment options.");
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setCurrentStep(3);
  };

  // Step 3 submission -> place order
  const handlePlaceOrder = () => {
    setFormError(null);
    setFieldErrors({});

    const phoneForPayment = paymentMethod === "MPESA" ? (mpesaPhone.trim() || phone.trim()) : phone.trim();

    const input: PlaceOrderInput = {
      contact: {
        name: name.trim(),
        email: email.trim(),
        phone: phoneForPayment,
        organisation: organisation.trim() || undefined,
      },
      delivery:
        deliveryMethod === "PICKUP"
          ? { method: "PICKUP", slot: deliverySlot || undefined }
          : {
              method: "DELIVERY",
              county: county as KenyanCounty,
              town: town.trim(),
              line1: line1.trim() || undefined,
              landmark: landmark.trim() || undefined,
              deliveryNotes: deliveryNotes.trim() || undefined,
              slot: deliverySlot || undefined,
            },
      paymentMethod,
      poNumber: poNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      const res = await placeOrderAction(input);
      if (!res.ok) {
        setFormError(res.formError || "Something went wrong on our side and the order was not placed.");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }

      if (res.next.kind === "prompt") {
        setMpesaPrompt({
          orderNumber: res.orderNumber,
          accessToken: res.accessToken,
          phone: phoneForPayment,
          totalLabel: cart.totalLabel,
        });
      } else if (res.next.kind === "redirect") {
        window.location.href = res.next.url;
      } else if (res.next.kind === "offline") {
        router.push(`/orders/${res.orderNumber}?token=${res.accessToken}`);
      }
    });
  };

  if (mpesaPrompt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <MpesaPending
          orderNumber={mpesaPrompt.orderNumber}
          accessToken={mpesaPrompt.accessToken}
          phone={mpesaPrompt.phone}
          totalLabel={mpesaPrompt.totalLabel}
          onPayAnotherWay={() => {
            setMpesaPrompt(null);
            setCurrentStep(2);
          }}
        />
      </div>
    );
  }

  const primaryButtonLabel =
    paymentMethod === "MPESA"
      ? `Pay ${cart.totalLabel} with M-Pesa`
      : paymentMethod === "CARD"
        ? `Pay ${cart.totalLabel} with Card`
        : paymentMethod === "COD"
          ? "Place order (Cash on delivery)"
          : "Place order (Invoice)";

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Checkout</h1>
          <p className="mt-1 text-small text-ink-muted">Complete your order with Safuney Limited</p>
        </div>
        <div className="text-right text-caption text-ink-muted">
          <span className="font-mono">Secure checkout</span>
          <br />
          Need help? <a href="tel:+254796808822" className="text-accent underline">+254 796 808 822</a>
        </div>
      </div>

      <ProgressSteps steps={STEPS} current={currentStep} className="mb-8" />

      {formError ? (
        <Alert id={formSummaryId} variant="error" title="Cannot proceed with order" className="mb-8">
          {formError}
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main form column */}
        <div className="lg:col-span-8">
          {/* STEP 0: CONTACT */}
          {currentStep === 0 && (
            <section aria-labelledby="step-contact-heading" className="border border-line bg-surface p-6 md:p-8">
              <h2 id="step-contact-heading" className="text-h2 font-semibold text-ink">
                1. Contact details
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                Order notifications and invoices will be sent to these details.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={fieldErrors["contact.name"]}
                    autoComplete="name"
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    helper="Order receipt and dispatch notes are sent here."
                    error={fieldErrors["contact.email"]}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <PhoneInput
                    label="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    helper="Safaricom or Airtel number (07xx or 01xx)."
                    error={fieldErrors["contact.phone"]}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Organisation / Company"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    optional
                    helper="For institutional invoices, hotels, schools or hospitals."
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button variant="primary" onClick={handleNextFromContact}>
                  Continue to delivery
                </Button>
              </div>
            </section>
          )}

          {/* STEP 1: DELIVERY */}
          {currentStep === 1 && (
            <section aria-labelledby="step-delivery-heading" className="border border-line bg-surface p-6 md:p-8">
              <h2 id="step-delivery-heading" className="text-h2 font-semibold text-ink">
                2. Delivery & collection
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                Choose whether to pick up from Mombasa Road or have items delivered to your premises.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                <label className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${deliveryMethod === "DELIVERY" ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless"}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="DELIVERY"
                    checked={deliveryMethod === "DELIVERY"}
                    onChange={() => setDeliveryMethod("DELIVERY")}
                    className="mt-1 size-4 accent-accent"
                  />
                  <div>
                    <span className="block font-medium text-ink">Delivery to your facility or site</span>
                    <span className="block text-small text-ink-muted">
                      Direct van delivery within Nairobi and major towns, or courier across Kenya.
                    </span>
                  </div>
                </label>

                <label className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${deliveryMethod === "PICKUP" ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless"}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="PICKUP"
                    checked={deliveryMethod === "PICKUP"}
                    onChange={() => {
                      setDeliveryMethod("PICKUP");
                      setQuotedFeeLabel("Free");
                    }}
                    className="mt-1 size-4 accent-accent"
                  />
                  <div>
                    <span className="block font-medium text-ink">Collection (Free) — Mombasa Road, Nairobi</span>
                    <span className="block text-small text-ink-muted">
                      Park View Heights, Mezzanine 3, Office A, Mombasa Road, Nairobi. Ready in 1 working day.
                    </span>
                  </div>
                </label>
              </div>

              {deliveryMethod === "DELIVERY" && (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <Select
                      label="County"
                      value={county}
                      onChange={(e) => void handleCountyChange(e.target.value)}
                      error={fieldErrors["delivery.county"] || deliveryError || undefined}
                      required
                    >
                      {KENYAN_COUNTIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Input
                      label="Town, Estate or Sub-county"
                      value={town}
                      onChange={(e) => setTown(e.target.value)}
                      error={fieldErrors["delivery.town"]}
                      helper="e.g. Westlands, Industrial Area, Kitengela"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Input
                      label="Street, Building or Unit"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      optional
                      helper="e.g. Enterprise Road, Godown 4B, Kitchen Store"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Input
                      label="Nearby landmark"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      optional
                      helper="Helps our delivery driver locate the receiving bay."
                    />
                  </div>

                  {availableSlots.length > 0 ? (
                    <div className="sm:col-span-2">
                      <Select
                        label="Preferred delivery slot"
                        value={deliverySlot}
                        onChange={(e) => setDeliverySlot(e.target.value)}
                        optional
                      >
                        {availableSlots.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

                  <div className="sm:col-span-2">
                    <Textarea
                      label="Delivery instructions"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      optional
                      rows={2}
                      helper="Gate security procedures, offloading requirements, or specific receiving contacts."
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-between">
                <Button variant="secondary" onClick={() => setCurrentStep(0)}>
                  Back to contact
                </Button>
                <Button variant="primary" onClick={handleNextFromDelivery}>
                  Continue to payment
                </Button>
              </div>
            </section>
          )}

          {/* STEP 2: PAYMENT */}
          {currentStep === 2 && (
            <section aria-labelledby="step-payment-heading" className="border border-line bg-surface p-6 md:p-8">
              <h2 id="step-payment-heading" className="text-h2 font-semibold text-ink">
                3. Payment method
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                All transactions are encrypted and audited. The server is the authoritative price source.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                {/* M-Pesa */}
                <label className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${paymentMethod === "MPESA" ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless"}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MPESA"
                    checked={paymentMethod === "MPESA"}
                    onChange={() => setPaymentMethod("MPESA")}
                    className="mt-1 size-4 accent-accent"
                  />
                  <div className="w-full">
                    <span className="block font-medium text-ink">M-Pesa (STK Push)</span>
                    <span className="block text-small text-ink-muted">
                      A payment request will appear automatically on your phone. Enter your M-Pesa PIN to complete.
                    </span>

                    {paymentMethod === "MPESA" && (
                      <div className="mt-4 max-w-sm">
                        <PhoneInput
                          label="Phone number for M-Pesa request"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          error={fieldErrors["payment.mpesaPhone"]}
                          helper="We send the prompt to this Safaricom number."
                          required
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Card */}
                <label className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${paymentMethod === "CARD" ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless"}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={paymentMethod === "CARD"}
                    onChange={() => setPaymentMethod("CARD")}
                    className="mt-1 size-4 accent-accent"
                  />
                  <div>
                    <span className="block font-medium text-ink">Card (Visa, Mastercard)</span>
                    <span className="block text-small text-ink-muted">
                      Pay securely with credit or debit card processed via Paystack.
                    </span>
                  </div>
                </label>

                {/* Cash on delivery */}
                <label className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${paymentMethod === "COD" ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-stainless"}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === "COD"}
                    onChange={() => setPaymentMethod("COD")}
                    className="mt-1 size-4 accent-accent"
                  />
                  <div>
                    <span className="block font-medium text-ink">Cash on delivery</span>
                    <span className="block text-small text-ink-muted">
                      Pay the courier upon delivery or inspect goods upon collection. Cash or M-Pesa accepted by rider.
                    </span>
                  </div>
                </label>

                {/* Invoice (Disabled for guest accounts) */}
                <div className="border border-line bg-ground-deep p-4 opacity-75">
                  <div className="flex items-start gap-3">
                    <input type="radio" disabled className="mt-1 size-4" />
                    <div>
                      <span className="block font-medium text-ink">Invoice (30-day credit terms)</span>
                      <span className="block text-small text-ink-muted">
                        Available exclusively for pre-approved corporate & institutional accounts. Call +254 796 808 822 to apply for credit terms.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                  Back to delivery
                </Button>
                <Button variant="primary" onClick={handleNextFromPayment}>
                  Review order
                </Button>
              </div>
            </section>
          )}

          {/* STEP 3: REVIEW & PLACE */}
          {currentStep === 3 && (
            <section aria-labelledby="step-review-heading" className="border border-line bg-surface p-6 md:p-8">
              <h2 id="step-review-heading" className="text-h2 font-semibold text-ink">
                4. Review and place order
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                Please verify all details before submitting. Stock is formally reserved when this order is submitted.
              </p>

              <div className="mt-6 flex flex-col gap-6">
                {/* Contact snapshot */}
                <div className="border border-line p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-h4 font-medium text-ink">Contact</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(0)}
                      className="text-small text-accent underline hover:text-accent-deep"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-2 text-small text-ink">
                    <span className="font-semibold">{name}</span> {organisation ? `(${organisation})` : ""}
                    <br />
                    {email} · <span className="tabular-nums">{phone}</span>
                  </p>
                </div>

                {/* Delivery snapshot */}
                <div className="border border-line p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-h4 font-medium text-ink">Delivery destination</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-small text-accent underline hover:text-accent-deep"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-2 text-small text-ink">
                    {deliveryMethod === "PICKUP" ? (
                      <span>Collection from Safuney Mombasa Road, Nairobi (Free)</span>
                    ) : (
                      <span>
                        {town}, {county}
                        {line1 ? `, ${line1}` : ""}
                        {landmark ? ` (Near ${landmark})` : ""}
                        {deliverySlot ? ` · Preferred slot: ${deliverySlot}` : ""}
                      </span>
                    )}
                  </p>
                </div>

                {/* Payment snapshot */}
                <div className="border border-line p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-h4 font-medium text-ink">Payment</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-small text-accent underline hover:text-accent-deep"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-2 text-small text-ink">
                    {paymentMethod === "MPESA" && (
                      <span>M-Pesa STK push to <strong className="tabular-nums">{mpesaPhone || phone}</strong></span>
                    )}
                    {paymentMethod === "CARD" && <span>Card payment (Visa/Mastercard via Paystack)</span>}
                    {paymentMethod === "COD" && <span>Cash / M-Pesa on delivery</span>}
                  </p>
                </div>

                {/* Optional PO & Notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Input
                      label="Purchase Order (PO) number"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      optional
                      helper="For customer internal accounting reference."
                    />
                  </div>
                  <div>
                    <Input
                      label="Order notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      optional
                      helper="Any additional instructions for our fulfilment team."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <Button variant="secondary" onClick={() => setCurrentStep(2)} disabled={isSubmitting}>
                  Back to payment
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePlaceOrder}
                  busy={isSubmitting}
                  busyLabel="Reserving stock & initiating order…"
                  className="w-full sm:w-auto"
                >
                  {primaryButtonLabel}
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar column: Order summary */}
        <aside className="lg:col-span-4">
          <OrderSummaryPanel
            lines={cart.lines}
            subtotalLabel={cart.subtotalLabel}
            vatLabel={cart.vatLabel}
            deliveryLabel={quotedFeeLabel}
            deliveryMethod={deliveryMethod}
            deliveryCounty={county}
            totalLabel={cart.totalLabel}
            weightGrams={cart.weightGrams}
          />
        </aside>
      </div>
    </div>
  );
}
