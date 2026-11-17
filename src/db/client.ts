import { SQLocal } from "sqlocal"

export const { sql, transaction } = new SQLocal("workout-tracker.sqlite3")