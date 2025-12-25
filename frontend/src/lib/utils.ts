// Utility function for conditional classes (create this in src/lib/utils.ts)
export function cn(...classes: (string | undefined | null | boolean)[]): string {
   return classes.filter(Boolean).join(' ');
}