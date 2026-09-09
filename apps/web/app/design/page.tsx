import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  Button,
  ButtonLink,
  DilutionTable,
  EmptyState,
  HAZARDS,
  HazardBadge,
  Input,
  PackChip,
  PhoneInput,
  ProductCard,
  ProgressSteps,
  Select,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  ZoneBadge,
  ZoneBand,
  ZONES,
  hazardLabel,
} from "@safuney/ui";
import { site } from "@/config/site";
import { Section, Specimen, Swatch } from "./specimen";
import { PackSelectorDemo, QuantityDemo, SheetDemo, ToastDemo } from "./demos";

export const metadata: Metadata = {
  title: "Design system",
  description: "Every primitive in every state, against the design plan.",
  robots: { index: false, follow: false },
};

const contents = [
  ["palette", "Palette"],
  ["type", "Type scale"],
  ["spacing", "Radius, border and shadow"],
  ["buttons", "Buttons and links"],
  ["zones", "Zone badges and bands"],
  ["hazards", "Hazard badges"],
  ["packs", "Pack chips and pack selector"],
  ["quantity", "Quantity stepper"],
  ["cards", "Product cards"],
  ["tables", "Tables"],
  ["progress", "Progress steps"],
  ["alerts", "Alerts and toast"],
  ["sheet", "Sheet"],
  ["empty", "Empty states"],
  ["forms", "Forms"],
] as const;

const core = [
  { name: "ground, Ward white", hex: "#F4F7F9", swatchClass: "bg-ground", role: "Page background.", contrast: "ink on ground 15.45:1" },
  { name: "surface, White", hex: "#FFFFFF", swatchClass: "bg-surface", role: "Cards, inputs, photography backgrounds, table rows.", contrast: "ink on surface 16.62:1" },
  { name: "ink, Steel ink", hex: "#10202B", swatchClass: "bg-ink", role: "Body text, headings, primary button fill, icons.", contrast: "on white 16.62:1" },
  { name: "ink-muted, Wet steel", hex: "#4A5C68", swatchClass: "bg-ink-muted", role: "Secondary text, captions, labels, placeholders.", contrast: "on white 6.95:1, on ground 6.46:1" },
  { name: "line, Rinse", hex: "#CBD5DB", swatchClass: "bg-line", role: "1 px hairlines, table rules, card borders. Decorative only.", contrast: "vs white 1.49:1 (non-text)" },
  { name: "accent, Dilution teal", hex: "#0B5E73", swatchClass: "bg-accent", role: "Links, focus rings, selected states, progress.", contrast: "on white 7.34:1, white on teal 7.34:1" },
  { name: "accent-deep", hex: "#07485A", swatchClass: "bg-accent-deep", role: "Hover and active for teal buttons and links.", contrast: "on white 10.08:1" },
  { name: "accent-wash", hex: "#E4EFF2", swatchClass: "bg-accent-wash", role: "Selected filter chip, table row highlight, in-cart state.", contrast: "ink on wash 14.19:1" },
  { name: "stainless", hex: "#6F7D87", swatchClass: "bg-stainless", role: "Input borders, disabled text, non-decorative icons.", contrast: "on white 4.23:1" },
  { name: "ground-deep", hex: "#E6ECF0", swatchClass: "bg-ground-deep", role: "Footer, checkout summary panel, table header row.", contrast: "ink on it 13.95:1" },
] as const;

const zoneSwatches = [
  { name: "zone-red, Washrooms", hex: "#B8132A", swatchClass: "bg-zone-red", role: "Washrooms, toilets, sanitary areas. Text on swatch: white.", contrast: "red on white 6.64:1, white on red 6.64:1, on ground 6.17:1" },
  { name: "zone-blue, General areas", hex: "#1747C2", swatchClass: "bg-zone-blue", role: "Floors, corridors, offices, public areas. Text on swatch: white.", contrast: "blue on white 7.73:1, white on blue 7.73:1, on ground 7.18:1" },
  { name: "zone-green, Kitchen and food prep", hex: "#137035", swatchClass: "bg-zone-green", role: "Kitchens, food preparation, food-contact surfaces. Text on swatch: white.", contrast: "green on white 6.18:1, white on green 6.18:1, on ground 5.75:1" },
  { name: "zone-yellow, Clinical and isolation", hex: "#F2C200", swatchClass: "bg-zone-yellow", role: "Clinical, isolation, infection-control areas. Fill only; text on swatch: ink.", contrast: "yellow on white 1.68:1 (never text), ink on yellow 9.89:1" },
  { name: "zone-yellow-ink", hex: "#7A5B00", swatchClass: "bg-zone-yellow-ink", role: "The yellow zone's name in running text.", contrast: "on white 6.32:1" },
] as const;

const statusSwatches = [
  { name: "warning-ink", hex: "#7A5B00", swatchClass: "bg-warning-ink", role: "Hazard notice text: the yellow-zone ink, deliberately.", contrast: "on warning-wash 5.77:1" },
  { name: "warning-wash", hex: "#FFF5CC", swatchClass: "bg-warning-wash", role: "Hazard notice panel and badge fill.", contrast: "warning-ink on it 5.77:1" },
] as const;

const typeScale = [
  { token: "display", measure: "max-w-[28ch]", cls: "text-display", sizes: "32/38 to 52/58, 600", copy: "Professional cleaning chemicals, supplied with the know-how to use them correctly." },
  { token: "h1", measure: "max-w-[28ch]", cls: "text-h1", sizes: "28/34 to 40/46, 600", copy: "Disinfection and sanitisation" },
  { token: "h2", measure: "max-w-[28ch]", cls: "text-h2", sizes: "24/30 to 30/38, 600", copy: "Where will you use it?" },
  { token: "h3", measure: "max-w-[28ch]", cls: "text-h3", sizes: "20/28 to 22/30, 600", copy: "How to use" },
  { token: "h4", measure: "max-w-[28ch]", cls: "text-h4", sizes: "17/24 to 18/26, 600", copy: "QAC-based sanitiser for surface and food-contact areas" },
  { token: "body", measure: "max-w-[62ch]", cls: "text-body", sizes: "16/24 to 17/27, 400", copy: "A concentrate that is over-diluted does not disinfect; under-diluted it wastes money and can damage surfaces." },
  { token: "body-strong", measure: "max-w-[62ch]", cls: "text-body font-medium", sizes: "16/24 to 17/27, 500", copy: "Fill the bottle with water first, then add concentrate." },
  { token: "small", measure: "max-w-[62ch]", cls: "text-small", sizes: "14/21 to 15/22, 400", copy: "Safaricom number, 07xx or 01xx." },
  { token: "caption", measure: "max-w-[62ch]", cls: "text-caption", sizes: "13/18, 400", copy: "VAT 16% included. Excl. price shown for organisation accounts." },
  { token: "label", measure: "max-w-[62ch]", cls: "text-label", sizes: "13/16, 600", copy: "Kitchen and food prep" },
  { token: "button", measure: "max-w-[62ch]", cls: "text-button", sizes: "16/24, 500", copy: "Add to cart" },
  { token: "price", measure: "max-w-[62ch]", cls: "text-price tabular-nums", sizes: "18/24 to 20/26, 600, tnum", copy: "KES 1,250.00" },
  { token: "price-lg", measure: "max-w-[62ch]", cls: "text-price-lg tabular-nums", sizes: "24/30 to 28/34, 600, tnum", copy: "KES 12,480.00" },
  { token: "mono", measure: "max-w-[62ch]", cls: "font-mono text-mono", sizes: "14/20, 400 Mono", copy: "SF-0142, 1:40, RH3K8L2M4Q" },
  { token: "mono-sm", measure: "max-w-[62ch]", cls: "font-mono text-mono-sm", sizes: "12/16, 400 Mono", copy: "5 L, 20 L, 15 kg" },
] as const;

const qacDilution = [
  { ratio: "1:100", use: "Food-contact surfaces", contactTime: "1 min", note: "Rinse with potable water after the contact time." },
  { ratio: "1:40", use: "General surfaces", contactTime: "5 min" },
  { ratio: "1:10", use: "Heavy soil", contactTime: "10 min", note: "Pre-clean first; disinfectants do not work through grease." },
] as const;

const checkoutSteps = ["Contact", "Delivery", "Payment", "Review"] as const;

function BodyLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="text-accent underline decoration-1 underline-offset-[3px] hover:decoration-2 hover:text-accent-deep">
      {children}
    </Link>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">Design system</h1>
      <p className="mt-3 max-w-[62ch] text-body text-ink-muted">
        Every primitive in every state, rendered from the shared package against the design plan. Hover states are
        described where they cannot be forced; the first field of the quote form takes focus on load so the focus
        ring is visible. This page is not indexed.
      </p>
      <nav aria-label="On this page" className="mt-8">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small">
          {contents.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-accent underline decoration-1 underline-offset-[3px] hover:decoration-2">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12">
        <Section id="palette" title="Palette" intro="Six core colours, four derived states, the functional zone set and the two status colours. Values and contrast ratios are those in plan section 2.">
          <Specimen title="Core and derived">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {core.map((c) => (
                <Swatch key={c.hex + c.name} {...c} />
              ))}
            </div>
          </Specimen>
          <Specimen title="Zone set" note="Zone colours are used only for zones and always with the zone word. Yellow is a fill, never a text colour.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zoneSwatches.map((c) => (
                <Swatch key={c.hex + c.name} {...c} />
              ))}
            </div>
          </Specimen>
          <Specimen title="Status" note="Error is ink with a 2 px border; success is accent teal with a tick. Neither borrows the zone red or green.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {statusSwatches.map((c) => (
                <Swatch key={c.hex + c.name} {...c} />
              ))}
            </div>
          </Specimen>
        </Section>

        <Section id="type" title="Type scale" intro="IBM Plex Sans for everything, IBM Plex Mono for codes and ratios. Sizes interpolate between 360 px and 1280 px; numbers in columns use tabular figures.">
          <dl className="grid gap-6 border border-line bg-surface p-5 md:p-8">
            {typeScale.map((t) => (
              <div key={t.token} className="grid gap-1 border-b border-line pb-6 last:border-b-0 last:pb-0 md:grid-cols-[10rem_1fr] md:gap-6">
                <dt className="text-caption text-ink-muted">
                  <span className="font-mono text-mono text-ink">{t.token}</span>
                  <span className="block tabular-nums">{t.sizes}</span>
                </dt>
                <dd className={`${t.cls} ${t.measure} text-ink`}>{t.copy}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="spacing" title="Radius, border and shadow" intro="Square things are material, slightly rounded things are tools, clearly rounded things are transient. Nothing that sits on the page casts a shadow.">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Specimen title="Radius 0, material" note="Photographs, zone bands, tables, product cards.">
              <div className="size-20 border border-line bg-surface" />
            </Specimen>
            <Specimen title="Radius 2 px, chip" note="Inputs, chips, badges, pack-size radios, thumbnails.">
              <div className="size-20 rounded-chip border border-stainless bg-surface" />
            </Specimen>
            <Specimen title="Radius 4 px, button" note="Buttons only.">
              <div className="size-20 rounded-button bg-ink" />
            </Specimen>
            <Specimen title="Radius 12 px, sheet, with the one shadow" note="Sheets, drawers, dialogs, toasts and the sticky add-to-cart bar: the only things that float.">
              <div className="size-20 rounded-sheet bg-surface shadow-float" />
            </Specimen>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Specimen title="1 px line" note="Decorative containment: image frames, table rules, dividers.">
              <div className="h-12 border border-line bg-surface" />
            </Specimen>
            <Specimen title="1 px stainless" note="Interactive edges: inputs, secondary buttons, unselected chips.">
              <div className="h-12 rounded-chip border border-stainless bg-surface" />
            </Specimen>
            <Specimen title="2 px accent" note="Selected: pack-size radio, filter chip, active nav item.">
              <div className="h-12 rounded-chip border-2 border-accent bg-surface" />
            </Specimen>
            <Specimen title="2 px ink" note="Error field border.">
              <div className="h-12 rounded-chip border-2 border-ink bg-surface" />
            </Specimen>
          </div>
        </Section>

        <Section id="buttons" title="Buttons and links" intro="The label is the outcome, sentence case, plain verb first. One primary button per view. Primary is ink, not teal: teal is reserved for links and states.">
          <div className="grid gap-8 md:grid-cols-2">
            <Specimen title="Primary" note="Hover: fill changes from ink to accent-deep over 120 ms. Focus: 3 px white outline on the ink fill.">
              <Button>Add to cart</Button>
            </Specimen>
            <Specimen title="Secondary" note="Hover: border darkens to ink and the fill turns ground-deep.">
              <Button variant="secondary">Request a quote</Button>
            </Specimen>
            <Specimen title="Tertiary" note="A teal text link. Hover: underline thickens from 1 px to 2 px.">
              <Button variant="tertiary">Download safety data sheet</Button>
            </Specimen>
            <Specimen title="Small">
              <Button size="sm" variant="secondary">
                Remove QAC-based sanitiser 5 L
              </Button>
            </Specimen>
            <Specimen title="Busy" note="Loading keeps the width and says the state in words, not only a spinner.">
              <Button busy busyLabel="Sending M-Pesa request…">
                Pay KES 12,480.00 with M-Pesa
              </Button>
            </Specimen>
            <Specimen title="Disabled" note="Avoided where possible: the button stays enabled and pressing it explains what is missing. Shown here for completeness.">
              <div className="flex flex-wrap gap-3">
                <Button disabled>Place order</Button>
                <Button variant="secondary" disabled>
                  Request a quote
                </Button>
              </div>
            </Specimen>
            <Specimen title="Full width" note="Used on mobile when it is the page's main action.">
              <Button fullWidth>Pay KES 12,480.00 with M-Pesa</Button>
            </Specimen>
            <Specimen title="Link styled as a button">
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/products">Browse products</ButtonLink>
                <ButtonLink href="/quote" variant="secondary">
                  Request a quote
                </ButtonLink>
              </div>
            </Specimen>
          </div>
          <Specimen title="Links in body copy" note="Underlined, accent, no arrows or chevrons. Hover: underline 1 px to 2 px.">
            <p className="max-w-[62ch] text-body">
              Not sure which zone? Read the <BodyLink href="/products">colour-coded cleaning guide</BodyLink>, or{" "}
              <BodyLink href="/contact">talk to us about your site</BodyLink>.
            </p>
          </Specimen>
        </Section>

        <Section id="zones" title="Zone badges and bands" intro="An 8 px swatch and the zone word on a surface pill. The band under a product photo is 6 px and splits into equal segments for multi-zone products.">
          <Specimen title="Badges">
            <ul className="flex flex-wrap gap-2">
              {ZONES.map((z) => (
                <li key={z.key}>
                  <ZoneBadge zone={z.key} />
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen title="Zone names in running text" note="Yellow's name is written in its paired ink, never in yellow.">
            <p className="flex flex-wrap gap-x-5 gap-y-2 text-body font-medium">
              {ZONES.map((z) => (
                <span key={z.key} className={z.text}>
                  {z.label}
                </span>
              ))}
            </p>
          </Specimen>
          <Specimen title="Single-zone bands">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ZONES.map((z) => (
                <div key={z.key} className="border border-line bg-surface">
                  <div className="h-16" />
                  <ZoneBand zones={[z.key]} />
                </div>
              ))}
            </div>
          </Specimen>
          <Specimen title="Multi-zone bands" note="A general-purpose cleaner-disinfectant is blue and red; a QAC sanitiser is green and blue; the disinfection category spans all four.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border border-line bg-surface">
                <div className="h-16" />
                <ZoneBand zones={["BLUE", "RED"]} />
              </div>
              <div className="border border-line bg-surface">
                <div className="h-16" />
                <ZoneBand zones={["GREEN", "BLUE"]} />
              </div>
              <div className="border border-line bg-surface">
                <div className="h-16" />
                <ZoneBand zones={["RED", "BLUE", "GREEN", "YELLOW"]} />
              </div>
            </div>
          </Specimen>
        </Section>

        <Section id="hazards" title="Hazard badges" intro="Warning colours, the hazard word in sentence case and a 16 px GHS-style pictogram. Irritant and Harmful share the exclamation mark, as they do on a real label. A product with no hazard class renders no badge.">
          <Specimen title="Every class">
            <ul className="flex flex-wrap gap-2">
              {HAZARDS.map((h) => (
                <li key={h}>
                  <HazardBadge hazard={h} />
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen title="No hazard class" note={`hazard="NONE" renders nothing: the card simply has no badge.`}>
            <p className="text-small text-ink-muted">
              {hazardLabel.NONE}: <HazardBadge hazard="NONE" />
              nothing is rendered after the colon.
            </p>
          </Specimen>
        </Section>

        <Section id="packs" title="Pack chips and pack selector" intro="Chips on cards describe; the radio group on the product page selects. Native radios keep arrow-key navigation and read the price with the option.">
          <Specimen title="Pack chips">
            <ul className="flex flex-wrap gap-1.5" aria-label="Pack sizes">
              {["500 ml", "5 L", "20 L", "25 L", "15 kg"].map((p) => (
                <li key={p}>
                  <PackChip>{p}</PackChip>
                </li>
              ))}
            </ul>
          </Specimen>
          <div className="grid gap-8 md:grid-cols-2">
            <Specimen title="Pack selector, two packs" note="Selected: 2 px accent border, price crossfades over 120 ms.">
              <PackSelectorDemo variant="qac" />
            </Specimen>
            <Specimen title="Pack selector with a sold-out pack" note="The unavailable option is disabled and says what to do instead.">
              <PackSelectorDemo variant="chlorine" />
            </Specimen>
          </div>
        </Section>

        <Section id="quantity" title="Quantity stepper" intro="44 px targets, an editable number in the middle, and a polite announcement of the new quantity.">
          <div className="grid gap-8 md:grid-cols-3">
            <Specimen title="Default">
              <QuantityDemo initial={4} />
            </Specimen>
            <Specimen title="At the minimum" note="Decrease is disabled at 1; the value in the middle explains why.">
              <QuantityDemo initial={1} />
            </Specimen>
            <Specimen title="Disabled" note="While a payment is in flight.">
              <QuantityDemo initial={2} disabled />
            </Specimen>
          </div>
        </Section>

        <Section id="cards" title="Product cards" intro="Photo on surface in a 1 px line frame, radius 0; the zone band sits inside the frame; text below on bare ground. Hover darkens the frame to stainless. No shadow, no lift, at any state. Until the photographs exist the tile is a flat ground-deep square with the product name.">
          <Specimen title="Listing grid: two, three and one pack, and a quote-only product" note="Price is the lowest pack price, prefixed From only when there is more than one pack.">
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              <li>
                <ProductCard
                  name="Oven / grill / hood cleaner"
                  href="/products#specialty"
                  zones={["GREEN"]}
                  packs={["5 L", "20 L"]}
                  priceLabel="KES 1,650.00"
                  hazard="CORROSIVE"
                  action={<Button fullWidth>Add to cart</Button>}
                />
              </li>
              <li>
                <ProductCard
                  name="Chlorine-based disinfectant and bleaching solution"
                  href="/products#disinfection"
                  zones={["RED", "BLUE"]}
                  packs={["5 L", "20 L", "25 L"]}
                  priceLabel="KES 890.00"
                  hazard="OXIDISER"
                  action={<Button fullWidth>Add to cart</Button>}
                />
              </li>
              <li>
                <ProductCard
                  name="Destainer for crockery and cutlery"
                  href="/products#specialty"
                  zones={["GREEN"]}
                  packs={["15 kg"]}
                  priceLabel="KES 3,900.00"
                  hazard="IRRITANT"
                  action={<Button fullWidth>Add to cart</Button>}
                />
              </li>
              <li>
                <ProductCard
                  name="Enzyme-based biological drain cleaner and septic tank treatment"
                  href="/products#specialty"
                  zones={["RED"]}
                  packs={["5 L", "20 L"]}
                  action={
                    <ButtonLink href="/quote" variant="secondary" fullWidth>
                      Request quote
                    </ButtonLink>
                  }
                />
              </li>
            </ul>
          </Specimen>
          <Specimen title="Multi-zone, with a photo slot" note="The image slot takes any element; here a labelled surface stands in for the photograph so the frame and band can be judged.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              <ProductCard
                name="QAC-based sanitiser for surface and food-contact areas"
                href="/products#disinfection"
                zones={["GREEN", "BLUE"]}
                packs={["5 L", "20 L"]}
                priceLabel="KES 1,250.00"
                hazard="IRRITANT"
                image={
                  <div role="img" aria-label="Front label of QAC-based sanitiser, 5 L" className="grid h-full w-full place-items-center bg-surface">
                    <span aria-hidden className="font-mono text-mono text-ink-muted">
                      SF-0142
                    </span>
                  </div>
                }
                action={<Button fullWidth>Add to cart</Button>}
              />
              <ProductCard
                name="Alcohol-based hand sanitiser (liquid / gel)"
                href="/products#disinfection"
                packs={["500 ml", "5 L"]}
                priceLabel="KES 420.00"
                action={<Button fullWidth>Add to cart</Button>}
              />
            </div>
          </Specimen>
        </Section>

        <Section id="tables" title="Tables" intro="Real tables with scoped headers. Header row on ground-deep, 1 px line rules, tabular numerals right-aligned, mono for ratios. On mobile the table scrolls inside its own container and never breaks the page width.">
          <Specimen title="Dilution table" note="Notes sit under the use so the chart stays three columns wide on a phone.">
            <DilutionTable rows={qacDilution} caption="QAC-based sanitiser: dilution ratios and contact times" captionVisible />
          </Specimen>
          <Specimen title="Order summary">
            <Table caption="Your order" captionVisible>
              <THead>
                <Tr className="border-t-0">
                  <Th>Item</Th>
                  <Th>Pack</Th>
                  <Th numeric>Qty</Th>
                  <Th numeric>Price</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td>QAC-based sanitiser for surface and food-contact areas</Td>
                  <Td mono>5 L</Td>
                  <Td numeric>4</Td>
                  <Td numeric>KES 5,000.00</Td>
                </Tr>
                <Tr>
                  <Td>Chlorine-based disinfectant and bleaching solution</Td>
                  <Td mono>20 L</Td>
                  <Td numeric>2</Td>
                  <Td numeric>KES 7,480.00</Td>
                </Tr>
                <Tr>
                  <Th scope="row" colSpan={3} className="font-normal">
                    Subtotal
                  </Th>
                  <Td numeric>KES 10,758.62</Td>
                </Tr>
                <Tr>
                  <Th scope="row" colSpan={3} className="font-normal">
                    VAT 16%
                  </Th>
                  <Td numeric>KES 1,721.38</Td>
                </Tr>
                <Tr>
                  <Th scope="row" colSpan={3} className="font-normal">
                    Delivery, Nairobi
                  </Th>
                  <Td numeric>KES 0.00</Td>
                </Tr>
                <Tr className="bg-ground-deep">
                  <Th scope="row" colSpan={3}>
                    Total
                  </Th>
                  <Td numeric className="text-price-lg">
                    KES 12,480.00
                  </Td>
                </Tr>
              </TBody>
            </Table>
          </Specimen>
        </Section>

        <Section id="progress" title="Progress steps" intro="The checkout stepper. The teal rule fills up to and including the current step, completed steps carry a tick, and the current step is announced as such.">
          <div className="grid gap-8 md:grid-cols-2">
            {checkoutSteps.map((step, i) => (
              <Specimen key={step} title={`Step ${i + 1} of 4: ${step}`}>
                <ProgressSteps steps={checkoutSteps} current={i} label={`Checkout progress, at ${step.toLowerCase()}`} />
              </Specimen>
            ))}
          </div>
        </Section>

        <Section id="alerts" title="Alerts and toast" intro="Errors say what went wrong and how to fix it, next to the field and in a summary that receives focus. They are never toast-only.">
          <div className="grid gap-6">
            <Specimen title="Error">
              <Alert variant="error" title="The M-Pesa request timed out.">
                Nothing was charged. Send it again, or choose another way to pay.
              </Alert>
            </Specimen>
            <Specimen title="Success">
              <Alert variant="success" title="Added to cart">
                QAC-based sanitiser, 5 L. <BodyLink href="/products">View cart</BodyLink>
              </Alert>
            </Specimen>
            <Specimen title="Warning" note="Warnings are hazard notices, so they share the yellow-zone ink.">
              <Alert variant="warning" title="Irritant.">
                Wear gloves and eye protection. Do not mix with chlorine products.
              </Alert>
            </Specimen>
            <Specimen title="Toast" note="Bottom-centre on mobile, bottom-right on desktop, radius 12, the one float shadow. Dismisses itself after six seconds.">
              <ToastDemo />
            </Specimen>
          </div>
        </Section>

        <Section id="sheet" title="Sheet" intro="Slides from the edge over a dimmed backdrop in 240 ms, closes in 160 ms. Traps focus, restores it on close, closes on Escape.">
          <Specimen title="Bottom sheet">
            <SheetDemo />
          </Specimen>
        </Section>

        <Section id="empty" title="Empty states" intro="Plain copy on a hairline panel and an action. No illustration.">
          <div className="grid gap-6 lg:grid-cols-3">
            <EmptyState
              heading="Nothing matches all of those filters."
              body="Remove one, or ask us. We can usually source it."
              actions={[
                <Button key="clear" variant="secondary">
                  Clear filters
                </Button>,
                <ButtonLink key="quote" href="/quote" variant="secondary">
                  Request a quote
                </ButtonLink>,
              ]}
            />
            <EmptyState
              heading="No products found for degreser."
              body={
                <>
                  Check the spelling, or browse <BodyLink href="/products#foodservice">Foodservice and kitchen hygiene</BodyLink>.
                </>
              }
              actions={[
                <Button key="clear" variant="secondary">
                  Clear search
                </Button>,
              ]}
            />
            <EmptyState heading="Your cart is empty." body="Start with the zone you clean most.">
              <ul className="grid gap-2">
                {ZONES.map((z) => (
                  <li key={z.key}>
                    <Link href={`/products?zone=${z.slug}`} className="flex min-h-11 items-center gap-3 border border-line bg-surface pr-3 hover:border-stainless">
                      <span aria-hidden className={`h-full min-h-11 w-1 ${z.swatch}`} />
                      <span className="text-small font-medium text-ink">{z.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </EmptyState>
          </div>
        </Section>

        <Section id="forms" title="Forms" intro="Label above the field, always visible. Helper text before the mistake. 48 px tall, surface fill, 1 px stainless border, 2 px radius. Focus is a 2 px accent border under the global 3 px outline; error is a 2 px ink border with the message wired through aria-describedby.">
          <div className="grid gap-8 md:grid-cols-2">
            <Specimen title="Default, with focus on load" note="This field takes focus when the page opens so the ring can be checked.">
              <Input label="Your name" autoComplete="name" />
            </Specimen>
            <Specimen title="With helper text">
              <Input label="Organisation" helper="The name on the invoice, for example Westlands Kitchen Stores." autoComplete="organization" />
            </Specimen>
            <Specimen title="Phone, static +254 prefix" note="inputmode tel; the country is Kenya, so the prefix is shown, not typed.">
              <PhoneInput label="Phone number" helper="Safaricom number, 07xx or 01xx." />
            </Specimen>
            <Specimen title="Phone, error" note="The border changes instantly; only the message fades in.">
              <PhoneInput
                label="Phone number for the M-Pesa request"
                helper="Safaricom number, 07xx or 01xx."
                defaultValue="0796 80"
                error="That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx."
              />
            </Specimen>
            <Specimen title="Required, empty, error">
              <Input label="Email" type="email" autoComplete="email" error="Enter the email address the quote should go to." />
            </Specimen>
            <Specimen title="Disabled">
              <Input label="Country" defaultValue="Kenya" disabled />
            </Specimen>
            <Specimen title="Select">
              <Select label="What do you need it for?" helper="Choose the closest category; we will ask for detail if we need it." defaultValue="disinfection">
                {site.productAreas.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Specimen>
            <Specimen title="Select, error">
              <Select label="How would you like to pay?" defaultValue="" error="Choose how you would like to pay so we can prepare the right paperwork.">
                <option value="">Choose one</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card (Visa, Mastercard)</option>
                <option value="invoice">Invoice, organisation account (30-day terms)</option>
                <option value="cash">Cash on delivery</option>
              </Select>
            </Specimen>
            <Specimen title="Textarea" className="md:col-span-2">
              <Textarea
                label="What do you need?"
                helper="Products, pack sizes and rough monthly volumes help us price it the same day."
                optional
                defaultValue="QAC-based sanitiser for surface and food-contact areas, 20 L, about 8 a month. Oven / grill / hood cleaner, 5 L, 4 a month."
              />
            </Specimen>
            <Specimen title="Textarea, error" className="md:col-span-2">
              <Textarea label="Delivery instructions" error="Tell us where to leave the delivery if the kitchen stores are closed." />
            </Specimen>
          </div>
          <Specimen title="Form-level failure" note="The summary receives focus after a failed submit and repeats each field error as a link to the field.">
            <form className="flex max-w-lg flex-col gap-6" aria-labelledby="quote-form-heading" noValidate>
              <h4 id="quote-form-heading" className="text-h3">
                Request a quote
              </h4>
              <Alert variant="error" title="Check 2 fields before sending the request.">
                <ul className="list-disc pl-5">
                  <li>
                    <a href="#quote-phone" className="underline underline-offset-[3px]">
                      Phone number: that does not look like a Kenyan mobile number.
                    </a>
                  </li>
                  <li>
                    <a href="#quote-email" className="underline underline-offset-[3px]">
                      Email: enter the email address the quote should go to.
                    </a>
                  </li>
                </ul>
              </Alert>
              <Input id="quote-name" label="Your name" autoComplete="name" defaultValue="Amina Wanjiru" />
              <PhoneInput
                id="quote-phone"
                label="Phone number"
                helper="Safaricom number, 07xx or 01xx."
                defaultValue="12345"
                error="That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx."
              />
              <Input id="quote-email" label="Email" type="email" autoComplete="email" error="Enter the email address the quote should go to." />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button">Send the request</Button>
                <ButtonLink href={`tel:${site.contact.phone.e164}`} variant="secondary">
                  Call {site.contact.phone.display}
                </ButtonLink>
              </div>
            </form>
          </Specimen>
        </Section>
      </div>
    </div>
  );
}
