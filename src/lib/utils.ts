import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isReactiveType = (type?: string | null) =>
  (type ?? "").toLowerCase().trim() === "reactif";
