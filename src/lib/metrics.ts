/**
 * Shared metrics utilities — single source of truth for
 * currency formatting, period ranges, and realized-value calculations.
 *
 * ALL dashboards (Seller, Manager, Director) and the Pipeline summary
 * MUST use these functions so that the same seller always shows
 * the same numbers regardless of who is viewing.
 */

// ── Currency ────────────────────────────────────────
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

// ── Period range ────────────────────────────────────
export interface PeriodRange {
  start: Date;
  end: Date;
  /** First day of the period's start-month as "YYYY-MM-01" */
  monthStr: string;
}

export function getPeriodRange(period: string): PeriodRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let end: Date;

  switch (period) {
    case "last_month":
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
      break;
    case "current_quarter": {
      const q = Math.floor(m / 3) * 3;
      start = new Date(y, q, 1);
      end = new Date(y, q + 3, 0, 23, 59, 59);
      break;
    }
    case "current_year":
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
      break;
    default: // current_month
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
  }

  const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, monthStr };
}

// ── Realized-value helpers ──────────────────────────
/**
 * Canonical "closing date" for an opportunity.
 * Uses `first_closed_at`, falling back to `updated_at`.
 * This MUST match the logic used in Goals (Metas) page.
 */
export function getClosingDate(opp: { first_closed_at?: string | null; updated_at?: string | null }): string | null {
  return opp.first_closed_at || opp.updated_at || null;
}

/**
 * Returns true when the opportunity's closing date falls inside [start, end].
 * Used to determine "realized" revenue in a period.
 */
export function isClosedInPeriod(
  opp: { first_closed_at?: string | null; updated_at?: string | null },
  start: Date,
  end: Date,
): boolean {
  const d = getClosingDate(opp);
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// ── Aggregate helpers ───────────────────────────────
export function sumField(items: any[], field: string): number {
  return items.reduce((s, o) => s + (Number(o[field]) || 0), 0);
}
