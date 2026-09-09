import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `How ${site.legalName} collects, uses and protects personal data on this website, under the Kenya Data Protection Act 2019.`,
};

export default function PrivacyPage() {
  const { contact } = site;
  return (
    <div className="mx-auto max-w-reading px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Privacy</span>
      </nav>
      <h1 className="mt-3 text-h1">Privacy notice</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        How {site.legalName} handles personal data on this website. Last updated 9 September 2026.
      </p>

      <div className="prose mt-8">
        <p>
          This notice explains what personal data we collect when you use safuney.com, why we collect it, who we share it
          with and the rights you have under the Kenya Data Protection Act 2019. It is written to be read, not filed. If
          anything is unclear, email us and we will explain.
        </p>

        <h2>Who is responsible for your data</h2>
        <p>
          {site.legalName} is the data controller for this website. You can reach us at{" "}
          <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a>, by phone on{" "}
          <a href={`tel:${contact.phone.e164}`}>{contact.phone.display}</a>, or by post at {contact.address.poBox}. Our
          office is at {contact.address.lines.join(", ")}.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Contact form.</strong> Your name, email address, organisation and phone number if you give them, the
            topic you choose, your message, and whether you ticked the box asking for product guidance by email.
          </li>
          <li>
            <strong>Orders and accounts, once the online shop opens.</strong> Your name, delivery and billing addresses,
            phone number, email address, the products you order, and for organisation accounts the registered name, KRA
            PIN and the names of the people authorised to order.
          </li>
          <li>
            <strong>Payment references.</strong> The M-Pesa receipt number or the card payment reference returned by the
            payment provider, so that we can match a payment to an order. We never receive or store card numbers.
          </li>
          <li>
            <strong>Technical logs.</strong> Your IP address, browser type, the pages you visit and the time of each
            request, collected by our hosting provider and by our own rate-limiting to keep the site working and to stop
            abuse of the contact form.
          </li>
        </ul>

        <h2>Why we use it, and the lawful basis</h2>
        <ul>
          <li>
            <strong>To reply to you and fulfil orders.</strong> Answering an enquiry, preparing a quote, taking payment,
            delivering goods and issuing invoices. Lawful basis: performance of a contract with you, or steps you ask us
            to take before entering one.
          </li>
          <li>
            <strong>To run and protect the site.</strong> Keeping logs, limiting repeated form submissions, preventing
            fraud, and measuring which pages are slow so that we can fix them. Lawful basis: our legitimate interest in a
            working, secure website.
          </li>
          <li>
            <strong>To send product and dilution guidance by email.</strong> Only if you tick the box asking for it.
            Lawful basis: your consent, which you can withdraw at any time using the unsubscribe link in any email or by
            writing to us.
          </li>
          <li>
            <strong>To meet legal obligations.</strong> Keeping tax invoices and payment records for as long as Kenyan
            tax law requires. Lawful basis: legal obligation.
          </li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We share personal data only with providers who need it to do a job for us, and we never sell it.</p>
        <ul>
          <li>
            <strong>Payment providers.</strong> Safaricom, for M-Pesa payments, and Paystack, for card payments. Each
            receives the details needed to process your payment and is responsible for that data under its own privacy
            terms.
          </li>
          <li>
            <strong>Email provider.</strong> The service that delivers our transactional emails, such as order
            confirmations and the acknowledgement you receive after using the contact form.
          </li>
          <li>
            <strong>Hosting.</strong> The site runs on Vercel, which processes requests and technical logs on our
            behalf, and on database and cache services that store form submissions and rate-limit counters.
          </li>
          <li>
            <strong>Delivery.</strong> The rider or courier delivering your order sees the recipient name, address and
            phone number needed to complete the delivery.
          </li>
          <li>
            <strong>Authorities.</strong> When the law requires it, for example a tax audit.
          </li>
        </ul>
        <p>
          Some of these providers process data outside Kenya. Where they do, we rely on their contractual commitments to
          protect the data to a standard consistent with the Act.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Contact form messages are kept for as long as we need them to deal with your enquiry and any follow-up. Order,
          invoice and payment records are kept for as long as Kenyan tax law requires, then deleted. Technical logs are
          kept for a short period for security and performance work and are then discarded. If you have given consent to
          marketing emails, we keep your email address on the list until you unsubscribe.
        </p>

        <h2>Your rights</h2>
        <p>Under the Kenya Data Protection Act 2019 you have the right to:</p>
        <ul>
          <li>be told what personal data we hold about you and receive a copy of it (access);</li>
          <li>have inaccurate or incomplete data corrected;</li>
          <li>have your data deleted where we no longer have a lawful reason to keep it;</li>
          <li>object to processing based on our legitimate interests, including profiling;</li>
          <li>receive the data you gave us in a structured, commonly used format (portability);</li>
          <li>withdraw consent at any time, without affecting what was done before you withdrew it;</li>
          <li>
            complain to the Office of the Data Protection Commissioner if you think we have handled your data unlawfully.
          </li>
        </ul>
        <p>
          To use any of these rights, email <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a> with
          the subject line &ldquo;Data protection request&rdquo;. We may ask you to confirm your identity before we act,
          and we will respond within the time the Act allows.
        </p>

        <h2>Cookies and analytics</h2>
        <p>
          The site uses only the cookies that are strictly necessary for it to work, such as the cookie that remembers
          the contents of your cart or keeps you signed in to an account. We use performance analytics that count page
          views and measure loading speed without tracking you across other websites or building a profile of you. We
          do not use advertising cookies.
        </p>

        <h2>Security</h2>
        <p>
          The site is served over HTTPS. Form submissions are stored in a database that only authorised staff can
          access, and payment card details are entered directly with the payment provider and never pass through our
          servers.
        </p>

        <h2>Changes to this notice</h2>
        <p>
          When we change how we handle personal data, we will update this page and the date at the top. Significant
          changes that affect account holders will also be sent by email.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this notice or about your data: email{" "}
          <a href={`mailto:${contact.email.address}`}>{contact.email.address}</a> or write to {site.legalName},{" "}
          {contact.address.poBox}.
        </p>
      </div>
    </div>
  );
}
