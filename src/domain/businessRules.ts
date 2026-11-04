// Business rules of the rental service, each defined once and named after its meaning.
// Amounts are in the currency of the user's credit.

export const MS_PER_MINUTE = 60 * 1000;

// Pricing
export const BASE_PRICE = 1;
export const INCLUDED_MINUTES = 30;
export const PRICE_PER_EXTRA_MINUTE = 0.15;
export const ELECTRIC_BIKE_SURCHARGE = 2.5;
export const LONG_RENTAL_THRESHOLD_MINUTES = 24 * 60;
export const LONG_RENTAL_PENALTY = 25;
export const PREMIUM_PRICE_FACTOR = 0.8;

// Conditions to rent
export const MINIMUM_CREDIT_TO_RENT = 5;
export const BASE_PRE_AUTHORIZATION_AMOUNT = 5;
export const ELECTRIC_PRE_AUTHORIZATION_SURCHARGE = 2.5;

// Fraud detection: risk scores add up, the rental is refused from the refusal score
export const FRAUD_REFUSAL_SCORE = 100;
export const HIGH_AMOUNT_THRESHOLD = 40;
export const HIGH_AMOUNT_RISK_SCORE = 30;
export const NON_PREMIUM_RISK_SCORE = 10;
export const BLACKLISTED_RISK_SCORE = 100;

// Fleet
export const RIDING_MINUTES_PER_KILOMETER = 4;
export const REBALANCING_THRESHOLD_FACTOR = 1.5;

// Location
export const NORTH_ZONE_MIN_LATITUDE = 48.85;
export const CLEAR_WEATHER_MIN_LONGITUDE = 2.36;
