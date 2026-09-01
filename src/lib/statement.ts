import { fmtKES, fmtDateTime } from "./format";

export type StatementSale = {
  sale_number: string;
  created_at: string;
  payment_method: string;
  total: number | string;
  amount_paid: number | string;
};

export type StatementPayment = {
  created_at: string;
  method: string;
  reference: string | null;
  amount: number | string;
  notes?: string | null;
};

export type StatementData = {
  customer: { name: string; phone?: string | null; type?: string | null; balance: number | string };
  sales: StatementSale[];
  payments: StatementPayment[];
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/**
 * Opens a print-ready A4 debt statement for one customer.
 * Choose "Save as PDF" in the print dialog to keep a copy.
 */
export function printCustomerStatement(d: StatementData) {
  const num = (v: number | string) => Number(v ?? 0);
  const purchased = d.sales.reduce((s, x) => s + num(x.total), 0);
  const paidAtSale = d.sales.reduce((s, x) => s + num(x.amount_paid), 0);
  const collected = d.payments.reduce((s, x) => s + num(x.amount), 0);
  const balance = num(d.customer.balance);

  const salesRows = d.sales.length
    ? d.sales.map(s => `<tr>
        <td>${esc(fmtDateTime(s.created_at))}</td>
        <td>${esc(s.sale_number)}</td>
        <td class="up">${esc(s.payment_method)}</td>
        <td class="r">${esc(fmtKES(num(s.total)))}</td>
        <td class="r">${esc(fmtKES(num(s.amount_paid)))}</td>
        <td class="r">${esc(fmtKES(num(s.total) - num(s.amount_paid)))}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="empty">No purchases recorded.</td></tr>`;

  const payRows = d.payments.length
    ? d.payments.map(p => `<tr>
        <td>${esc(fmtDateTime(p.created_at))}</td>
        <td class="up">${esc(p.method)}</td>
        <td>${esc(p.reference ?? "—")}</td>
        <td>${esc(p.notes ?? "")}</td>
        <td class="r">${esc(fmtKES(num(p.amount)))}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="empty">No debt payments recorded.</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Statement - ${esc(d.customer.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: -0.5px; }
  .sub { font-size: 11px; margin-top: 2px; }
  .hdr { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
  .row { display: flex; justify-content: space-between; gap: 20px; }
  .box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 14px; }
  .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; font-size: 11px; }
  th { background: #eee; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .up { text-transform: uppercase; font-size: 10px; }
  .empty { text-align: center; color: #666; }
  tfoot td { font-weight: bold; background: #f4f4f4; }
  .totals td { font-weight: bold; }
  .foot { margin-top: 18px; font-size: 10px; border-top: 1px solid #000; padding-top: 6px; }
</style></head><body>
  <div class="hdr">
    <div class="row">
      <div>
        <h1>BEI POA STORES</h1>
        <div class="sub">Paybill 507900 &middot; Account 4062418</div>
      </div>
      <div style="text-align:right">
        <h1>DEBT STATEMENT</h1>
        <div class="sub">Generated ${esc(fmtDateTime(new Date()))}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="lbl">Customer</div>
    <div style="font-size:15px;font-weight:bold">${esc(d.customer.name)}</div>
    <div class="sub">${esc(d.customer.phone || "No phone")} &middot; ${esc((d.customer.type || "retail").toUpperCase())}</div>
  </div>

  <table class="totals">
    <tr>
      <td>Total Purchased</td><td class="r">${esc(fmtKES(purchased))}</td>
      <td>Paid At Sale</td><td class="r">${esc(fmtKES(paidAtSale))}</td>
    </tr>
    <tr>
      <td>Debt Payments Received</td><td class="r">${esc(fmtKES(collected))}</td>
      <td>Outstanding Balance</td><td class="r">${esc(fmtKES(balance))}</td>
    </tr>
  </table>

  <h2>Purchase History (${d.sales.length})</h2>
  <table>
    <thead><tr><th>Date</th><th>Sale #</th><th>Method</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Unpaid</th></tr></thead>
    <tbody>${salesRows}</tbody>
  </table>

  <h2>Debt Payment History (${d.payments.length})</h2>
  <table>
    <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th class="r">Amount</th></tr></thead>
    <tbody>${payRows}</tbody>
    <tfoot><tr><td colspan="4">Total Collected</td><td class="r">${esc(fmtKES(collected))}</td></tr></tfoot>
  </table>

  <div class="foot">
    Balance due: <strong>${esc(fmtKES(balance))}</strong>. Payments via Mpesa Paybill 507900, Account 4062418.
    Thank you for your business.
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
