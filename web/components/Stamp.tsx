import type { StatusName } from "@/lib/types";

const STYLE: Record<StatusName, { cls: string; dot: string; text: string }> = {
  None: { cls: "bg-paper-2 text-muted", dot: "bg-faint", text: "—" },
  Open: { cls: "bg-bronze-wash text-bronze", dot: "bg-bronze", text: "Awaiting witness" },
  Confirmed: { cls: "bg-bronze-wash text-bronze", dot: "bg-bronze", text: "Confirmed" },
  Paid: { cls: "bg-lime-wash text-forest", dot: "bg-forest", text: "Paid" },
  Frozen: { cls: "bg-red-wash text-red", dot: "bg-red", text: "Frozen" },
  Voided: { cls: "bg-paper-2 text-muted", dot: "bg-faint", text: "Voided" },
};

export function Stamp({ status }: { status: StatusName }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}
