export const fmtKES = (n: number | string | null | undefined) => {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return "KES " + v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtNum = (n: number | string | null | undefined) => {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return v.toLocaleString("en-KE");
};

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "2-digit" });
};

export const fmtDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
};
