"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  fetchCollectionItemViewers,
  shareCollectionFolder,
  turnCollectionSharingOff,
  type CollectionShareViewer,
} from "@/lib/collectionsApi";

type Props = {
  open: boolean;
  ownerUserId: number;
  item: { id: number; name: string; kind: "folder" | "file" } | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function ShareCollectionItemModal({ open, ownerUserId, item, onClose, onChanged }: Props) {
  const [email, setEmail] = useState("");
  const [viewers, setViewers] = useState<CollectionShareViewer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadViewers() {
    if (!item) return;
    const result = await fetchCollectionItemViewers(ownerUserId, item.kind, item.id);
    setViewers(result.viewers);
  }

  useEffect(() => {
    if (!open || !item) return;
    setEmail("");
    setError(null);
    setMessage(null);
    loadViewers().catch(() => setError("Could not load people with access."));
  }, [open, item?.id]);

  if (!open || !item) return null;

  async function handleShare(event: FormEvent) {
    event.preventDefault();
    if (!item || item.kind !== "folder" || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await shareCollectionFolder(ownerUserId, item.id, email.trim());
      setMessage(result.message);
      setEmail("");
      await loadViewers();
      onChanged?.();
    } catch (err) {
      setError((err as { message?: string }).message ?? "Could not share folder.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-labelledby="share-collection-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-panel__header">
          <h2 id="share-collection-title" className="font-serif text-xl text-stone-900">Share {item.kind}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p className="text-sm text-stone-600">
          {item.kind === "folder"
            ? "Sharing this folder also shares all of its contents. The person must already have a KaamKaaj account."
            : "Choose a person below to turn inherited sharing off for this file."}
        </p>
        {item.kind === "folder" ? (
          <form onSubmit={handleShare} className="mt-4 flex gap-2">
            <input type="email" className="field-input text-sm" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="colleague@company.com" />
            <button type="submit" className="primary-button" disabled={loading || !email.trim()}>{loading ? "Sharing…" : "Share"}</button>
          </form>
        ) : null}
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">People with access</h3>
          {viewers.length ? <ul className="mt-2 space-y-2">
            {viewers.map((viewer) => <li key={viewer.userId} className="share-list-item">
              <span className="text-sm text-stone-800">{viewer.email}</span>
              <button type="button" className="text-xs text-stone-500 hover:text-stone-900" onClick={async () => {
                try {
                  await turnCollectionSharingOff(ownerUserId, item.kind, item.id, viewer.userId);
                  setViewers((current) => current.filter((entry) => entry.userId !== viewer.userId));
                  onChanged?.();
                } catch { setError("Could not turn sharing off."); }
              }}>Share off</button>
            </li>)}
          </ul> : <p className="mt-2 text-sm text-stone-600">No one has access yet.</p>}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      </div>
    </div>
  );
}
