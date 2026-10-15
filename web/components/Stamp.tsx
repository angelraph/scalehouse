import type { StatusName } from "@/lib/types";

const STYLE: Record<StatusName, { cls: string; text: string }> = {
  None: { cls: "text-void", text: "—" },
  Open: { cls: "text-waiting", text: "Awaiting witness" },
  Confirmed: { cls: "text-waiting", text: "Confirmed" },
  Paid: { cls: "text-paid", text: "Paid" },
  Frozen: { cls: "text-frozen", text: "Frozen" },
  Voided: { cls: "text-void", text: "Voided" },
};

export function Stamp({ status }: { status: StatusName }) {
  const s = STYLE[status];
  return <span className={`stamp ${s.cls}`}>{s.text}</span>;
}
