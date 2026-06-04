"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  fetchReadingSentShares,
  revokeReadingShare,
  shareReadingList,
  type ReadingShareSent,
} from "@/lib/readingApi";
import { validateEmailClient, INVALID_EMAIL_MESSAGE } from "@/lib/emailValidation";

type ShareReadingModalProps = {
  ownerUserId: number;
  open: boolean;
  onClose: () => void;
};

export function ShareReadingModal({
  ownerUserId,
  open,
  onClose,
}: ShareReadingModalProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<ReadingShareSent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    fetchReadingSentShares(ownerUserId)
      .then((data) => setSent(data.shares))
      .catch(() => setError("Could not load shares."));
  }, [open, ownerUserId]);

  if (!open) return null;

  async function handleShare(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const check = validateEmailClient(email);
    if (!check.valid) {
      setError(check.message ?? INVALID_EMAIL_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const result = await shareReadingList(ownerUserId, email.trim());
      setSuccess(result.message);
      setEmail("");
      const data = await fetchReadingSentShares(ownerUserId);
      setSent(data.shares);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? "Could not share reading list.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(shareId: number) {
    try {
      await revokeReadingShare(ownerUserId, shareId);
      setSent((prev) => prev.filter((s) => s.id !== shareId));
    } catch {
      setError("Could not remove share.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="share-reading-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2 id="share-reading-title" className="font-serif text-xl text-stone-900">
            Share reading list
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="text-sm text-stone-600">
          Enter another person&apos;s email. They can <strong>view only</strong> — same
          layout as yours, without add, drag, or delete.
        </p>

        <form onSubmit={handleShare} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="field-input text-sm"
            autoComplete="email"
          />
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Sharing…" : "Share (view only)"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--warning)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 text-sm text-green-700">{success}</p>
        ) : null}

        {sent.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Shared with
            </h3>
            <ul className="mt-2 space-y-2">
              {sent.map((share) => (
                <li key={share.id} className="share-list-item">
                  <span className="text-sm text-stone-800">{share.viewerEmail}</span>
                  <button
                    type="button"
                    className="text-xs text-stone-500 hover:text-stone-900"
                    onClick={() => handleRevoke(share.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
