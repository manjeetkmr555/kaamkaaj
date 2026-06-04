export type WorkStatus = "todo" | "progress" | "done";

export type WorkTaskRow = {
  id: number;
  user_id: number;
  title: string;
  status: WorkStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
