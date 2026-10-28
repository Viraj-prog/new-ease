import type { Pt } from './geo';
import { geocode, getCurrentPoint } from './routing';

// Empty start means "where I am now".
export async function resolveStart(text: string): Promise<Pt | null> {
  return text.trim() ? geocode(text) : getCurrentPoint();
}

export async function resolveDestination(text: string): Promise<Pt | null> {
  return text.trim() ? geocode(text) : null;
}

// Supabase errors are plain objects with a message, not Error instances.
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}
