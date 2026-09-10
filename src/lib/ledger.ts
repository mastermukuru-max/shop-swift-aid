export type LedgerSale = {
  sale_number: string;
  created_at: string;
  total: number | string;
  amount_paid: number | string;
  payment_method?: string;
};

export type LedgerPayment = {
  created_at: string;
  amount: number | string;
  method: string;
  reference?: string | null;
  notes?: string | null;
};

export type LedgerEntry = {
  date: string;
  kind: "debt" | "payment";
  detail: string;
  ref: string;
  debit: number; // debt added
  credit: number; // debt cleared
  balance: number; // running balance after entry
};

const num = (v: unknown) => Number(v ?? 0);

/**
 * Builds a chronological running-balance ledger (oldest first):
 * unpaid portions of sales add to the debt, payments deduct from it.
 */
export function buildLedger(sales: LedgerSale[], payments: LedgerPayment[]): LedgerEntry[] {
  const rows: Omit<LedgerEntry, "balance">[] = [];

  for (const s of sales) {
    const unpaid = num(s.total) - num(s.amount_paid);
    if (unpaid <= 0.0001) continue;
    rows.push({
      date: s.created_at,
      kind: "debt",
      detail: `Credit sale${s.payment_method ? ` (${s.payment_method})` : ""}`,
      ref: s.sale_number,
      debit: unpaid,
      credit: 0,
    });
  }

  for (const p of payments) {
    rows.push({
      date: p.created_at,
      kind: "payment",
      detail: `Payment received (${p.method})${p.notes ? ` — ${p.notes}` : ""}`,
      ref: p.reference || "—",
      debit: 0,
      credit: num(p.amount),
    });
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  return rows.map(r => {
    balance += r.debit - r.credit;
    return { ...r, balance };
  });
}

export function ledgerTotals(entries: LedgerEntry[]) {
  const charged = entries.reduce((s, e) => s + e.debit, 0);
  const paid = entries.reduce((s, e) => s + e.credit, 0);
  return { charged, paid, balance: charged - paid };
}
