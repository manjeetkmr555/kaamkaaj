"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { clearStoredUser, getStoredUser, type StoredUser } from "@/lib/session";
import {
  fetchReadingItems,
  fetchReadingReceivedShares,
  type ReadingShareReceived,
} from "@/lib/readingApi";
import {
  fetchReceivedShares,
  fetchWorkTasks,
  type WorkShareReceived,
} from "@/lib/workApi";
import { fetchCollectionTree } from "@/lib/collectionsApi";

type WorkStats = { todo: number; progress: number; done: number };
type DashboardData = {
  workStats: WorkStats;
  readingCount: number;
  collectionFolderCount: number;
  collectionFileCount: number;
  workShared: WorkShareReceived[];
  readingShared: ReadingShareReceived[];
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDisplayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  const name = local.split(/[._-]/)[0] ?? local;
  if (!name) return "there";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function getInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function DashboardSkeleton() {
  return (
    <main className="app-shell dashboard-shell">
      <div className="dashboard-shell__content">
        <div className="dashboard-brand-bar">
          <div className="dashboard-skeleton__line dashboard-skeleton__line--brand" />
        </div>
        <div className="dashboard-page">
          <div className="dashboard-skeleton__header">
            <div className="space-y-3">
              <div className="dashboard-skeleton__line dashboard-skeleton__line--lg" />
              <div className="dashboard-skeleton__line dashboard-skeleton__line--md" />
            </div>
            <div className="dashboard-skeleton__chip" />
          </div>
          <div className="dashboard-cards">
            <div className="dashboard-skeleton__card" />
            <div className="dashboard-skeleton__card" />
            <div className="dashboard-skeleton__card" />
          </div>
          <div className="dashboard-skeleton__shared" />
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/");
      return;
    }
    setUser(stored);

    Promise.all([
      fetchWorkTasks(stored.id).catch(() => ({
        tasks: { todo: [], progress: [], done: [] },
      })),
      fetchReadingItems(stored.id).catch(() => ({ items: [] })),
      fetchCollectionTree(stored.id).catch(() => ({
        folders: [],
        files: [],
      })),
      fetchReceivedShares(stored.id).catch(() => ({ shares: [] })),
      fetchReadingReceivedShares(stored.id).catch(() => ({ shares: [] })),
    ]).then(([work, reading, collections, workShares, readingShares]) => {
      setData({
        workStats: {
          todo: work.tasks.todo.length,
          progress: work.tasks.progress.length,
          done: work.tasks.done.length,
        },
        readingCount: reading.items.length,
        collectionFolderCount: collections.folders.length,
        collectionFileCount: collections.files.length,
        workShared: workShares.shares,
        readingShared: readingShares.shares,
      });
    });
  }, [router]);

  if (!user || !data) {
    return <DashboardSkeleton />;
  }

  const totalTasks =
    data.workStats.todo + data.workStats.progress + data.workStats.done;
  const hasShared =
    data.workShared.length > 0 || data.readingShared.length > 0;

  return (
    <main className="app-shell dashboard-shell">
      <div className="dashboard-shell__content">
        <div className="dashboard-brand-bar">
          <BrandLockup />
        </div>
        <div className="dashboard-page">
        <header className="dashboard-hero">
          <div className="dashboard-hero__row">
            <div className="dashboard-hero__welcome">
              <h1 className="auth-title">
                {getGreeting()}, {getDisplayName(user.email)}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Your work, reading, and collections in one calm place.
              </p>
            </div>
            <div className="dashboard-hero__actions">
              {user.isAdmin ? (
                <Link href="/admin" className="share-trigger-btn">
                  Admin
                </Link>
              ) : null}
              <span className="user-chip" title={user.email}>
                <span className="user-chip__avatar" aria-hidden>
                  {getInitials(user.email)}
                </span>
                <span className="user-chip__email">{user.email}</span>
              </span>
              <Link
                href="/"
                className="share-trigger-btn"
                onClick={() => clearStoredUser()}
              >
                Sign out
              </Link>
            </div>
          </div>
        </header>

        <div className="dashboard-cards">
          <Link href="/work-tracker" className="dashboard-card dashboard-card--work group">
            <div className="dashboard-card__icon" aria-hidden>
              <WorkTrackerIcon />
            </div>
            <div className="dashboard-card__body">
              <h2 className="font-serif text-xl text-stone-900 group-hover:text-teal-900">
                Work Tracker
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Organize tasks across TODO, PROGRESS, and DONE. Share your board
                for others to view.
              </p>
              <div className="dashboard-card__stats">
                <span className="dashboard-stat dashboard-stat--todo">
                  {data.workStats.todo} Todo
                </span>
                <span className="dashboard-stat dashboard-stat--progress">
                  {data.workStats.progress} In Progress
                </span>
                <span className="dashboard-stat dashboard-stat--done">
                  {data.workStats.done} Done
                </span>
              </div>
              {totalTasks === 0 ? (
                <p className="dashboard-card__hint">No tasks yet — add your first one.</p>
              ) : null}
              <span className="dashboard-card__cta">
                Open board
                <span className="dashboard-card__arrow" aria-hidden>
                  →
                </span>
              </span>
            </div>
          </Link>

          <Link href="/reading-list" className="dashboard-card dashboard-card--reading group">
            <div className="dashboard-card__icon" aria-hidden>
              <ReadingListIcon />
            </div>
            <div className="dashboard-card__body">
              <h2 className="font-serif text-xl text-stone-900 group-hover:text-teal-900">
                Reading List
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Save article URLs with AI category and summary. Share for
                view-only access.
              </p>
              <div className="dashboard-card__stats">
                <span className="dashboard-stat dashboard-stat--reading">
                  {data.readingCount}{" "}
                  {data.readingCount === 1 ? "Article" : "Articles"} Saved
                </span>
              </div>
              {data.readingCount === 0 ? (
                <p className="dashboard-card__hint">
                  No Articles Yet — Paste a URL to get started.
                </p>
              ) : null}
              <span className="dashboard-card__cta">
                Open List
                <span className="dashboard-card__arrow" aria-hidden>
                  →
                </span>
              </span>
            </div>
          </Link>

          <Link href="/collections" className="dashboard-card dashboard-card--collections group">
            <div className="dashboard-card__icon" aria-hidden>
              <CollectionsIcon />
            </div>
            <div className="dashboard-card__body">
              <h2 className="font-serif text-xl text-stone-900 group-hover:text-teal-900">
                Collections
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Keep folders and files together — notes, links, or anything you
                want to organize.
              </p>
              <div className="dashboard-card__stats">
                <span className="dashboard-stat dashboard-stat--collections-folders">
                  {data.collectionFolderCount}{" "}
                  {data.collectionFolderCount === 1 ? "Folder" : "Folders"}
                </span>
                <span className="dashboard-stat dashboard-stat--collections-files">
                  {data.collectionFileCount}{" "}
                  {data.collectionFileCount === 1 ? "File" : "Files"}
                </span>
              </div>
              {data.collectionFolderCount === 0 &&
              data.collectionFileCount === 0 ? (
                <p className="dashboard-card__hint">
                  No items yet — create your first folder or file.
                </p>
              ) : null}
              <span className="dashboard-card__cta">
                Open collections
                <span className="dashboard-card__arrow" aria-hidden>
                  →
                </span>
              </span>
            </div>
          </Link>
        </div>

        <section className="dashboard-shared">
          <div className="dashboard-shared__header">
            <div className="dashboard-shared__icon" aria-hidden>
              <SharedIcon />
            </div>
            <div>
              <h2 className="font-serif text-lg text-stone-900">Shared with you</h2>
              <p className="mt-1 text-sm text-stone-600">
                View-only — same layout as the owner, without edits.
              </p>
            </div>
          </div>

          {hasShared ? (
            <div className="dashboard-shared__grid">
              {data.workShared.length > 0 ? (
                <div className="dashboard-shared__group">
                  <h3 className="dashboard-shared__label">Work trackers</h3>
                  <ul className="dashboard-shared__list">
                    {data.workShared.map((share) => (
                      <li key={`work-${share.id}`}>
                        <Link
                          href={`/work-tracker/view/${share.ownerUserId}`}
                          className="dashboard-shared__item"
                        >
                          <span className="dashboard-shared__avatar" aria-hidden>
                            {getInitials(share.ownerEmail)}
                          </span>
                          <span className="dashboard-shared__meta">
                            <span className="dashboard-shared__email">
                              {share.ownerEmail}
                            </span>
                            <span className="dashboard-shared__action">
                              View board
                            </span>
                          </span>
                          <span className="dashboard-shared__arrow" aria-hidden>
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.readingShared.length > 0 ? (
                <div className="dashboard-shared__group">
                  <h3 className="dashboard-shared__label">Reading lists</h3>
                  <ul className="dashboard-shared__list">
                    {data.readingShared.map((share) => (
                      <li key={`reading-${share.id}`}>
                        <Link
                          href={`/reading-list/view/${share.ownerUserId}`}
                          className="dashboard-shared__item"
                        >
                          <span className="dashboard-shared__avatar" aria-hidden>
                            {getInitials(share.ownerEmail)}
                          </span>
                          <span className="dashboard-shared__meta">
                            <span className="dashboard-shared__email">
                              {share.ownerEmail}
                            </span>
                            <span className="dashboard-shared__action">
                              View list
                            </span>
                          </span>
                          <span className="dashboard-shared__arrow" aria-hidden>
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="dashboard-shared__empty">
              <p className="text-sm text-stone-600">
                Nothing shared with you yet. When someone invites you from their
                Work Tracker or Reading List, it will appear here.
              </p>
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}

function WorkTrackerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="5" width="6" height="18" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="11" y="5" width="6" height="18" rx="2" fill="currentColor" opacity="0.65" />
      <rect x="19" y="5" width="6" height="18" rx="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function ReadingListIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M6 6h16a1 1 0 011 1v15a1 1 0 01-1.4.92L14 20.5l-7.6 2.42A1 1 0 015 22V7a1 1 0 011-1z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M10 10h8M10 14h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CollectionsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M4 8.5A2.5 2.5 0 016.5 6h5.2l1.8 2H21.5A2.5 2.5 0 0124 10.5v9A2.5 2.5 0 0121.5 22h-15A2.5 2.5 0 014 19.5v-11z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M9 14h10M9 17.5h7"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SharedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="7" cy="7" r="3" fill="currentColor" />
      <circle cx="15" cy="7" r="3" fill="currentColor" opacity="0.7" />
      <path
        d="M3 18c0-2.2 1.8-4 4-4s4 1.8 4 4M11 18c0-2.2 1.8-4 4-4s4 1.8 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
