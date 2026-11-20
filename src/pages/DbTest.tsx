import { useCallback, useEffect, useState } from "react"
import { sql, transaction } from "@/db/client"
import { initDb } from "@/db/init"
import { seedIfEmpty, wipeAll } from "@/db/seed"

type Check = { name: string; ok: boolean; detail: string }

async function mustFail(name: string, fn: () => Promise<unknown>): Promise<Check> {
  try {
    await fn()
    return { name, ok: false, detail: "NOT blocked" }
  } catch (e) {
    return { name, ok: true, detail: `blocked: ${String(e).slice(0, 90)}` }
  }
}

export default function DbTest() {
  const [data, setData] = useState<Record<string, unknown>>({})
  const [checks, setChecks] = useState<Check[]>([])
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      await initDb()
      const seeded = await seedIfEmpty()
      const counts = await sql`
        SELECT 'workout' AS tbl, COUNT(*) AS n FROM workout
        UNION ALL SELECT 'workout_set', COUNT(*) FROM workout_set
        UNION ALL SELECT 'split', COUNT(*) FROM split
        UNION ALL SELECT 'split_day', COUNT(*) FROM split_day
        UNION ALL SELECT 'split_day_workout', COUNT(*) FROM split_day_workout
        UNION ALL SELECT 'session', COUNT(*) FROM session
        UNION ALL SELECT 'set_log', COUNT(*) FROM set_log`
      const mondayPlan = await sql`
        SELECT sd.label, w.name, sdw.position
        FROM split_day sd
        JOIN split_day_workout sdw ON sdw.split_id = sd.split_id AND sdw.day_of_week = sd.day_of_week
        JOIN workout w ON w.id = sdw.workout_id
        WHERE sd.split_id = 's1' AND sd.day_of_week = 0
        ORDER BY sdw.position`
      const lastSession = await sql`
        SELECT position, weight_kg, reps FROM set_log
        WHERE workout_id = '1' AND is_done = 1 AND set_type = 'normal'
          AND session_id = (SELECT session_id FROM set_log
                            WHERE workout_id = '1' AND is_done = 1
                            ORDER BY done_at DESC LIMIT 1)
        ORDER BY position`
      const pr = await sql`SELECT * FROM workout_pr`
      const week = await sql`
        SELECT COUNT(DISTINCT s.session_date) AS days, COUNT(l.id) AS sets,
               COALESCE(SUM(l.reps), 0) AS reps
        FROM session s JOIN set_log l ON l.session_id = s.id
        WHERE l.is_done = 1 AND l.set_type <> 'warmup'
          AND s.session_date >= date('now','localtime','weekday 0','-6 days')`
      setData({ seededThisLoad: seeded, counts, mondayPlan, lastSession, pr, week })
      setError("")
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const runChecks = async () => {
    const results: Check[] = []
    results.push(await mustFail("second active split is rejected", () =>
      sql`INSERT INTO split (id, name, is_active) VALUES ('t1', 'Another Active', 1)`))
    results.push(await mustFail("duplicate workout name is rejected (any letter case)", () =>
      sql`INSERT INTO workout (id, name, muscle_group) VALUES ('t2', 'incline dumbbell press', 'Chest')`))
    results.push(await mustFail("invalid set type is rejected", () =>
      sql`INSERT INTO workout_set (workout_id, position, set_type) VALUES ('1', 9, 'banana')`))
    results.push(await mustFail("set with 0 reps is rejected", () =>
      sql`INSERT INTO workout_set (workout_id, position, set_type, reps) VALUES ('1', 9, 'normal', 0)`))
    results.push(await mustFail("day pointing at a missing workout is rejected", () =>
      sql`INSERT INTO split_day_workout (split_id, day_of_week, position, workout_id) VALUES ('s1', 2, 1, 'nope')`))

    // deleting a split removes its days (cascade)
    await sql`DELETE FROM split WHERE id = 'tmp'`
    await sql`INSERT INTO split (id, name) VALUES ('tmp', 'Temp split')`
    await sql`INSERT INTO split_day (split_id, day_of_week, label) VALUES ('tmp', 0, 'X')`
    await sql`DELETE FROM split WHERE id = 'tmp'`
    const left = (await sql`SELECT COUNT(*) AS n FROM split_day WHERE split_id = 'tmp'`) as { n: number }[]
    results.push({ name: "deleting a split removes its days", ok: left[0].n === 0, detail: `${left[0].n} rows left` })

    // deleting a workout keeps its history
    await transaction(async (tx) => {
      await tx.sql`INSERT INTO workout (id, name, muscle_group) VALUES ('w-tmp', 'Temp Lift', 'Core')`
      await tx.sql`INSERT INTO session (id, session_date) VALUES ('s-tmp', '2000-01-01')`
      await tx.sql`INSERT INTO set_log (id, session_id, workout_id, workout_name, position, weight_kg, reps, is_done)
        VALUES ('l-tmp', 's-tmp', 'w-tmp', 'Temp Lift', 1, 10, 5, 1)`
    })
    await sql`DELETE FROM workout WHERE id = 'w-tmp'`
    const kept = (await sql`SELECT workout_id, workout_name FROM set_log WHERE id = 'l-tmp'`) as
      { workout_id: string | null; workout_name: string }[]
    results.push({
      name: "deleting a workout keeps its logged sets",
      ok: kept.length === 1 && kept[0].workout_id === null && kept[0].workout_name === "Temp Lift",
      detail: JSON.stringify(kept[0] ?? null),
    })
    await sql`DELETE FROM session WHERE id = 's-tmp'`
    setChecks(results)
  }

  const reset = async () => {
    await wipeAll()
    setChecks([])
    await load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">DB test</h1>
      {error && <p role="alert" className="mt-2 break-words text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={runChecks} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          Run rule checks
        </button>
        <button type="button" onClick={reset} className="rounded-lg border border-border px-3 py-2 text-sm">
          Wipe and reseed
        </button>
      </div>

      {checks.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {checks.map((c) => (
            <li key={c.name} className={c.ok ? "text-primary" : "text-destructive"}>
              {c.ok ? "PASS" : "FAIL"} · {c.name}
              <span className="block break-words text-xs text-muted-foreground">{c.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <pre className="mt-4 overflow-x-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}