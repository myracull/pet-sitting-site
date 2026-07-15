const PRICING = {
  visit: {
    dog: 20,
    cat: 15
  },
  walking: 10,
  houseSitting: {
    baseNightly: 30,
    visitsPerDayWithPets: 2
  },
  discount: {
    thresholdDays: 10,
    rate: 0.10
  },
  paymentPlanThreshold: 400
};

function calculateDaySpan(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start) || isNaN(end)) {
    throw new Error("calculateDaySpan: invalid date(s) provided");
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((end - start) / msPerDay) + 1;
  return Math.max(diff, 0);
}

function calculateNightSpan(startDate, endDate) {
  const days = calculateDaySpan(startDate, endDate);
  return Math.max(days - 1, 0);
}

function evaluateHousehold(pets) {
  const hasOtherType = pets.some((pet) => pet.type === "other");
  if (hasOtherType) {
    return { requiresInquiry: true };
  }

  const standardPets = pets.filter((pet) => pet.type === "dog" || pet.type === "cat");
  if (standardPets.length === 0) {
    return { requiresInquiry: true };
  }

  let billedPet = standardPets[0];
  standardPets.forEach((pet) => {
    if (PRICING.visit[pet.type] > PRICING.visit[billedPet.type]) {
      billedPet = pet;
    }
  });

  return {
    requiresInquiry: false,
    billedPetName: billedPet.name || "Unnamed pet",
    billedPetType: billedPet.type,
    householdBasePrice: PRICING.visit[billedPet.type]
  };
}

function calculateWalkingCost(pets, days) {
  const breakdown = pets.map((pet, index) => {
    const walksPerDay = Number(pet.walksPerDay) || 0;
    const totalWalks = walksPerDay * days;
    const cost = round2(totalWalks * PRICING.walking);
    return {
      petIndex: index,
      name: pet.name || `Pet #${index + 1}`,
      walksPerDay,
      totalWalks,
      cost
    };
  });

  const total = round2(breakdown.reduce((sum, pet) => sum + pet.cost, 0));
  return { total, breakdown };
}

function calculateEstimate(booking) {
  const { pets, startDate, endDate, houseSitting = false, visitsPerDay } = booking || {};

  const petList = Array.isArray(pets) ? pets : [];

  if (petList.length === 0 && !houseSitting) {
    return {
      valid: false,
      error: "Add at least one pet, or select house sitting for home-only care.",
      total: null
    };
  }
  if (!startDate || !endDate) {
    return { valid: false, error: "Start and end dates are required.", total: null };
  }

  let days, nights;
  try {
    days = calculateDaySpan(startDate, endDate);
    nights = calculateNightSpan(startDate, endDate);
  } catch (err) {
    return { valid: false, error: err.message, total: null };
  }
  if (days <= 0) {
    return { valid: false, error: "End date must be on or after start date.", total: null };
  }

  let household = null;
  let visits = { visitsPerDay: 0, totalVisits: 0, perVisitCharge: 0, visitsSubtotal: 0 };
  let walking = { total: 0, breakdown: [] };

  if (petList.length > 0) {
    household = evaluateHousehold(petList);
    if (household.requiresInquiry) {
      return {
        valid: true,
        requiresInquiry: true,
        message: "One or more pets need a custom quote. Submit a request and we'll follow up with pricing.",
        days,
        nights,
        total: null
      };
    }

    const effectiveVisitsPerDay = houseSitting
      ? Number(visitsPerDay) || PRICING.houseSitting.visitsPerDayWithPets
      : Number(visitsPerDay) || 1;

    const totalVisits = effectiveVisitsPerDay * days;
    const visitsSubtotal = round2(household.householdBasePrice * totalVisits);

    visits = { visitsPerDay: effectiveVisitsPerDay, totalVisits, perVisitCharge: household.householdBasePrice, visitsSubtotal };
    walking = calculateWalkingCost(petList, days);
  }

  const houseSittingSubtotal = houseSitting ? round2(PRICING.houseSitting.baseNightly * nights) : 0;

  const subtotalBeforeDiscount = round2(houseSittingSubtotal + visits.visitsSubtotal + walking.total);

  const discountEligible = days >= PRICING.discount.thresholdDays;
  const discountAmount = discountEligible ? round2(subtotalBeforeDiscount * PRICING.discount.rate) : 0;
  const total = round2(subtotalBeforeDiscount - discountAmount);

  return {
    valid: true,
    requiresInquiry: false,
    days,
    nights,
    household,
    visits,
    walking,
    houseSitting: houseSitting
      ? { nights, nightlyRate: PRICING.houseSitting.baseNightly, subtotal: houseSittingSubtotal }
      : null,
    discount: { eligible: discountEligible, rate: PRICING.discount.rate, amount: discountAmount },
    subtotalBeforeDiscount,
    paymentPlanAvailable: total >= PRICING.paymentPlanThreshold,
    total
  };
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

const Calculator = {
  PRICING,
  calculateDaySpan,
  calculateNightSpan,
  evaluateHousehold,
  calculateWalkingCost,
  calculateEstimate
};

if (typeof window !== "undefined") {
  window.Calculator = Calculator;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = Calculator;
}