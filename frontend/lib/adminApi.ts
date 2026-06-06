import { apiFetch, parseJson } from "@/lib/apiClient";

export type AllowedEmail = {
  id: number;
  email: string;
  createdAt: string;
};

export async function fetchAllowedEmails(userId: number) {
  return parseJson<{ emails: AllowedEmail[] }>(
    await apiFetch(`/api/admin/allowed-emails?userId=${userId}`),
  );
}

export async function addAllowedEmail(userId: number, email: string) {
  return parseJson<{ email: AllowedEmail }>(
    await apiFetch("/api/admin/allowed-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    }),
  );
}

export async function removeAllowedEmail(userId: number, id: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/admin/allowed-emails/${id}?userId=${userId}`, {
      method: "DELETE",
    }),
  );
}
