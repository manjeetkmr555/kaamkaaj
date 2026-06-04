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
  onAddTask?: (title: string) => Promise<void>;
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
  const [newTitle, setNewTitle] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkStatus | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAddTask(event: FormEvent) {
    event.preventDefault();
    if (!onAddTask || !newTitle.trim()) return;
    setAdding(true);
    try {
      await onAddTask(newTitle.trim());
      setNewTitle("");
    } finally {
      setAdding(false);
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

          {!readOnly && status === "todo" ? (
            <form onSubmit={handleAddTask} className="work-add-form">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New task title…"
                className="field-input text-sm"
                maxLength={500}
              />
              <button
                type="submit"
                className="work-float-btn work-float-btn--todo work-float-btn--compact"
                disabled={!newTitle.trim() || adding}
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
