import arcjet, { shield, detectBot, tokenBucket } from "@arcjet/node";
import { ARCJET_API_KEY } from "../config/env.js";

const aj = arcjet({
  // Get your site key from https://app.arcjet.com and set it as an environment
  // variable rather than hard coding.
  key: ARCJET_API_KEY,
  characteristics: ["ip.src"], // Track by IP address by default
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Deny known-bad bots only. Allow-list mode was blocking Next.js server
    // actions (Undici / Node fetch), which emptied stocks, copytrade, and admin UIs.
    detectBot({
      mode: "LIVE",
      deny: ["CATEGORY:BOTNET"],
    }),
    // Rate limit — sized for dashboard loads (stocks + options + portfolio)
    tokenBucket({
      mode: "LIVE",
      refillRate: 30, // Refill 30 tokens per interval
      interval: 10, // Refill every 10 seconds
      capacity: 60, // Bucket capacity
    }),
  ],
});

export default aj;
