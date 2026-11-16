-- ===========================================================================
-- ORBIT Olympiad — Supabase / PostgreSQL setup
-- ---------------------------------------------------------------------------
-- You normally do NOT need to run this by hand: the app creates its own schema
-- on boot (`CREATE TABLE IF NOT EXISTS`). Use this file when you want to:
--   * provision the tables ahead of time from the Supabase SQL editor, or
--   * review the schema in one readable place.
--
-- Then set in your environment:
--   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
--   DATABASE_SSL=true
--
-- Make sure DATABASE_URL uses the **connection pooler** (port 6543) for
-- serverless hosting such as Vercel, and a strong database password.
--
-- Security model: the browser never talks to this database. Only the Node
-- server connects, using SQL over a private connection string. Sessions are
-- HttpOnly cookies; passwords are scrypt hashes. Row Level Security is therefore
-- intentionally not used — do not expose these tables through the Supabase
-- anon key, and keep the service_role key out of the frontend (this app never
-- loads it at all).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL,
  name          text NOT NULL DEFAULT 'Organizer',
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users (lower(email));

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  symbol     text NOT NULL DEFAULT '◇',
  summary    text NOT NULL DEFAULT '',
  details    text NOT NULL DEFAULT '',
  rules      text NOT NULL DEFAULT '',
  accent     text NOT NULL DEFAULT '',
  image_url  text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id             uuid PRIMARY KEY,
  title          text NOT NULL,
  slug           text NOT NULL,
  label          text NOT NULL DEFAULT 'Journal',
  excerpt        text NOT NULL DEFAULT '',
  body           text NOT NULL DEFAULT '',
  image_url      text NOT NULL DEFAULT '',
  read_minutes   integer NOT NULL DEFAULT 4,
  is_published   boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_key ON articles (slug);

CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  level      text NOT NULL DEFAULT 'info',
  link_label text NOT NULL DEFAULT '',
  link_url   text NOT NULL DEFAULT '',
  is_active  boolean NOT NULL DEFAULT true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_active_idx ON announcements (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS faqs (
  id         uuid PRIMARY KEY,
  question   text NOT NULL,
  answer     text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id            uuid PRIMARY KEY,
  name          text NOT NULL,
  school        text NOT NULL,
  category_id   text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  max_members   integer NOT NULL DEFAULT 4 CHECK (max_members BETWEEN 2 AND 8),
  passcode_hash text NOT NULL,
  leader_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_school_name_key ON teams (lower(school), lower(name));
CREATE INDEX IF NOT EXISTS teams_category_idx ON teams (category_id);

CREATE TABLE IF NOT EXISTS students (
  id            uuid PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  class_name    text NOT NULL DEFAULT '',
  school        text NOT NULL,
  phone         text NOT NULL DEFAULT '',
  category_id   text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  team_id       uuid REFERENCES teams(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'confirmed',
  project_title text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'member',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON students (lower(email));
CREATE INDEX IF NOT EXISTS students_team_idx ON students (team_id);
CREATE INDEX IF NOT EXISTS students_category_idx ON students (category_id);

CREATE TABLE IF NOT EXISTS category_requests (
  id            uuid PRIMARY KEY,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_category text NOT NULL,
  to_category   text NOT NULL,
  reason        text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending',
  admin_note    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX IF NOT EXISTS category_requests_status_idx ON category_requests (status);

CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  admin_id   uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'student',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS assets (
  id         uuid PRIMARY KEY,
  mime       text NOT NULL,
  size       integer NOT NULL,
  data       bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY,
  actor_kind text NOT NULL,
  actor_id   text NOT NULL DEFAULT '',
  action     text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at DESC);
