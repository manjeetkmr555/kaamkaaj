"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { WorkBoard } from "@/components/WorkBoard";
import { getStoredUser } from "@/lib/session";
import {
  fetchSharedWorkTracker,
  type WorkBoard as WorkBoardData,
} from "@/lib/workApi";

const EMPTY_BOARD: WorkBoardData = { todo: [], progress: [], done: [] };

export default function SharedWorkTrackerPage() {
  const router = useRouter();
  const params = useParams();
  const ownerId = Number(params.ownerId);

  const [viewerId, setViewerId] = useState<number | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [board, setBoard] = useState<WorkBoardData>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    if (!Number.isInteger(ownerId) || ownerId < 1) {
      router.replace("/dashboard");
      return;
    }

    setViewerId(user.id);
    fetchSharedWorkTracker(user.id, ownerId)
      .then((data) => {
        setOwnerEmail(data.owner.email);
        setBoard(data.tasks);
      })
      .catch((err: { message?: string }) => {
        setError(err.message ?? "Could not load shared board.");
      })
      .finally(() => setLoading(false));
  }, [router, ownerId]);

  if (loading || !viewerId) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-shell px-6 py-10">
        <p role="alert" className="text-sm text-[var(--warning)]">
          {error}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-teal-800 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="app-shell px-4 py-8 sm:px-6">
      <header className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
            KaamKaaj
          </p>
          <h1 className="font-serif text-2xl text-stone-900">Shared work tracker</h1>
          <p className="mt-1 text-sm text-stone-600">
            Viewing <strong>{ownerEmail}</strong> — read only
          </p>
          <span className="read-only-badge">View only</span>
        </div>
        <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
          ← Dashboard
        </Link>
      </header>

      <WorkBoard board={board} readOnly />
    </main>
  );
}
