"use client";

import { FormEvent, useEffect, useState } from "react";
import { CollectionColorPicker } from "@/components/CollectionColorPicker";
import {
  collectionLinkOrTextValue,
  parseCollectionLinkOrText,
  toCollectionColor,
  type CollectionFileColor,
} from "@/lib/collectionsApi";

type EditCollectionItemModalProps = {
  open: boolean;
  kind: "folder" | "file" | "image";
  initialName: string;
  initialColor: string;
  initialUrl?: string | null;
  initialNotes?: string | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    color: CollectionFileColor;
    url?: string | null;
    notes?: string | null;
  }) => Promise<void>;
};

export function EditCollectionItemModal({
  open,
  kind,
  initialName,
  initialColor,
  initialUrl = null,
  initialNotes = null,
  onClose,
  onSave,
}: EditCollectionItemModalProps) {
  const [name, setName] = useState(initialName);
  const [linkOrText, setLinkOrText] = useState(
    collectionLinkOrTextValue(initialUrl, initialNotes),
  );
  const [color, setColor] = useState<CollectionFileColor>(
    toCollectionColor(initialColor),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isFileLike = kind === "file" || kind === "image";

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setLinkOrText(collectionLinkOrTextValue(initialUrl, initialNotes));
    setColor(toCollectionColor(initialColor));
    setError(null);
  }, [open, initialName, initialColor, initialUrl, initialNotes]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      if (isFileLike) {
        const { url, notes } = parseCollectionLinkOrText(linkOrText);
        await onSave({ name: name.trim(), color, url, notes });
      } else {
        await onSave({ name: name.trim(), color });
      }
      onClose();
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? `Could not update ${kind}.`);
    } finally {
      setLoading(false);
    }
  }

  const title =
    kind === "folder"
      ? "Edit folder"
      : kind === "image"
        ? "Edit image"
        : "Edit file";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-labelledby="edit-collection-item-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2
            id="edit-collection-item-title"
            className="font-serif text-xl text-stone-900"
          >
            {title}
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
          {isFileLike
            ? "Update the name, text or link, and colour."
            : "Update the name and colour."}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-800">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kind === "folder"
                  ? "Folder name…"
                  : kind === "image"
                    ? "Image name…"
                    : "File name…"
              }
              className="field-input text-sm"
              maxLength={kind === "folder" ? 200 : 500}
              disabled={loading}
              autoFocus
              required
            />
          </label>

          {isFileLike ? (
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
          ) : null}

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
            {loading ? "Saving…" : "Save changes"}
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
