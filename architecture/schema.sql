-- Future server schema (SQLite / D1). Not connected to the local MVP.
-- owner_id comes ONLY from verified server identity, never request JSON.
PRAGMA foreign_keys = ON;
CREATE TABLE profiles (
 owner_id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '',
 story TEXT NOT NULL DEFAULT '', goals TEXT NOT NULL DEFAULT '',
 support_style TEXT NOT NULL DEFAULT 'gentle' CHECK(support_style IN ('gentle','playful','direct')),
 memory TEXT NOT NULL DEFAULT '', memory_consent INTEGER NOT NULL DEFAULT 0,
 ai_consent_at TEXT, revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE directions (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, name TEXT NOT NULL, why_text TEXT NOT NULL DEFAULT '',
 position INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_id,id)
);
CREATE TABLE tasks (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, direction_id TEXT, title TEXT NOT NULL,
 bucket TEXT NOT NULL CHECK(bucket IN ('soon','someday')), selected_date TEXT,
 done INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_id,id),
 FOREIGN KEY(owner_id,direction_id) REFERENCES directions(owner_id,id)
);
CREATE TABLE habits (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, direction_id TEXT, title TEXT NOT NULL,
 target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 7),
 PRIMARY KEY(owner_id,id),
 FOREIGN KEY(owner_id,direction_id) REFERENCES directions(owner_id,id)
);
CREATE TABLE habit_marks (
 owner_id TEXT NOT NULL, habit_id TEXT NOT NULL, local_date TEXT NOT NULL,
 PRIMARY KEY(owner_id,habit_id,local_date),
 FOREIGN KEY(owner_id,habit_id) REFERENCES habits(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE inspiration (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('photo','note')),
 text TEXT NOT NULL DEFAULT '', private_object_key TEXT,
 PRIMARY KEY(owner_id,id)
);
CREATE TABLE conversations (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(owner_id,id)
);
CREATE TABLE messages (
 owner_id TEXT NOT NULL, conversation_id TEXT NOT NULL, id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')), text TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(owner_id,id),
 FOREIGN KEY(owner_id,conversation_id) REFERENCES conversations(owner_id,id) ON DELETE CASCADE
);
-- Planned additions for the full «тише.» server release.
CREATE TABLE someday_ideas (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 why_text TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE TABLE milestones (
 owner_id TEXT NOT NULL REFERENCES profiles(owner_id) ON DELETE CASCADE,
 id TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 local_date TEXT NOT NULL, PRIMARY KEY(owner_id,id)
);
-- Field stages are calculated from owner-scoped completed tasks and habit marks.
-- Missed days never subtract progress; there is no global leaderboard.
