import { describe, it, expect } from "vitest";
import { API } from "@/server/api";

// All classifications and makes present in the dataset
const ALL_CLASSIFICATIONS = ["Compact", "SUV", "Sports", "Subcompact", "Minivan", "Luxury"];
const ALL_MAKES = ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai", "Volkswagen", "Mercedes-Benz", "BMW", "Mazda", "Chrysler", "Jeep"];

// Dates far in the future so no existing reservations interfere
const START = "2030-06-01T10:00:00.000Z";
const END = "2030-06-01T12:00:00.000Z";

const search = (priceMin: number, priceMax: number) =>
  API.searchVehicles({
    startTime: START,
    endTime: END,
    passengerCount: 1,
    classifications: ALL_CLASSIFICATIONS,
    makes: ALL_MAKES,
    priceMin,
    priceMax,
  });

describe("getFilterOptions - maxHourlyRateDollars", () => {
  it("returns $220 as the ceiling given the current vehicle data (max is $220/hr)", () => {
    const options = API.getFilterOptions();
    expect(options.maxHourlyRateDollars).toBe(220);
  });
});

describe("maxHourlyRateDollars ceiling formula", () => {
  const ceil = (cents: number) => Math.ceil(cents / 100 / 10) * 10;

  it("rounds up to the nearest $10 for non-multiples", () => {
    expect(ceil(19900)).toBe(200); // $199 → $200
    expect(ceil(20100)).toBe(210); // $201 → $210
    expect(ceil(8550)).toBe(90);   // $85.50 → $90
  });

  it("does not round up when already a multiple of $10", () => {
    expect(ceil(22000)).toBe(220); // $220 → $220
    expect(ceil(10000)).toBe(100); // $100 → $100
  });
});

describe("searchVehicles - price filter", () => {
  it("returns all 12 vehicles when range covers the full spectrum ($10–$220)", () => {
    const { vehicles } = search(10, 220);
    expect(vehicles).toHaveLength(12);
  });

  it("includes the most expensive vehicle (Mercedes C-Class $220/hr) at the dynamic max", () => {
    const { vehicles } = search(10, 220);
    expect(vehicles.map((v) => v.id)).toContain("8");
  });

  it("excludes vehicles above the maximum price", () => {
    // Mercedes C-Class ($220/hr) and BMW X5 ($170/hr) should be excluded at max $160
    const { vehicles } = search(10, 160);
    const ids = vehicles.map((v) => v.id);
    expect(ids).not.toContain("8"); // Mercedes C-Class $220/hr
    expect(ids).not.toContain("9"); // BMW X5 $170/hr
    expect(ids).toContain("3");     // Mustang $160/hr — at the boundary, included
  });

  it("excludes vehicles below the minimum price", () => {
    // Spark ($32/hr) and Civic ($42/hr) should be excluded at min $45
    const { vehicles } = search(45, 220);
    const ids = vehicles.map((v) => v.id);
    expect(ids).not.toContain("4"); // Spark $32/hr
    expect(ids).not.toContain("2"); // Civic $42/hr
  });

  it("includes vehicles at exact price boundaries (range is inclusive)", () => {
    // Corolla = $45/hr (id 1), Rogue = $58/hr (id 5)
    const { vehicles } = search(45, 58);
    const ids = vehicles.map((v) => v.id);
    expect(ids).toContain("1"); // Corolla at exact min
    expect(ids).toContain("5"); // Rogue at exact max
  });

  it("returns no vehicles when min exceeds max vehicle price", () => {
    const { vehicles } = search(250, 300);
    expect(vehicles).toHaveLength(0);
  });
});
