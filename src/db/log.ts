import { sql, transaction } from "./client"
import type { LogSet } from "@/types/log"
import type { SetType } from "@/lib/sets"

type PerfRow = { weightKg: number; reps: number }
export type LoadedLog = {
  sessions: Record<string, Record<string, LogSet[]>>
  history: Record<string, PerfRow[]>
  prs: Record<string, number>
}

// the most recent session in which EVERY set of this workout was finished, plus the PR
export async function loadDerived(workoutId: string): Promise<{ history?: PerfRow[]; pr?: number }> {
  const rows = (await sql`
    SELECT l.weight_kg AS w, l.reps AS r FROM set_log l
    WHERE l.workout_id = ${workoutId} AND l.set_type = 'normal' AND l.is_done = 1
      AND l.weight_kg IS NOT NULL AND l.reps IS NOT NULL
      AND l.session_id = (
        SELECT s.id FROM session s JOIN set_log x ON x.session_id = s.id
        WHERE x.workout_id = ${workoutId}
        GROUP BY s.id HAVING MIN(x.is_done) = 1
        ORDER BY s.session_date DESC LIMIT 1)
    ORDER BY l.position`) as { w: number; r: number }[]
  const pr = (await sql`SELECT pr_kg FROM workout_pr WHERE workout_id = ${workoutId}`) as { pr_kg: number | null }[]
  return {
    history: rows.length ? rows.map((x) => ({ weightKg: x.w, reps: x.r })) : undefined,
    pr: pr[0]?.pr_kg ?? undefined,
  }
}

export async function loadLog(workoutIds: string[], from: string, to: string): Promise<LoadedLog> {
  const rows = (await sql`
    SELECT s.session_date AS date, l.id AS id, l.workout_id AS wid, l.set_type AS type,
           l.weight_kg AS w, l.reps AS r, l.is_done AS done
    FROM session s JOIN set_log l ON l.session_id = s.id
    WHERE s.session_date BETWEEN ${from} AND ${to} AND l.workout_id IS NOT NULL
    ORDER BY s.session_date, l.workout_id, l.position`) as
    { date: string; id: string; wid: string; type: string; w: number | null; r: number | null; done: number }[]

  const sessions: LoadedLog["sessions"] = {}
  for (const x of rows) {
    const day = (sessions[x.date] ??= {})
    ;(day[x.wid] ??= []).push({ id: x.id, type: x.type as SetType, weightKg: x.w, reps: x.r, done: x.done === 1 })
  }

  const history: LoadedLog["history"] = {}
  const prs: LoadedLog["prs"] = {}
  for (const id of workoutIds) {
    const d = await loadDerived(id)
    if (d.history) history[id] = d.history
    if (d.pr != null) prs[id] = d.pr
  }
  return { sessions, history, prs }
}

export async function insertSets(
  date: string,
  ctx: { splitId: string | null; dayLabel: string },
  w: { id: string; name: string },
  sets: LogSet[]
) {
  await transaction(async (tx) => {
    await tx.sql`INSERT OR IGNORE INTO session (id, session_date, split_id, day_label)
      VALUES (${`sess-${date}`}, ${date}, ${ctx.splitId}, ${ctx.dayLabel})`
    const found = (await tx.sql`SELECT id FROM session WHERE session_date = ${date}`) as { id: string }[]
    const sid = found[0].id
    for (const [i, s] of sets.entries()) {
      await tx.sql`INSERT OR IGNORE INTO set_log
        (id, session_id, workout_id, workout_name, position, set_type, weight_kg, reps, is_done)
        VALUES (${s.id}, ${sid}, ${w.id}, ${w.name}, ${i + 1}, ${s.type}, ${s.weightKg}, ${s.reps}, ${s.done ? 1 : 0})`
    }
  })
}

export async function setDoneRow(id: string, done: boolean) {
  await sql`UPDATE set_log SET is_done = ${done ? 1 : 0},
    done_at = CASE WHEN ${done ? 1 : 0} = 1 THEN datetime('now') ELSE NULL END WHERE id = ${id}`
}

export async function setAllDoneRows(date: string, workoutId: string, done: boolean) {
  await sql`UPDATE set_log SET is_done = ${done ? 1 : 0},
    done_at = CASE WHEN ${done ? 1 : 0} = 1 THEN datetime('now') ELSE NULL END
    WHERE workout_id = ${workoutId}
      AND session_id = (SELECT id FROM session WHERE session_date = ${date})`
}

export async function setWeightRows(date: string, workoutId: string, weightKg: number) {
  await sql`UPDATE set_log SET weight_kg = ${weightKg}
    WHERE workout_id = ${workoutId} AND set_type = 'normal' AND is_done = 0
      AND session_id = (SELECT id FROM session WHERE session_date = ${date})`
}

export async function resetRows(date: string, workoutIds: string[]) {
  for (const id of workoutIds) await setAllDoneRows(date, id, false)
}