import { DateTime } from "luxon";

export type DiscountType = "holiday" | "multiday" | null;

export interface PricingResult {
  originalHourlyRateCents: number;
  effectiveHourlyRateCents: number;
  originalTotalPriceCents: number;
  totalPriceCents: number;
  durationInHours: number;
  discountType: DiscountType;
}

export const HOLIDAYS: { month: number; day: number }[] = [
  { month: 1, day: 21 },
  { month: 2, day: 12 },
  { month: 3, day: 4 },
  { month: 5, day: 2 },
  { month: 6, day: 16 },
  { month: 7, day: 26 },
  { month: 8, day: 3 },
  { month: 9, day: 1 },
  { month: 11, day: 5 },
  { month: 12, day: 18 },
];

function qualifiesForHolidayDiscount(start: DateTime, end: DateTime): boolean {
  const startDay = start.startOf("day");
  const endDay = end.startOf("day");
  const yearsToCheck = new Set([start.year, end.year]);

  return HOLIDAYS.some(({ month, day }) =>
    [...yearsToCheck].some((year) => {
      const holiday = DateTime.fromObject({ year, month, day }, { zone: start.zone });
      return holiday > startDay && holiday < endDay;
    }),
  );
}

function qualifiesForMultidayDiscount(start: DateTime, end: DateTime): boolean {
  return end.diff(start, "days").days > 3;
}

export function calculatePricing(
  hourlyRateCents: number,
  start: DateTime,
  end: DateTime,
): PricingResult {
  const durationInHours = end.diff(start, "hours").hours;
  const originalTotal = hourlyRateCents * durationInHours;

  const holidayEligible = qualifiesForHolidayDiscount(start, end);
  const multidayEligible = qualifiesForMultidayDiscount(start, end);

  if (!holidayEligible && !multidayEligible) {
    return {
      originalHourlyRateCents: hourlyRateCents,
      effectiveHourlyRateCents: hourlyRateCents,
      originalTotalPriceCents: originalTotal,
      totalPriceCents: originalTotal,
      durationInHours,
      discountType: null,
    };
  }

  let bestTotal = originalTotal;
  let bestType: DiscountType = null;
  let bestEffectiveRate = hourlyRateCents;

  if (holidayEligible) {
    const holidayTotal = Math.round(originalTotal * 0.83);
    if (holidayTotal < bestTotal) {
      bestTotal = holidayTotal;
      bestType = "holiday";
      bestEffectiveRate = Math.round(hourlyRateCents * 0.83);
    }
  }

  if (multidayEligible) {
    const discountedRate = hourlyRateCents - 1000;
    const multidayTotal = discountedRate * durationInHours;
    if (multidayTotal < bestTotal) {
      bestTotal = multidayTotal;
      bestType = "multiday";
      bestEffectiveRate = discountedRate;
    }
  }

  return {
    originalHourlyRateCents: hourlyRateCents,
    effectiveHourlyRateCents: bestEffectiveRate,
    originalTotalPriceCents: originalTotal,
    totalPriceCents: bestTotal,
    durationInHours,
    discountType: bestType,
  };
}
