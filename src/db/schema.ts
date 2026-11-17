export const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS workout (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        muscle_group TEXT NOT NULL,
        sets INTEGER NOT NULL DEFAULT 3,
        reps INTEGER NOT NULL DEFAULT 8,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
    )`,
]