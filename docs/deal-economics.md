# Deal economics — calculation spec

Reference for the deal-evaluation engine (Phase 3). Ported from the original Lovable app's `evaluate()` (Deals page). **The structure below is trusted; the rate/assumption values marked ❓ must be confirmed by Andre / finance before they're relied on for real decisions.**

For CC: implement the formula as a typed pure function in `lib/deal-economics.ts`, and put every rate/assumption in a single exported `DEAL_ASSUMPTIONS` constant at the top of that file (not inline magic numbers), so a corrected value is a one-line change. Compute on deal save and when previewing a deal in the form.

## Inputs

| Input | Unit | Notes |
|---|---|---|
| `tonnes` | t | B100 output tonnes for the deal |
| `buy_price_per_tonne` | $/t | feedstock / product purchase price |
| `sell_price_per_tonne` | $/t | B100 sell price |
| `shipping_per_tonne` | $/t | |
| `trucking_per_tonne` | $/t | |
| `payment_type` | enum | funding cost applies only when "prefunded" |

## Formula (exact, from the old app)

```
buy_total      = buy_price_per_tonne   * tonnes
ship_total     = shipping_per_tonne    * tonnes
truck_total    = trucking_per_tonne    * tonnes

pre_vat        = buy_total + ship_total + truck_total
vat            = pre_vat * VAT_RATE                       # VAT_RATE = 0.05  ❓
pre_funding    = pre_vat + vat
funding_cost   = is_prefunded ? pre_funding * FUNDING_RATE : 0   # FUNDING_RATE = 0.10  ❓
total_cost     = pre_funding + funding_cost

glycerin_tonnes = tonnes * GLYCERIN_YIELD                # GLYCERIN_YIELD = 0.10/0.90 ≈ 0.1111  ❓
revenue        = sell_price_per_tonne * tonnes + glycerin_tonnes * GLYCERIN_PRICE   # GLYCERIN_PRICE = 450  ❓

profit          = revenue - total_cost
margin_pct      = revenue > 0 ? (profit / revenue) * 100 : 0
profit_per_tonne = tonnes > 0 ? profit / tonnes : 0

# Go / no-go recommendation
go = profit > 0 && margin_pct > MIN_MARGIN_PCT && profit_per_tonne > MIN_PROFIT_PER_TONNE
#                                MIN_MARGIN_PCT = 5  ❓        MIN_PROFIT_PER_TONNE = 30  ❓
```

These map to the existing `deals` columns: `total_cost`, `total_revenue`, `profit`, `margin`, `profit_per_tonne`, `pre_funding_required`. Store computed values on save; don't trust client-submitted profit/margin.

## Assumptions to confirm (❓ = needs Andre/finance sign-off)

1. **VAT_RATE = 5%** — correct Oman rate, but is VAT actually a *cost* here, or do you reclaim input VAT? If reclaimable, it should NOT reduce profit (set to 0 or handle separately). **← decision needed.**
2. **FUNDING_RATE = 10%** — is this the right rate, and is it a flat per-deal charge (as coded) or should it be annualized over the deal's duration (start_month → end_month)? **← decision needed.**
3. **GLYCERIN_YIELD ≈ 11.1%** of B100 tonnes — confirm the real byproduct yield.
4. **GLYCERIN_PRICE = $450/t** — ⚠️ inconsistent: elsewhere the old app/seed used **$220/t**. Confirm the real glycerin sale price. **← decision needed.**
5. **Go thresholds** — margin > 5% and profit/t > $30. Confirm these are the real hurdle rates, or adjust.
6. **payment_type values** — old app used the literal `"Prefunded"`. Confirm the canonical value(s) used in the `deals.payment_type` column so the funding test matches.

## How to handle the unconfirmed values

Implement with the values above as **defaults**, clearly flagged, so the app is fully functional now and the numbers become correct the moment Andre confirms/corrects each rate (one-line edits in `DEAL_ASSUMPTIONS`). Surface the active assumptions somewhere visible (e.g. a small "assumptions" note on the deal form) so users know the basis of the figures until they're signed off.
