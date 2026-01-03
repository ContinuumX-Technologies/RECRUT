// Utility function for conditional classes (create this in src/lib/utils.ts)
export function cn(...classes: (string | undefined | null | boolean)[]): string {
   return classes.filter(Boolean).join(' ');
}

export const HUMAN_FILLERS = [
   "Hmm...",
   "Umm...",
   "Uh...",
   "Let's see...",
   "So...",
   "Well...",
   "Right...",
   "Okay...",
   "Ahh...",
   "Interesting...",
   "Alright...",
   "Hmh...",
   "Let me think...",
   "Hang on...",
   "Got it...",
   "Okay, so...",
   "Right then...",
   "I see...",
   "Hmm, okay..."
];

export function getRandomFiller() {
   return HUMAN_FILLERS[Math.floor(Math.random() * HUMAN_FILLERS.length)];
}