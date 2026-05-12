# Decisions

---

## Part 2: Discounts

Two discount types are supported: a **17% holiday deal** (applies when the reservation spans a holiday without starting or ending on it) and a **multi-day deal** ($10/hr off for reservations longer than 3 days). If both apply, whichever produces the lowest total wins.

Discount logic lives in `app/server/discounts.ts` alongside the `HOLIDAYS` constant. `calculatePricing()` is the single entry point — it returns both original and effective pricing so the UI can show before/after clearly.

Price filtering was moved out of `data_helpers.ts` and into `api.ts` so it can compare against the `effectiveHourlyRateCents` rather than the raw rate. This ensures vehicles that fall within range after a discount aren't incorrectly excluded.

Both the search list (`VehicleListItem`) and the review page (`ReviewPage`) show the original rate struck through alongside the discounted rate and a labelled discount line item.

---

## Part 1: Price Filter

The price filter bug originated in `AdditionalFilters` where the slider maximum was hardcoded to `$100`, with anything above that bucketed under `$100+`. This was less a bug than a design choice that hadn't aged well as prices grew beyond that threshold.

The fix replaces the hardcoded cap with a dynamic maximum derived from the active vehicle data — rounded up to the nearest $10. This keeps the slider range honest and scales automatically if prices change. Unit tests have been added to cover the ceiling calculation and price boundary behaviour.

---
