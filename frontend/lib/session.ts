export type StoredUser = { id: number; email: string };

export const SESSION_KEY = "kaamkaaj_user";

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearStoredUser(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
