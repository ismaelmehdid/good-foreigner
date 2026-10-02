import type { RiskLevel } from "@/lib/types";

/** Plain-language risk words. Critical and high share one message: don't do it. */
export const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "Don't do this",
  high: "Don't do this",
  medium: "Be careful",
  low: "Probably fine",
  none: "All good",
  unknown: "Couldn't check",
};

export const RISK_DOT: Record<RiskLevel, string> = {
  critical: "bg-red-600 dark:bg-red-400",
  high: "bg-orange-500 dark:bg-orange-400",
  medium: "bg-amber-500 dark:bg-amber-400",
  low: "bg-blue-500 dark:bg-blue-400",
  none: "bg-green-600 dark:bg-green-400",
  unknown: "bg-stone-400 dark:bg-stone-500",
};

export const RISK_TEXT: Record<RiskLevel, string> = {
  critical: "text-red-700 dark:text-red-300",
  high: "text-orange-700 dark:text-orange-300",
  medium: "text-amber-700 dark:text-amber-300",
  low: "text-blue-700 dark:text-blue-300",
  none: "text-green-700 dark:text-green-300",
  unknown: "text-stone-600 dark:text-stone-400",
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

/** Colored dot + risk words, e.g. "● Don't do this". */
export default function RiskBadge({ risk }: { risk: RiskLevel }) {
  const r = RISK_LABEL[risk] ? risk : "unknown";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${RISK_TEXT[r]}`}>
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${RISK_DOT[r]}`} />
      {RISK_LABEL[r]}
    </span>
  );
}
