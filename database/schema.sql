-- KaamKaaj PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON allowed_emails (email);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS work_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'progress', 'done')) DEFAULT 'todo',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_user_status ON work_tasks (user_id, status);

CREATE TABLE IF NOT EXISTS work_tracker_shares (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  viewer_user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (owner_user_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_shares_viewer ON work_tracker_shares (viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_work_shares_owner ON work_tracker_shares (owner_user_id);

CREATE TABLE IF NOT EXISTS reading_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  visible_to_shared BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_items_user ON reading_items (user_id, sort_order);

CREATE TABLE IF NOT EXISTS reading_list_shares (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  viewer_user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (owner_user_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_shares_viewer ON reading_list_shares (viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_reading_shares_owner ON reading_list_shares (owner_user_id);
