import { proxy, config } from "./proxy";

// Next.js expects a `middleware` export; reuse shared proxy implementation.
export { proxy as middleware, config };
