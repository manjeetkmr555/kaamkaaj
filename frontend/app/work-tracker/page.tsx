"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShareWorkModal } from "@/components/ShareWorkModal";
import { WorkBoard } from "@/components/WorkBoard";
import { getStoredUser } from "@/lib/session";
import {
  createWorkTask,
  deleteWorkTask,
  fetchWorkTasks,
  reorderWorkTasks,
  updateWorkTaskStatus,
  type WorkBoard as WorkBoardData,
  type WorkStatus,
  type WorkTask,
} from "@/lib/workApi";

const EMPTY_BOARD: WorkBoardData = { todo: [], progress: [], done: [] };

export default function WorkTrackerPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [board, setBoard] = useState<WorkBoardData>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const loadBoard = useCallback(async (uid: number) => {
    const { tasks } = await fetchWorkTasks(uid);
    setBoard(tasks);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setUserId(user.id);
    loadBoard(user.id)
      .catch(() => setError("Could not load tasks. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [router, loadBoard]);

  function reorderLocal(tasks: WorkTask[], fromIndex: number, toIndex: number) {
    const next = [...tasks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function moveTaskInBoard(
    prev: WorkBoardData,
    taskId: number,
    from: WorkStatus,
    to: WorkStatus,
    updated?: WorkTask,
  ): WorkBoardData {
    const task =
      updated ?? prev[from].find((t) => t.id === taskId) ?? prev[to].find((t) => t.id === taskId);
    if (!task) return prev;

    const nextTask = { ...task, status: to };
    return {
      todo: prev.todo.filter((t) => t.id !== taskId),
      progress: prev.progress.filter((t) => t.id !== taskId),
      done: prev.done.filter((t) => t.id !== taskId),
      [to]: [...prev[to].filter((t) => t.id !== taskId), nextTask],
    } as WorkBoardData;
  }

  if (loading || !userId) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
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
          <h1 className="font-serif text-2xl text-stone-900">Work Tracker</h1>
          <p className="mt-1 text-sm text-stone-600">
            Drag tasks between columns to update status, or drag ⋮⋮ within a column to reorder.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
            ← Dashboard
          </Link>
          <button
            type="button"
            className="share-trigger-btn"
            onClick={() => setShareOpen(true)}
          >
            Share
          </button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-6xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          {error}
        </p>
      ) : null}

      <WorkBoard
        board={board}
        onAddTask={async (title, status) => {
          // pass the column status so the backend saves it in the right column
          const { task } = await createWorkTask(userId, title, status);
          // add the returned task to whichever column it belongs to
          setBoard((prev) => ({ ...prev, [status]: [...prev[status], task] }));
          setError(null);
        }}
        onReorderTask={async (status, fromIndex, toIndex) => {
          const previousBoard = board;
          const reordered = reorderLocal(board[status], fromIndex, toIndex);
          setBoard((prev) => ({ ...prev, [status]: reordered }));
          try {
            const { tasks } = await reorderWorkTasks(
              userId,
              status,
              reordered.map((task) => task.id),
            );
            setBoard(tasks);
            setError(null);
          } catch {
            setBoard(previousBoard);
            setError("Could not reorder tasks.");
          }
        }}
        onMoveTask={async (taskId, fromStatus, toStatus) => {
          const previousBoard = board;
          setBoard((prev) => moveTaskInBoard(prev, taskId, fromStatus, toStatus));
          try {
            const { task: updated } = await updateWorkTaskStatus(
              userId,
              taskId,
              toStatus,
            );
            setBoard((prev) =>
              moveTaskInBoard(prev, taskId, fromStatus, toStatus, updated),
            );
            setError(null);
          } catch {
            setBoard(previousBoard);
            setError("Could not move task.");
          }
        }}
        onDeleteTask={async (task) => {
          await deleteWorkTask(userId, task.id);
          setBoard((prev) => ({
            ...prev,
            [task.status]: prev[task.status].filter((t) => t.id !== task.id),
          }));
        }}
      />

      <ShareWorkModal
        ownerUserId={userId}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </main>
  );
}
