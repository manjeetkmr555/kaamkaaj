"use client";

import { FormEvent, useState } from "react";

type AddReadingModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
};

export function AddReadingModal({ open, onClose, onAdd }: AddReadingModalProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onAdd(url.trim());
      setUrl("");
      onClose();
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? "Could not add URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="add-reading-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2 id="add-reading-title" className="font-serif text-xl text-stone-900">
            Add article URL
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="text-sm text-stone-600">
          Paste a news or article link. Category and summary are generated automatically.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="field-input text-sm"
            disabled={loading}
            autoFocus
          />
          <button type="submit" className="primary-button" disabled={loading || !url.trim()}>
            {loading ? "Generating with AI…" : "Add to list"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--warning)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
