import { clsx, type ClassValue } from 'clsx';

/** Tiny wrapper around clsx — drop-in for `${a} ${b}` template strings with conditionals. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
