import { fmtKES, fmtDateTime } from "./format";

export type ReceiptData = {
  saleNumber: string;
  createdAt: string;
  cashier?: string;
  customer?: string;
  isWholesale: boolean;
  paymentMethod: "cash" | "mpesa";
  mpesaReference?: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

/**
 * Renders a receipt for a 58mm/80mm thermal printer (32 chars wide)
 * and triggers the browser print dialog. Select the thermal printer
 * with no margins to print.
 */
export function printThermalReceipt(r: ReceiptData) {
  const W = 32;
  const line = (ch = "-") => ch.repeat(W);
  const center = (s: string) =>
    s.length >= W ? s : " ".repeat(Math.floor((W - s.length) / 2)) + s;
  const lr = (l: string, right: string) => {
    const space = Math.max(1, W - l.length - right.length);
    return l + " ".repeat(space) + right;
  };

  const rows: string[] = [];
  rows.push(center("BEI POA"));
  rows.push(center("Retail & Wholesale"));
  rows.push(line());
  rows.push(`Receipt: ${r.saleNumber}`);
  rows.push(fmtDateTime(r.createdAt));
  if (r.cashier) rows.push(`Cashier: ${r.cashier}`);
  rows.push(`Customer: ${r.customer ?? "Walk-in"}`);
  rows.push(`Type: ${r.isWholesale ? "Wholesale" : "Retail"}`);
  rows.push(line());
  for (const it of r.items) {
    rows.push(it.name.slice(0, W));
    rows.push(lr(`  ${it.qty} x ${fmtKES(it.price)}`, fmtKES(it.qty * it.price)));
  }
  rows.push(line());
  rows.push(lr("Subtotal", fmtKES(r.subtotal)));
  if (r.discount) rows.push(lr("Discount", `-${fmtKES(r.discount)}`));
  rows.push(lr("VAT", fmtKES(r.tax)));
  rows.push(lr("TOTAL", fmtKES(r.total)));
  rows.push(line());
  rows.push(lr("Paid", r.paymentMethod.toUpperCase()));
  if (r.paymentMethod === "mpesa" && r.mpesaReference) {
    rows.push(lr("M-Pesa Ref", r.mpesaReference));
  }
  rows.push("");
  rows.push(center("Asante sana!"));
  rows.push(center("Goods sold are not"));
  rows.push(center("returnable."));
  rows.push("");
  rows.push("");

  const body = rows.join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${r.saleNumber}</title>
<style>
  @page { margin: 0; size: 58mm auto; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.35;
    width: 58mm; padding: 4mm 3mm; white-space: pre; color: #000; }
  @media print { body { width: auto; } }
</style></head><body>${body.replace(/</g, "&lt;")}</body></html>`;

  const w = window.open("", "PRINT", "width=380,height=640");
  if (!w) {
    // Popup blocked — fallback: open in same tab via blob
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Wait a tick so the body renders before print
  setTimeout(() => {
    w.print();
    w.close();
  }, 200);
}
