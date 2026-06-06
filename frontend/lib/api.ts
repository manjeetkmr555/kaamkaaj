import { apiFetch, API_UNAVAILABLE_MESSAGE, parseJson } from "@/lib/apiClient";

type ApiError = {
  message: string;
  field?: string;
  reason?: string;
};

export { API_UNAVAILABLE_MESSAGE };

export async function validateEmailOnServer(email: string) {
  return parseJson<{
    valid: boolean;
    email?: string;
    allowed?: boolean;
    message?: string;
  }>(
    await apiFetch("/api/auth/validate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

export async function registerUser(email: string, password: string) {
  return parseJson<{ message: string; user: { id: number; email: string } }>(
    await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

export async function loginUser(email: string, password: string) {
  return parseJson<{ message: string; user: { id: number; email: string } }>(
    await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

export type { ApiError };
