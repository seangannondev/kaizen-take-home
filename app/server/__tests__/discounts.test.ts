import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { calculatePricing } from "@/server/discounts";
import { API } from "@/server/api";

// Helpers to build UTC DateTimes cleanly
const dt = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

// --- Shared date fixtures ---
// Jun 14–17 (72h exactly): contains Jun 16 holiday, NOT multiday-eligible
const JUN14 = dt("2030-06-14T10:00:00Z");
const JUN16 = dt("2030-06-16T10:00:00Z");
const JUN17 = dt("2030-06-17T10:00:00Z");
const JUN20 = dt("2030-06-20T10:00:00Z");
const JUN13 = dt("2030-06-13T10:00:00Z");

// Jul 10–13: no holidays anywhere near, used for clean multiday threshold tests
const JUL10 = dt("2030-07-10T10:00:00Z");
const JUL10_PLUS_72H1M = dt("2030-07-13T10:01:00Z");
const JUL10_PLUS_71H59M = dt("2030-07-13T09:59:00Z");
const JUL13 = dt("2030-07-13T10:00:00Z");

// All classifications and makes in the dataset (used by searchVehicles tests)
const ALL_CLASSIFICATIONS = ["Compact", "SUV", "Sports", "Subcompact", "Minivan", "Luxury"];
const ALL_MAKES = ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai", "Volkswagen", "Mercedes-Benz", "BMW", "Mazda", "Chrysler", "Jeep"];

// ─── 1. Best discount wins ──────────────────────────────────────────────────

describe("calculatePricing - best discount wins when both apply", () => {
  // Jun 14–20: 144h, contains Jun 16 holiday → both discounts eligible

  it("selects the holiday discount when it saves more (high rate, $220/hr)", () => {
    // Holiday: Math.round(22000 * 144 * 0.83) = 2,629,440
    // Multiday: (22000 - 1000) * 144 = 3,024,000
    const result = calculatePricing(22000, JUN14, JUN20);
    expect(result.discountType).toBe("holiday");
    expect(result.totalPriceCents).toBe(Math.round(22000 * 144 * 0.83));
    expect(result.effectiveHourlyRateCents).toBe(Math.round(22000 * 0.83));
  });

  it("selects the multiday discount when it saves more (low rate, $45/hr)", () => {
    // Holiday: Math.round(4500 * 144 * 0.83) = 537,840
    // Multiday: (4500 - 1000) * 144 = 504,000
    const result = calculatePricing(4500, JUN14, JUN20);
    expect(result.discountType).toBe("multiday");
    expect(result.totalPriceCents).toBe((4500 - 1000) * 144);
    expect(result.effectiveHourlyRateCents).toBe(3500);
  });
});

// ─── 2. Discounted vehicle not excluded from price filter ───────────────────

describe("searchVehicles - discounted vehicles included when effective rate is in range", () => {
  // Rogue (id=5): $58/hr. After $10 multiday discount → $48/hr.
  // Range: Jul 1–5 (96h, no holiday) → multiday applies.

  it("includes a vehicle whose discounted rate falls within the max price", () => {
    const { vehicles } = API.searchVehicles({
      startTime: "2030-07-01T10:00:00.000Z",
      endTime:   "2030-07-05T10:00:00.000Z",
      passengerCount: 1,
      classifications: ALL_CLASSIFICATIONS,
      makes: ALL_MAKES,
      priceMin: 10,
      priceMax: 50,
    });
    // Rogue: original $58/hr > $50 max, but effective $48/hr ≤ $50 → should appear
    expect(vehicles.map((v) => v.id)).toContain("5");
  });

  it("excludes the same vehicle when no discount applies and original rate is above max", () => {
    const { vehicles } = API.searchVehicles({
      startTime: "2030-07-01T10:00:00.000Z",
      endTime:   "2030-07-01T12:00:00.000Z", // 2h — no discount
      passengerCount: 1,
      classifications: ALL_CLASSIFICATIONS,
      makes: ALL_MAKES,
      priceMin: 10,
      priceMax: 50,
    });
    // Rogue: original $58/hr > $50, no discount → excluded
    expect(vehicles.map((v) => v.id)).not.toContain("5");
  });
});

// ─── 3. Holiday discount eligibility ───────────────────────────────────────

describe("calculatePricing - holiday discount applies only when a holiday is inside the range", () => {
  it("applies holiday discount when a holiday falls strictly inside the range", () => {
    // Jun 14 10:00 → Jun 17 10:00 (72h), holiday Jun 16 is between start-day and end-day
    const result = calculatePricing(10000, JUN14, JUN17);
    expect(result.discountType).toBe("holiday");
  });

  it("does NOT apply holiday discount when the reservation starts on the holiday", () => {
    // Starts on Jun 16, ends Jun 17 (24h — short enough that multiday can't also mask this)
    const result = calculatePricing(10000, JUN16, JUN17);
    expect(result.discountType).toBeNull();
  });

  it("does NOT apply holiday discount when the reservation ends on the holiday", () => {
    // Jun 13 10:00 → Jun 16 10:00; endDay = Jun 16 00:00, holiday = Jun 16 00:00 (not strictly less-than)
    const result = calculatePricing(10000, JUN13, JUN16);
    expect(result.discountType).toBeNull();
  });

  it("does NOT apply holiday discount when no holiday falls within the range", () => {
    // Jun 17 → Jun 20, no holiday
    const result = calculatePricing(10000, JUN17, JUN20);
    expect(result.discountType).toBeNull();
  });
});

// ─── 4. Multiday threshold is strictly more than 72 hours ──────────────────

describe("calculatePricing - multiday threshold (strictly more than 72 hours)", () => {
  it("does NOT apply multiday discount at exactly 72 hours", () => {
    const result = calculatePricing(10000, JUL10, JUL13); // exactly 72h
    expect(result.discountType).toBeNull();
  });

  it("applies multiday discount at 72h 01m (just over 3 days)", () => {
    const result = calculatePricing(10000, JUL10, JUL10_PLUS_72H1M);
    expect(result.discountType).toBe("multiday");
  });

  it("does NOT apply multiday discount at 71h 59m (just under 3 days)", () => {
    const result = calculatePricing(10000, JUL10, JUL10_PLUS_71H59M);
    expect(result.discountType).toBeNull();
  });
});

// ─── 5. Price calculation accuracy ─────────────────────────────────────────

describe("calculatePricing - price calculation accuracy", () => {
  it("rounds the holiday discount total to the nearest cent", () => {
    // Rate 7777 cents/hr, 72h (Jun 14–17, contains Jun 16 holiday)
    // original: 7777 * 72 = 559,944
    // holiday:  559,944 * 0.83 = 464,753.52 → rounded to 464,754
    const result = calculatePricing(7777, JUN14, JUN17);
    expect(result.discountType).toBe("holiday");
    expect(result.originalTotalPriceCents).toBe(7777 * 72);
    expect(result.totalPriceCents).toBe(464754);
  });

  it("computes multiday total with exact integer arithmetic (no rounding needed)", () => {
    // Rogue rate: 5800 cents/hr, 96h (Jul 1–5, no holiday)
    // discounted rate: 4800 cents/hr, total: 4800 * 96 = 460,800
    const result = calculatePricing(5800, dt("2030-07-01T10:00:00Z"), dt("2030-07-05T10:00:00Z"));
    expect(result.discountType).toBe("multiday");
    expect(result.originalTotalPriceCents).toBe(5800 * 96);
    expect(result.totalPriceCents).toBe(4800 * 96);
  });

  it("returns exact original total when no discount applies", () => {
    // 4500 cents/hr, 2h — no discount
    const result = calculatePricing(4500, dt("2030-07-01T10:00:00Z"), dt("2030-07-01T12:00:00Z"));
    expect(result.discountType).toBeNull();
    expect(result.totalPriceCents).toBe(9000);
    expect(result.originalTotalPriceCents).toBe(9000);
  });
});
