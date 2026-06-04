"use client";

import type { ReadingItem } from "@/lib/readingApi";

type DeleteReadingModalProps = {
  item: ReadingItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteReadingModal({
  item,
  open,
  onClose,
  onConfirm,
}: DeleteReadingModalProps) {
  if (!open || !item) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="alertdialog"
        aria-labelledby="delete-reading-title"
        aria-describedby="delete-reading-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__header">
          <h2 id="delete-reading-title" className="font-serif text-xl text-stone-900">
            Remove article?
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="text-sm text-stone-600">
          Remove this from your reading list?
        </p>

        <div id="delete-reading-desc" className="delete-confirm-preview">
          <div className="reading-entry__cell reading-entry__cell--category">
            <span className="reading-entry__label delete-confirm-preview__label">
              Category
            </span>
            <span className="reading-entry__category">{item.category}</span>
          </div>
          <div className="reading-entry__cell reading-entry__cell--summary">
            <span className="reading-entry__label delete-confirm-preview__label">
              Summary
            </span>
            <p className="reading-entry__summary">{item.summary}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button type="button" className="delete-confirm-btn delete-confirm-btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="delete-confirm-btn delete-confirm-btn--delete"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
