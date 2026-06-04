"use client";

import { useState } from "react";
import { DeleteReadingModal } from "@/components/DeleteReadingModal";
import type { ReadingItem } from "@/lib/readingApi";

const ROW_DRAG_TYPE = "application/x-kaamkaaj-reading-row";

type ReadingBoardProps = {
  items: ReadingItem[];
  readOnly?: boolean;
  draggingId?: number | null;
  dropIndex?: number | null;
  onDragStart?: (id: number, index: number) => void;
  onDragEnd?: () => void;
  onDragOverRow?: (index: number) => void;
  onDropRow?: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility?: (item: ReadingItem) => void;
  onDelete?: (item: ReadingItem) => void;
};

export function ReadingBoard({
  items,
  readOnly = false,
  draggingId = null,
  dropIndex = null,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropRow,
  onToggleVisibility,
  onDelete,
}: ReadingBoardProps) {
  const [deleteTarget, setDeleteTarget] = useState<ReadingItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="reading-board-empty">
        {readOnly
          ? "No articles in this reading list."
          : "No articles yet. Use + Add URL to save your first link."}
      </p>
    );
  }

  return (
    <div className="reading-board">
      <div
        className={`reading-board__columns-head ${
          readOnly ? "reading-board__columns-head--readonly" : ""
        }`}
        aria-hidden
      >
        <div className="reading-column-head reading-column-head--url">URL</div>
        <div className="reading-column-head reading-column-head--category">
          Category
        </div>
        <div className="reading-column-head reading-column-head--summary">
          Summary
        </div>
        {!readOnly ? (
          <div className="reading-column-head reading-column-head--visibility">
            Visibility
          </div>
        ) : null}
      </div>

      <ul className="reading-entries">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={`reading-entry ${readOnly ? "reading-entry--readonly" : ""} ${
              !readOnly && !item.visible_to_shared ? "reading-entry--hidden-from-share" : ""
            } ${draggingId === item.id ? "reading-entry--dragging" : ""} ${
              dropIndex === index ? "reading-entry--drop-target" : ""
            }`}
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDragOverRow?.(index);
                  }
            }
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData(ROW_DRAG_TYPE);
                    if (!raw) return;
                    const { index: fromIndex } = JSON.parse(raw) as {
                      id: number;
                      index: number;
                    };
                    onDropRow?.(fromIndex, index);
                  }
            }
          >
            {!readOnly ? (
              <div
                className="reading-entry__grip"
                draggable
                onDragStart={(e) => {
                  onDragStart?.(item.id, index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(
                    ROW_DRAG_TYPE,
                    JSON.stringify({ id: item.id, index }),
                  );
                }}
                onDragEnd={onDragEnd}
                role="button"
                tabIndex={0}
                aria-label={`Reorder ${item.url}`}
                title="Drag to reorder"
              >
                ⋮⋮
              </div>
            ) : null}

            <div
              className={`reading-entry__grid ${
                readOnly ? "reading-entry__grid--readonly" : "reading-entry__grid--owner"
              }`}
            >
              <div className="reading-entry__cell reading-entry__cell--url">
                <span className="reading-entry__label">URL</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reading-entry__url"
                  draggable={false}
                >
                  {item.url}
                </a>
              </div>
              <div className="reading-entry__cell reading-entry__cell--category">
                <span className="reading-entry__label">Category</span>
                <span className="reading-entry__category">{item.category}</span>
              </div>
              <div className="reading-entry__cell reading-entry__cell--summary">
                <span className="reading-entry__label">Summary</span>
                <p className="reading-entry__summary">{item.summary}</p>
              </div>
              {!readOnly && onToggleVisibility ? (
                <div className="reading-entry__cell reading-entry__cell--visibility">
                  <span className="reading-entry__label">Visibility</span>
                  <button
                    type="button"
                    className={`reading-visibility-btn ${
                      item.visible_to_shared
                        ? "reading-visibility-btn--open"
                        : "reading-visibility-btn--closed"
                    }`}
                    onClick={() => onToggleVisibility(item)}
                    aria-label={
                      item.visible_to_shared
                        ? "Visible to shared viewers — click to hide"
                        : "Hidden from shared viewers — click to show"
                    }
                    title={
                      item.visible_to_shared
                        ? "Visible to people you shared with"
                        : "Hidden from people you shared with"
                    }
                  >
                    {item.visible_to_shared ? <EyeOpenIcon /> : <EyeClosedIcon />}
                  </button>
                </div>
              ) : null}
            </div>

            {!readOnly && onDelete ? (
              <button
                type="button"
                className="reading-entry__delete"
                onClick={() => setDeleteTarget(item)}
                aria-label="Delete article"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <DeleteReadingModal
        item={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget && onDelete) {
            onDelete(deleteTarget);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12C2 12 5.5 6 12 6C18.5 6 22 12 22 12C22 12 18.5 18 12 18C5.5 18 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.94 17.94C16.11 19.26 14.12 20 12 20C5.5 20 2 12 2 12C3.51 9.18 5.68 7.06 8.06 5.94M10.06 5.24C10.7 5.08 11.34 5 12 5C18.5 5 22 12 22 12C21.27 13.88 20.12 15.56 18.68 16.94M14.12 14.12C13.55 14.7 12.8 15.05 12 15.05C10.07 15.05 8.5 13.48 8.5 11.55C8.5 10.75 8.85 10 9.43 9.43"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 2L22 22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
