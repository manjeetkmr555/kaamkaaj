"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addAllowedEmail,
  fetchAllowedEmails,
  removeAllowedEmail,
  type AllowedEmail,
} from "@/lib/adminApi";
import { getStoredUser } from "@/lib/session";

export default function AdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    if (!user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    setUserId(user.id);
    fetchAllowedEmails(user.id)
      .then((data) => setEmails(data.emails))
      .catch(() => setError("Could not load allowlist. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!userId || !newEmail.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const { email } = await addAllowedEmail(userId, newEmail.trim());
      setEmails((prev) =>
        [...prev, email].sort((a, b) => a.email.localeCompare(b.email)),
      );
      setNewEmail("");
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? "Could not add email.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number, email: string) {
    if (!userId) return;
    const confirmed = window.confirm(`Remove ${email} from the allowlist?`);
    if (!confirmed) return;

    setError(null);
    try {
      await removeAllowedEmail(userId, id);
      setEmails((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? "Could not remove email.");
    }
  }

  if (loading || !userId) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  return (
    <main className="app-shell px-6 py-10">
      <header className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
            Admin
          </p>
          <h1 className="font-serif text-2xl text-stone-900">Allowed emails</h1>
          <p className="mt-1 text-sm text-stone-600">
            Only emails on this list can create a KaamKaaj account.
          </p>
        </div>
        <Link href="/dashboard" className="share-trigger-btn">
          ← Dashboard
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
        <form onSubmit={handleAdd} className="panel space-y-4">
          <div>
            <label htmlFor="new-email" className="field-label">
              Add email
            </label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="field-input"
              placeholder="colleague@company.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newEmail.trim()}
            className="auth-submit-button"
          >
            {saving ? "Adding…" : "Add to allowlist"}
          </button>
        </form>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
          >
            {error}
          </p>
        ) : null}

        <section className="panel">
          <h2 className="font-serif text-lg text-stone-900">
            {emails.length} authorized {emails.length === 1 ? "email" : "emails"}
          </h2>
          {emails.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">
              No emails yet. Add one above to allow registration.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {emails.map((row) => (
                <li key={row.id} className="share-list-item">
                  <span className="text-sm font-medium text-stone-900">
                    {row.email}
                  </span>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-700 hover:underline"
                    onClick={() => void handleRemove(row.id, row.email)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
