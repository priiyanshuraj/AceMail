// Stage color accents for the CRM pipeline. Values are semantic-token based so
// both light and dark themes stay consistent.
export const STAGE_COLORS: Record<string, { dot: string; border: string; bg: string }> = {
  slate: { dot: "bg-muted-foreground", border: "border-t-muted-foreground", bg: "bg-muted/60" },
  blue: { dot: "bg-blue-500", border: "border-t-blue-500", bg: "bg-blue-500/10" },
  amber: { dot: "bg-amber-500", border: "border-t-amber-500", bg: "bg-amber-500/10" },
  violet: { dot: "bg-violet-500", border: "border-t-violet-500", bg: "bg-violet-500/10" },
  orange: { dot: "bg-orange-500", border: "border-t-orange-500", bg: "bg-orange-500/10" },
  green: { dot: "bg-green-500", border: "border-t-green-500", bg: "bg-green-500/10" },
  red: { dot: "bg-red-500", border: "border-t-red-500", bg: "bg-red-500/10" },
};

export const STAGE_COLOR_NAMES = Object.keys(STAGE_COLORS);

export function stageColor(name: string) {
  return STAGE_COLORS[name] ?? STAGE_COLORS["slate"]!;
}

export function fmtMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}
