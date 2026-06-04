import type { ReadingItemRow } from "../routes/reading.js";

export const READING_ITEM_COLUMNS = `id, user_id, url, category, summary, visible_to_shared, sort_order, created_at, updated_at`;

export function mapReadingItem(row: ReadingItemRow) {
  return {
    ...row,
    visible_to_shared: Boolean(row.visible_to_shared),
  };
}
