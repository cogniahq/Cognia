import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware class composer. Mirrors client/src/lib/utils.lib.ts so the
 * same UX classnames port over verbatim.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
