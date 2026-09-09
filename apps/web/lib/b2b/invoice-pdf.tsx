import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Invoice } from "@safuney/db";
import * as money from "@safuney/db/money";
import { site } from "@/config/site";
import type { InvoiceLine } from "./invoices";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#10202b" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#5b6b76" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  block: { marginTop: 18 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#10202b", paddingBottom: 4, marginTop: 16, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#c9d1d6", paddingVertical: 5 },
  cDesc: { width: "46%" },
  cQty: { width: "10%", textAlign: "right" },
  cPrice: { width: "16%", textAlign: "right" },
  cVat: { width: "12%", textAlign: "right" },
  cTotal: { width: "16%", textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: "44%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { borderTopWidth: 1, borderTopColor: "#10202b", marginTop: 4, paddingTop: 6, fontFamily: "Helvetica-Bold", fontSize: 12 },
  foot: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#5b6b76" },
});

function kes(minor: string | bigint): string {
  return money.formatKes(typeof minor === "bigint" ? minor : BigInt(minor));
}

function date(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(d) : "";
}

/** KRA-style tax invoice: seller and buyer PINs, itemised VAT, totals. Rendered from the invoice snapshot, never recomputed. */
export function InvoiceDocument({ invoice, orderNumber }: { invoice: Invoice; orderNumber: string }) {
  const lines = invoice.lines as unknown as InvoiceLine[];
  const title = invoice.type === "TAX" ? "Tax invoice" : invoice.type === "PROFORMA" ? "Pro-forma invoice" : "Credit note";
  return (
    <Document title={`${title} ${invoice.number}`} author={site.legalName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.h1}>{title}</Text>
            <Text>{invoice.number}</Text>
            <Text style={styles.muted}>Order {orderNumber}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{invoice.sellerName}</Text>
            <Text>{site.contact.address.lines.join(", ")}</Text>
            <Text>{site.contact.phone.display}</Text>
            <Text>{site.contact.email.address}</Text>
            <Text>KRA PIN {invoice.sellerKraPin ?? "to be confirmed"}</Text>
            {invoice.sellerVatNumber ? <Text>VAT {invoice.sellerVatNumber}</Text> : null}
          </View>
        </View>

        <View style={[styles.row, styles.block]}>
          <View>
            <Text style={styles.muted}>Billed to</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{invoice.buyerName}</Text>
            <Text>KRA PIN {invoice.buyerKraPin ?? "not supplied"}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text>Issued {date(invoice.issuedAt)}</Text>
            {invoice.dueDate ? <Text>Due {date(invoice.dueDate)}</Text> : null}
            {invoice.paidAt ? <Text>Paid {date(invoice.paidAt)}</Text> : null}
          </View>
        </View>

        <View style={styles.th}>
          <Text style={styles.cDesc}>Item</Text>
          <Text style={styles.cQty}>Qty</Text>
          <Text style={styles.cPrice}>Unit (ex VAT)</Text>
          <Text style={styles.cVat}>VAT</Text>
          <Text style={styles.cTotal}>Line (inc VAT)</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={styles.tr}>
            <Text style={styles.cDesc}>
              {l.description}
              {l.sku !== "DELIVERY" ? `  (${l.sku})` : ""}
            </Text>
            <Text style={styles.cQty}>{l.qty}</Text>
            <Text style={styles.cPrice}>{kes(l.unitPriceMinorUnits)}</Text>
            <Text style={styles.cVat}>{l.vatRateBps / 100}%</Text>
            <Text style={styles.cTotal}>{kes(BigInt(l.lineTotalMinorUnits) + BigInt(l.lineVatMinorUnits))}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal (ex VAT)</Text>
            <Text>{kes(invoice.subtotalMinorUnits)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>VAT</Text>
            <Text>{kes(invoice.vatMinorUnits)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grand]}>
            <Text>Total</Text>
            <Text>{kes(invoice.totalMinorUnits)}</Text>
          </View>
        </View>

        <View style={styles.foot}>
          <Text>
            {site.legalName}. Pay by M-Pesa Paybill or bank transfer quoting {invoice.number}. Goods remain the property of {site.legalName} until paid in full.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: Invoice, orderNumber: string): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} orderNumber={orderNumber} />);
}
