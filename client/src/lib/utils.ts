import { clsx, type ClassValue } from "clsx";

/** Junta classes condicionais mantendo a ultima vencedora na ordem escrita. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
