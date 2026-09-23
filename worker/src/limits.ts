/** Public rate-limit constants, in their own module so the Worker's entry file exports only handlers (the local runtime rejects other exports). */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
