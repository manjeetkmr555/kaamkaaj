"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearStoredUser, getStoredUser, type StoredUser } from "@/lib/session";
import { fetchReadingReceivedShares, type ReadingShareReceived } from "@/lib/readingApi";
import { fetchReceivedShares, type WorkShareReceived } from "@/lib/workApi";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [workShared, setWorkShared] = useState<WorkShareReceived[]>([]);
  const [readingShared, setReadingShared] = useState<ReadingShareReceived[]>([]);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/");
      return;
    }
    setUser(stored);
    fetchReceivedShares(stored.id)
      .then((data) => setWorkShared(data.shares))
      .catch(() => setWorkShared([]));
    fetchReadingReceivedShares(stored.id)
      .then((data) => setReadingShared(data.shares))
      .catch(() => setReadingShared([]));
  }, [router]);

  if (!user) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  const hasShared = workShared.length > 0 || readingShared.length > 0;

  return (
    <main className="app-shell px-6 py-10">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
            KaamKaaj
          </p>
          <h1 className="font-serif text-2xl text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-600">Signed in as {user.email}</p>
        </div>
        <Link
          href="/"
          className="text-sm text-teal-800 hover:underline"
          onClick={() => clearStoredUser()}
        >
          Sign out
        </Link>
      </header>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
        <Link href="/work-tracker" className="panel panel--link group">
          <h2 className="font-serif text-xl text-stone-900 group-hover:text-teal-900">
            Work Tracker
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Organize tasks across TODO, PROGRESS, and DONE. Share your board for
            others to view.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-800">
            Open board
            <span aria-hidden>→</span>
          </span>
        </Link>

        <Link href="/reading-list" className="panel panel--link group">
          <h2 className="font-serif text-xl text-stone-900 group-hover:text-teal-900">
            Reading List
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Save article URLs with AI category and summary. Share for view-only
            access.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-800">
            Open list
            <span aria-hidden>→</span>
          </span>
        </Link>
      </div>

      {hasShared ? (
        <section className="mx-auto mt-10 max-w-5xl space-y-8">
          <div>
            <h2 className="font-serif text-lg text-stone-900">Shared with you</h2>
            <p className="mt-1 text-sm text-stone-600">
              View-only — same layout as the owner, without edits.
            </p>
          </div>

          {workShared.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-stone-700">Work trackers</h3>
              <ul className="mt-2 space-y-2">
                {workShared.map((share) => (
                  <li key={`work-${share.id}`}>
                    <Link
                      href={`/work-tracker/view/${share.ownerUserId}`}
                      className="shared-board-link"
                    >
                      <span className="font-medium text-stone-900">
                        {share.ownerEmail}
                      </span>
                      <span className="text-sm text-teal-800">View board →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {readingShared.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-stone-700">Reading lists</h3>
              <ul className="mt-2 space-y-2">
                {readingShared.map((share) => (
                  <li key={`reading-${share.id}`}>
                    <Link
                      href={`/reading-list/view/${share.ownerUserId}`}
                      className="shared-board-link"
                    >
                      <span className="font-medium text-stone-900">
                        {share.ownerEmail}
                      </span>
                      <span className="text-sm text-teal-800">View list →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
