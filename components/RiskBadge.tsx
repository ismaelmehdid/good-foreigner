import type { RiskLevel } from "@/lib/types";

const STYLES: Record<RiskLevel, { label: string; className: string; dot: string }> = {
  critical: {
    label: "Critical risk",
    className:
      "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900",
    dot: "bg-red-600 dark:bg-red-400",
  },
  high: {
    label: "High risk",
    className:
      "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:ring-orange-900",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  medium: {
    label: "Medium risk",
    className:
      "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  low: {
    label: "Low risk",
    className:
      "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  none: {
    label: "Looks fine",
    className:
      "bg-green-50 text-green-800 ring-green-200 dark:bg-green-950/60 dark:text-green-200 dark:ring-green-900",
    dot: "bg-green-600 dark:bg-green-400",
  },
  unknown: {
    label: "Couldn't check",
    className:
      "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
    dot: "bg-stone-400 dark:bg-stone-500",
  },
};

/** Left-edge accent for cards, keyed by risk. */
export const RISK_EDGE: Record<RiskLevel, string> = {
  critical: "border-l-red-600 dark:border-l-red-500",
  high: "border-l-orange-500 dark:border-l-orange-400",
  medium: "border-l-amber-500 dark:border-l-amber-400",
  low: "border-l-blue-500 dark:border-l-blue-400",
  none: "border-l-green-600 dark:border-l-green-500",
  unknown: "border-l-stone-400 dark:border-l-stone-600",
};

export default function RiskBadge({ risk }: { risk: RiskLevel }) {
  const s = STYLES[risk] ?? STYLES.unknown;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
