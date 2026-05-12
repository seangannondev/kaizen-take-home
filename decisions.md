# Decisions

---

## Part 1: Price Filter

The price filter bug originated in `AdditionalFilters` where the slider maximum was hardcoded to `$100`, with anything above that bucketed under `$100+`. This was less a bug than a design choice that hadn't aged well as prices grew beyond that threshold.

The fix replaces the hardcoded cap with a dynamic maximum derived from the active vehicle data — rounded up to the nearest $10. This keeps the slider range honest and scales automatically if prices change. Unit tests have been added to cover the ceiling calculation and price boundary behaviour.

The tradeoff was opting for a data-driven ceiling over a fixed arbitrary maximum that could be surpassed as prices grow.

---

## Part 2: Discounts

Two discount types are supported: a **17% holiday deal** (applies when the reservation spans a holiday without starting or ending on it) and a **multi-day deal** ($10/hr off for reservations longer than 3 days). If both apply, whichever produces the lowest total wins.

Discount logic lives in `app/server/discounts.ts` alongside the `HOLIDAYS` constant. `calculatePricing()` is the single entry point — it returns both original and effective pricing so the UI can show before/after clearly.

Price filtering was moved out of `data_helpers.ts` and into `api.ts` so it can compare against `effectiveHourlyRateCents` rather than the raw rate. This ensures vehicles that fall within range after a discount aren't incorrectly excluded.

Both the search list (`VehicleListItem`) and the review page (`ReviewPage`) show the original rate struck through alongside the discounted rate and a labelled discount line item.

The key design decision was where to apply the discount logic. Applying it only in the search filter would allow discounted vehicles to surface in results, but applying it only on the client would serve purely as a visual aid. Instead, discounts are applied on the server and both the original and effective rates are preserved — giving the price filter an accurate rate for range comparisons while the UI can show the customer the before and after.

---

## Part 3: Refactor

The codebase has a clean discount component separated from the core API and UI logic. Testing is robust for the discount logic and the filter from Part 1 to ensure they don't break with further changes. The testing suite for the discount logic accounts for the key edge cases:

1. Multiple discounts apply
2. Discounts bringing a vehicle into the filtered range that was previously excluded

The magic numbers `0.83` and `1000` in `discounts.ts` were replaced with named constants (`HOLIDAY_DISCOUNT_RATE`, `MULTIDAY_DISCOUNT_CENTS_PER_HOUR`) to make the business rules explicit and easier to update. `vehicle.pricing` in `VehicleListItem` was destructured at the top of the component to reduce repetition.

---

## Part 4: UX

The component I'd improve given the chance is the end date picker. Once a start date is moved to the future, the end date is almost guaranteed to be in the past, causing an invalid state and costing the user unnecessary scrolling. If after start date selection the end date jumped to the next day, the eventual end date choice would be n clicks faster to reach, n being the number of months in the future the booking is for.

---
