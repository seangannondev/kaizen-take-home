import { DateTime } from "luxon";
import {
  getAvailableVehicles,
  getReservationById,
  getVehicleById,
  getVehicles,
} from "./data_helpers";
import { calculatePricing, PricingResult } from "./discounts";
import { Vehicle } from "./data";

export interface VehicleSearchResult extends Vehicle {
  pricing: PricingResult;
}

export type { PricingResult };

const parseAndValidateTimeRange = (startTime: string, endTime: string) => {
  const start = DateTime.fromISO(startTime);
  const end = DateTime.fromISO(endTime);

  if (
    start.toString() === "Invalid Date" ||
    end.toString() === "Invalid Date"
  ) {
    throw new Error(
      "BAD REQUEST: Invalid date format. Please use ISO 8601 format.",
    );
  }

  if (end <= start) {
    throw new Error("BAD REQUEST: end_time must be after start_time");
  }
  return { start, end };
};


const validateReservationAndGetVehicle = (input: {
  vehicleId: string;
  startTime: string;
  endTime: string;
}) => {
  const { vehicleId, startTime, endTime } = input;
  const { start, end } = parseAndValidateTimeRange(startTime, endTime);

  const vehicle = getVehicleById(vehicleId);

  if (!vehicle) {
    throw new Error("NOT_FOUND: Vehicle not found");
  }

  return { vehicle, start, end };
};

function searchVehicles(input: {
  startTime: string;
  endTime: string;
  passengerCount: number;
  classifications: string[];
  makes: string[];
  priceMin: number;
  priceMax: number;
}) {
  const {
    startTime,
    endTime,
    passengerCount,
    classifications,
    makes,
    priceMin,
    priceMax,
  } = input;

  try {
    const { start, end } = parseAndValidateTimeRange(startTime, endTime);

    const availableVehicles = getAvailableVehicles({
      startTime: start,
      endTime: end,
      passengerCount,
      classifications,
      makes,
    });

    const vehicles: VehicleSearchResult[] = availableVehicles
      .map((vehicle) => ({
        ...vehicle,
        pricing: calculatePricing(vehicle.hourly_rate_cents, start, end),
      }))
      .filter(({ pricing }) => {
        const effectiveDollars = pricing.effectiveHourlyRateCents / 100;
        return effectiveDollars >= priceMin && effectiveDollars <= priceMax;
      });

    return { vehicles };
  } catch (error) {
    console.error(error);
    return { vehicles: [] };
  }
}

export interface FilterOptions {
  makes: string[];
  classifications: string[];
  passengerCounts: number[];
  maxHourlyRateDollars: number;
}

function getFilterOptions(): FilterOptions {
  const allVehicles = getVehicles();

  const uniqueMakes = [...new Set(allVehicles.map((v) => v.make))].sort();
  const uniqueClassifications = [
    ...new Set(allVehicles.map((v) => v.classification)),
  ].sort();
  const uniquePassengerCounts = [
    ...new Set(allVehicles.map((v) => v.max_passengers)),
  ].sort((a, b) => a - b);

  const maxRateCents = Math.max(...allVehicles.map((v) => v.hourly_rate_cents));
  const maxHourlyRateDollars = Math.ceil(maxRateCents / 100 / 10) * 10;

  return {
    makes: uniqueMakes,
    classifications: uniqueClassifications,
    passengerCounts: uniquePassengerCounts,
    maxHourlyRateDollars,
  };
}

function getVehicle(id: string) {
  const vehicle = getVehicleById(id);

  if (!vehicle) {
    throw new Error("NOT_FOUND: Vehicle not found");
  }

  return vehicle;
}

function getReservation(id: string) {
  const reservation = getReservationById(id);
  if (!reservation) {
    throw new Error("NOT_FOUND: Reservation not found");
  }
  return reservation;
}

function getQuote(input: {
  vehicleId: string;
  startTime: string;
  endTime: string;
}): PricingResult {
  const { vehicle, start, end } = validateReservationAndGetVehicle(input);
  return calculatePricing(vehicle.hourly_rate_cents, start, end);
}

export const API = {
  searchVehicles,
  getFilterOptions,
  getVehicle,
  getReservation,
  getQuote,
};
