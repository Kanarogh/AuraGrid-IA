-- Teams RBAC: owner/member accounts, client grants, team membership

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

UPDATE users SET account_role = 'owner', must_change_password = false, status = 'active'
  WHERE account_role IS NULL OR account_role = '';

CREATE TABLE IF NOT EXISTS team_members (
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_role text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS team_members_member_idx ON team_members (member_user_id);

CREATE TABLE IF NOT EXISTS client_member_access (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sections jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS client_member_access_client_idx ON client_member_access (client_id);
