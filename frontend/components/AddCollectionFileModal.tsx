"use client";

import { FormEvent, useState } from "react";
import { CollectionColorPicker } from "@/components/CollectionColorPicker";
import type {
  CollectionFileColor,
  CollectionItemKind,
} from "@/lib/collectionsApi";
import { parseCollectionLinkOrText } from "@/lib/collectionsApi";

type AddCollectionFileModalProps = {
  open: boolean;
  kind?: CollectionItemKind;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    color: CollectionFileColor;
    kind: CollectionItemKind;
    url?: string;
    notes?: string;
  }) => Promise<void>;
};

export function AddCollectionFileModal({
  open,
  kind = "file",
  onClose,
  onAdd,
}: AddCollectionFileModalProps) {
  const [name, setName] = useState("");
  const [linkOrText, setLinkOrText] = useState("");
  const [color, setColor] = useState<CollectionFileColor>("#1d4ed8");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const label = kind === "image" ? "image" : "file";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { url, notes } = parseCollectionLinkOrText(linkOrText);
      await onAdd({
        name: name.trim(),
        color,
        kind,
        url: url ?? undefined,
        notes: notes ?? undefined,
      });
      setName("");
      setLinkOrText("");
      setColor("#1d4ed8");
      onClose();
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? `Could not add ${label}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="add-collection-file-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2
            id="add-collection-file-title"
            className="font-serif text-xl text-stone-900"
          >
            Add {label}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="text-sm text-stone-600">
          Give the {label} a name, optional text or link, and pick a colour.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-800">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${kind === "image" ? "Image" : "File"} name…`}
              className="field-input text-sm"
              maxLength={500}
              disabled={loading}
              autoFocus
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-800">
              Text / link
            </span>
            <input
              type="text"
              value={linkOrText}
              onChange={(e) => setLinkOrText(e.target.value)}
              placeholder="Note or https://…"
              className="field-input text-sm"
              maxLength={2000}
              disabled={loading}
            />
          </label>

          <CollectionColorPicker
            value={color}
            onChange={setColor}
            disabled={loading}
          />

          <button
            type="submit"
            className="primary-button"
            disabled={loading || !name.trim()}
          >
            {loading ? "Saving…" : `Add ${label}`}
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
