/**
 * Deal economics engine — implements docs/deal-economics.md.
 *
 * Pure, typed, and importable on both server and client (used to compute on
 * save AND to preview live in the deal form). Server actions must recompute
 * with this and never trust client-submitted profit/margin.
 *
 * EVERY rate/assumption lives in DEAL_ASSUMPTIONS below — no inline magic
 * numbers — so a corrected value is a one-line edit. Values marked with a
 * ❓ in the spec are unconfirmed defaults pending Andre/finance sign-off; see
 * ASSUMPTION_NOTES (surfaced on the deal form so users see the basis).
 */

export const DEAL_ASSUMPTIONS = {
  /** Oman VAT applied to feedstock + shipping + trucking. ❓ cost vs reclaimable. */
  VAT_RATE: 0.05,
  /** Flat funding charge on pre-funding amount when the deal is prefunded. ❓ rate + flat-vs-annualized. */
  FUNDING_RATE: 0.1,
  /** Glycerin byproduct tonnes per B100 tonne (0.10/0.90 ≈ 0.1111). ❓ real yield. */
  GLYCERIN_YIELD: 0.1 / 0.9,
  /** Glycerin sale price $/t. ❓ inconsistent (450 here vs 220 in old seed). */
  GLYCERIN_PRICE: 450,
  /** Go/no-go hurdle: minimum margin (percentage points). ❓ */
  MIN_MARGIN_PCT: 5,
  /** Go/no-go hurdle: minimum profit per tonne ($/t). ❓ */
  MIN_PROFIT_PER_TONNE: 30,
  /** deals.payment_type value (case-insensitive) that triggers funding cost. ❓ canonical value. */
  PREFUNDED_PAYMENT_TYPE: "prefunded",
} as const;

/** Metadata for the "assumptions" note on the deal form. confirmed:false = needs sign-off. */
export type AssumptionNote = { label: string; display: string; confirmed: boolean };
export const ASSUMPTION_NOTES: AssumptionNote[] = [
  { label: "VAT rate", display: "5% (treated as a cost)", confirmed: false },
  { label: "Funding rate", display: "10% flat, when prefunded", confirmed: false },
  { label: "Glycerin yield", display: "≈11.1% of B100 tonnes", confirmed: false },
  { label: "Glycerin price", display: "$450/t", confirmed: false },
  { label: "Go thresholds", display: "margin > 5% and profit > $30/t", confirmed: false },
  { label: "Prefunded trigger", display: `payment type = "${DEAL_ASSUMPTIONS.PREFUNDED_PAYMENT_TYPE}"`, confirmed: false },
];

/** True while any assumption is unconfirmed — drives the "provisional" flag in the UI. */
export const ASSUMPTIONS_UNCONFIRMED = ASSUMPTION_NOTES.some((a) => !a.confirmed);

export type DealEconomicsInput = {
  tonnes: number;
  buy_price_per_tonne: number;
  sell_price_per_tonne: number;
  shipping_per_tonne?: number | null;
  trucking_per_tonne?: number | null;
  payment_type?: string | null;
};

export type DealEconomics = {
  total_cost: number;
  total_revenue: number;
  profit: number;
  /** Margin in percentage points (e.g. 29.4), per the spec's margin_pct. */
  margin: number;
  profit_per_tonne: number;
  pre_funding_required: number;
  glycerin_tonnes: number;
  vat: number;
  funding_cost: number;
  /** Go/no-go recommendation against the hurdle rates. */
  go: boolean;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Whether a payment_type triggers the funding cost. */
export function isPrefunded(paymentType?: string | null): boolean {
  return (paymentType ?? "").trim().toLowerCase() === DEAL_ASSUMPTIONS.PREFUNDED_PAYMENT_TYPE;
}

/** Compute deal economics. Mirrors docs/deal-economics.md exactly. */
export function evaluateDeal(input: DealEconomicsInput): DealEconomics {
  const A = DEAL_ASSUMPTIONS;
  const tonnes = num(input.tonnes);
  const buy = num(input.buy_price_per_tonne);
  const sell = num(input.sell_price_per_tonne);
  const ship = num(input.shipping_per_tonne);
  const truck = num(input.trucking_per_tonne);

  const buyTotal = buy * tonnes;
  const shipTotal = ship * tonnes;
  const truckTotal = truck * tonnes;

  const preVat = buyTotal + shipTotal + truckTotal;
  const vat = preVat * A.VAT_RATE;
  const preFunding = preVat + vat;
  const fundingCost = isPrefunded(input.payment_type) ? preFunding * A.FUNDING_RATE : 0;
  const totalCost = preFunding + fundingCost;

  const glycerinTonnes = tonnes * A.GLYCERIN_YIELD;
  const totalRevenue = sell * tonnes + glycerinTonnes * A.GLYCERIN_PRICE;

  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const profitPerTonne = tonnes > 0 ? profit / tonnes : 0;

  const go =
    profit > 0 && margin > A.MIN_MARGIN_PCT && profitPerTonne > A.MIN_PROFIT_PER_TONNE;

  return {
    total_cost: totalCost,
    total_revenue: totalRevenue,
    profit,
    margin,
    profit_per_tonne: profitPerTonne,
    pre_funding_required: preFunding,
    glycerin_tonnes: glycerinTonnes,
    vat,
    funding_cost: fundingCost,
    go,
  };
}
