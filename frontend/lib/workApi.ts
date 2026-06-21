import { apiFetch, parseJson } from "@/lib/apiClient";

export type WorkStatus = "todo" | "progress" | "done";

export type WorkTask = {
  id: number;
  user_id: number;
  title: string;
  status: WorkStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WorkBoard = Record<WorkStatus, WorkTask[]>;

export async function fetchWorkTasks(userId: number) {
  return parseJson<{ tasks: WorkBoard }>(
    await apiFetch(`/api/work/tasks?userId=${userId}`),
  );
}

export async function createWorkTask(
  userId: number,
  title: string,
  status: WorkStatus = "todo", // which column to add the task into
) {
  return parseJson<{ task: WorkTask }>(
    await apiFetch("/api/work/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, status }), // send status to backend
    }),
  );
}

export async function updateWorkTaskStatus(
  userId: number,
  taskId: number,
  status: WorkStatus,
) {
  return parseJson<{ task: WorkTask }>(
    await apiFetch(`/api/work/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status }),
    }),
  );
}

export async function deleteWorkTask(userId: number, taskId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/work/tasks/${taskId}?userId=${userId}`, {
      method: "DELETE",
    }),
  );
}

export type WorkShareSent = {
  id: number;
  viewerUserId: number;
  viewerEmail: string;
  createdAt: string;
};

export type WorkShareReceived = {
  id: number;
  ownerUserId: number;
  ownerEmail: string;
  createdAt: string;
};

export async function shareWorkTracker(ownerUserId: number, viewerEmail: string) {
  return parseJson<{
    message: string;
    share: { id: number; viewerEmail: string; viewerUserId: number };
  }>(
    await apiFetch("/api/work/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId, viewerEmail }),
    }),
  );
}

export async function fetchSentShares(userId: number) {
  return parseJson<{ shares: WorkShareSent[] }>(
    await apiFetch(`/api/work/shares/sent?userId=${userId}`),
  );
}

export async function fetchReceivedShares(userId: number) {
  return parseJson<{ shares: WorkShareReceived[] }>(
    await apiFetch(`/api/work/shares/received?userId=${userId}`),
  );
}

export async function revokeShare(ownerUserId: number, shareId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/work/share/${shareId}?ownerUserId=${ownerUserId}`, {
      method: "DELETE",
    }),
  );
}

export async function fetchSharedWorkTracker(
  viewerUserId: number,
  ownerUserId: number,
) {
  return parseJson<{
    owner: { id: number; email: string };
    tasks: WorkBoard;
    readOnly: boolean;
  }>(
    await apiFetch(
      `/api/work/shared?ownerUserId=${ownerUserId}&viewerUserId=${viewerUserId}`,
    ),
  );
}
