"use client";

import { FormEvent, useState } from "react";
import { CollectionColorPicker } from "@/components/CollectionColorPicker";
import type { CollectionFileColor } from "@/lib/collectionsApi";

type AddCollectionFolderModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (input: { name: string; color: CollectionFileColor }) => Promise<void>;
};

export function AddCollectionFolderModal({
  open,
  onClose,
  onAdd,
}: AddCollectionFolderModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<CollectionFileColor>("#1d4ed8");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onAdd({ name: name.trim(), color });
      setName("");
      setColor("#1d4ed8");
      onClose();
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? "Could not add folder.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="add-collection-folder-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2
            id="add-collection-folder-title"
            className="font-serif text-xl text-stone-900"
          >
            Add folder
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
          Give the folder a name and pick a colour.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-800">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name…"
              className="field-input text-sm"
              maxLength={200}
              disabled={loading}
              autoFocus
              required
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
            {loading ? "Saving…" : "Add folder"}
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
