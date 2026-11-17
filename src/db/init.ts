import { sql } from "./client"
import { SCHEMA } from "./schema"

let ready: Promise<void> | null = null

export function initDb() {
  ready ??= (async () => {
    await sql`PRAGMA foreign_keys = ON`
    for (const statement of SCHEMA) await sql(statement)
  })()
  return ready
}