import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of sale",
  description: `The terms that apply when you buy from ${site.legalName} online: prices, payment, delivery, product use and liability.`,
};

export default function TermsPage() {
  const { contact } = site;
  return (
    <div className="mx-auto max-w-reading px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Terms of sale</span>
      </nav>
      <h1 className="mt-3 text-h1">Terms of sale</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        What you are agreeing to when you order from {site.legalName} online. Last updated 9 September 2026.
      </p>

      <div className="prose mt-8">
        <p>
          These terms apply to every order placed through safuney.com. By placing an order you accept them. They are
          written in plain language on purpose; where a term has a legal meaning, that meaning applies. Orders placed by
          phone, email or on an approved account may also be covered by a separate written agreement with you, which
          takes precedence where the two differ.
        </p>

        <h2>Who you are buying from</h2>
        <p>
          The seller is {site.legalName}, {contact.address.lines.join(", ")}, {contact.address.poBox}. Email{" "}
          <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a>, phone{" "}
          <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a>.
        </p>

        <h2>Prices and VAT</h2>
        <p>
          Prices are shown in Kenyan shillings. Where VAT applies it is shown on the product page and as a separate line
          at checkout. The total shown at checkout, including VAT and any delivery charge, is the price you agree to pay.
          If we discover a pricing error before dispatch, we will tell you and give you the choice of paying the correct
          price or cancelling for a full refund.
        </p>

        <h2>Payment</h2>
        <p>You can pay by:</p>
        <ul>
          <li>M-Pesa, using the payment request sent to your phone at checkout;</li>
          <li>debit or credit card, processed by our card payment provider;</li>
          <li>invoice, if your organisation has an approved credit account with us;</li>
          <li>cash on delivery, where it is offered for your delivery zone at checkout.</li>
        </ul>
        <p>
          An order is confirmed when we have confirmed your payment, or, for an approved account, when we have accepted
          the order. Until then no contract exists and stock is not reserved. We will send an order confirmation by email
          or SMS. Account orders are subject to the credit limit and payment terms agreed for the account.
        </p>

        <h2>Delivery and collection</h2>
        <p>
          Delivery zones, charges, slots and collection from our office are set out on the{" "}
          <Link href="/delivery-and-returns">delivery and returns</Link> page, which forms part of these terms. The
          delivery charge for your order is shown at checkout before you pay. Goods become your responsibility when they
          are handed over at the delivery address or collected from our office.
        </p>

        <h2>Stock and substitutions</h2>
        <p>
          We aim to keep every listed product in stock. If something you ordered is not available, we will contact you
          before dispatch. We do not substitute a product or a pack size without your agreement. If you prefer not to
          wait or to accept an alternative, we will refund that item.
        </p>

        <h2>Using the products</h2>
        <p>
          The products we sell are professional cleaning and hygiene chemicals intended for use by trained staff. Follow
          the label, the dilution guidance and the safety data sheet for each product, use the personal protective
          equipment it specifies, and never mix products unless the label says you can. Keep concentrates in their
          original containers, closed, and away from food and children. If you are unsure how to use a product, ask us
          before using it.
        </p>

        <h2>Cancelling, returns and damaged goods</h2>
        <p>
          You can cancel an order at no cost at any time before it is dispatched. How to return goods, and what to do if
          a delivery arrives short or damaged, is explained on the{" "}
          <Link href="/delivery-and-returns">delivery and returns</Link> page.
        </p>

        <h2>Our liability</h2>
        <p>
          We are responsible for supplying goods that match their description and are of satisfactory quality. Where the
          law allows, our total liability for any order is limited to the price you paid for it, and we are not liable
          for loss caused by using a product other than as directed on the label and safety data sheet. Nothing in
          these terms limits liability for death or personal injury caused by our negligence, for fraud, or for anything
          else that cannot be limited under Kenyan law.
        </p>

        <h2>Your data</h2>
        <p>
          How we handle the personal data you give us when ordering is set out in our{" "}
          <Link href="/privacy">privacy notice</Link>.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of Kenya, and any dispute will be dealt with by the courts of Kenya. We
          would much rather sort a problem out directly, so please contact us first.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms from time to time. The version shown here when you place an order is the one that
          applies to that order.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about an order or these terms: <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a>{" "}
          or <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a>.
        </p>
      </div>
    </div>
  );
}
