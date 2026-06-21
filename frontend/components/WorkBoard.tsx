"use client";

import { FormEvent, useState } from "react";
import type { WorkBoard as WorkBoardData, WorkStatus, WorkTask } from "@/lib/workApi";

const COLUMNS: { status: WorkStatus; label: string }[] = [
  { status: "todo", label: "TODO" },
  { status: "progress", label: "PROGRESS" },
  { status: "done", label: "DONE" },
];

const DRAG_TYPE = "application/x-kaamkaaj-task";

type WorkBoardProps = {
  board: WorkBoardData;
  readOnly?: boolean;
  // now receives the column status so we know where the task was added
  onAddTask?: (title: string, status: WorkStatus) => Promise<void>;
  onMoveTask?: (
    taskId: number,
    fromStatus: WorkStatus,
    toStatus: WorkStatus,
  ) => Promise<void>;
  onDeleteTask?: (task: WorkTask) => Promise<void>;
};

export function WorkBoard({
  board,
  readOnly = false,
  onAddTask,
  onMoveTask,
  onDeleteTask,
}: WorkBoardProps) {
  // one input value and loading state per column (keyed by status)
  const [newTitles, setNewTitles] = useState<Record<WorkStatus, string>>({
    todo: "",
    progress: "",
    done: "",
  });
  const [adding, setAdding] = useState<WorkStatus | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkStatus | null>(null);

  // called when the user submits the add-task form in any column
  async function handleAddTask(event: FormEvent, status: WorkStatus) {
    event.preventDefault();
    const title = newTitles[status].trim();
    if (!onAddTask || !title) return;
    setAdding(status); // mark this column as loading
    try {
      await onAddTask(title, status); // pass both title and the column status
      setNewTitles((prev) => ({ ...prev, [status]: "" })); // clear only this column's input
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="work-board mx-auto max-w-6xl">
      {COLUMNS.map(({ status, label }) => (
        <section
          key={status}
          className={`work-column work-column--${status} ${
            !readOnly && dropTarget === status ? "work-column--drop-active" : ""
          }`}
          onDragOver={
            readOnly
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(status);
                }
          }
          onDragLeave={
            readOnly
              ? undefined
              : (e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTarget((current) => (current === status ? null : current));
                }
          }
          onDrop={
            readOnly
              ? undefined
              : async (e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  setDraggingId(null);

                  const raw = e.dataTransfer.getData(DRAG_TYPE);
                  if (!raw || !onMoveTask) return;

                  const { taskId, fromStatus } = JSON.parse(raw) as {
                    taskId: number;
                    fromStatus: WorkStatus;
                  };
                  if (fromStatus === status) return;
                  await onMoveTask(taskId, fromStatus, status);
                }
          }
        >
          <header className={`work-column__header work-column__header--${status}`}>
            <h2 className="work-column__title">{label}</h2>
            <span className="work-column__count">{board[status].length}</span>
          </header>

          {!readOnly ? (
            // show an add form in every column, not just "todo"
            <form onSubmit={(e) => handleAddTask(e, status)} className="work-add-form">
              <input
                type="text"
                value={newTitles[status]}
                onChange={(e) =>
                  setNewTitles((prev) => ({ ...prev, [status]: e.target.value }))
                }
                placeholder="New task title…"
                className="field-input text-sm"
                maxLength={500}
              />
              <button
                type="submit"
                className={`work-float-btn work-float-btn--${status} work-float-btn--compact`}
                disabled={!newTitles[status].trim() || adding === status}
              >
                Add
              </button>
            </form>
          ) : null}

          <ul className="work-column__list">
            {board[status].map((task) => (
              <li key={task.id}>
                <div
                  draggable={!readOnly}
                  onDragStart={
                    readOnly
                      ? undefined
                      : (e) => {
                          setDraggingId(task.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            DRAG_TYPE,
                            JSON.stringify({
                              taskId: task.id,
                              fromStatus: task.status,
                            }),
                          );
                        }
                  }
                  onDragEnd={
                    readOnly
                      ? undefined
                      : () => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }
                  }
                  className={`work-float-btn work-float-btn--${task.status} ${
                    readOnly ? "work-float-btn--readonly" : ""
                  } ${draggingId === task.id ? "work-float-btn--dragging" : ""}`}
                >
                  {!readOnly ? (
                    <span className="work-float-btn__grip" aria-hidden>
                      ⋮⋮
                    </span>
                  ) : null}
                  <span className="work-float-btn__label">{task.title}</span>
                  {!readOnly && onDeleteTask ? (
                    <button
                      type="button"
                      className="work-float-btn__delete"
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Delete "${task.title}" from your work tracker?`,
                        );
                        if (confirmed) void onDeleteTask(task);
                      }}
                      aria-label={`Delete ${task.title}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {board[status].length === 0 ? (
            <p className="work-column__empty">
              {readOnly ? "No tasks" : "Drop tasks here"}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
