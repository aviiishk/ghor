import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui's class-name helper. tailwind-merge v2 matches this app's Tailwind 3.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
