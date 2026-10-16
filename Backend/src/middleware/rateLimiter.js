import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Authentication endpoints (Login / Register / Password Reset).
 * Protects against brute-force password guessing and token exhaustion attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // Max 20 requests per IP per 15 mins
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again in 15 minutes.',
  },
});

export const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many activation attempts. Please wait before trying again.',
  },
});

/**
 * Rate Limiter for Order Creation & Checkout endpoints.
 * Protects against order spamming and Denial-of-Service on database transactions.
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === "production" ? 60 : 300,
  skip: (req) => req.method === "GET" || req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many checkout requests in a short period. Please wait a moment before trying again.",
  },
});

/**
 * General API Traffic Limiter.
 * Protects server resources from traffic floods and automated scrapers.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === "production" ? 300 : 2000,
  skip: (req) => req.method === "OPTIONS" || req.path?.includes("/events/"),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many API requests from this IP. Please slow down.",
  },
});

export default {
  authLimiter,
  activationLimiter,
  orderLimiter,
  apiLimiter,
};
