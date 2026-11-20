import { sql, transaction } from "./client"

type DaySeed = [label: string, isRest: boolean, muscles: string[], workoutIds: string[]]
const rest: DaySeed = ["Rest Day", true, [], []]
const empty: DaySeed = ["", false, [], []]

const WORKOUTS: [string, string, string][] = [
  ["1", "Incline Dumbbell Press", "Chest"],
  ["2", "Flat Barbell Press", "Chest"],
  ["3", "Peck Deck", "Chest"],
  ["4", "Lat Pulldown", "Back"],
  ["5", "Cable Pullover", "Back"],
  ["6", "Seated Cable Row", "Back"],
  ["7", "Cable Tricep Pushdowns", "Tricep"],
  ["8", "Overhead Extension", "Tricep"],
]

const SPLITS: { id: string; name: string; kind: "preset" | "custom"; active: number; days: DaySeed[] }[] = [
  {
    id: "s1", name: "Push Pull Legs", kind: "preset", active: 1,
    days: [
      ["Push Day", false, ["Chest", "Shoulder", "Tricep"], ["1", "2", "3", "7", "8"]],
      ["Pull Day", false, ["Back"], ["4", "5", "6"]],
      ["Leg Day", false, ["Quads", "Hamstring"], []],
      rest,
      ["Push Day", false, ["Chest", "Shoulder", "Tricep"], ["1", "2"]],
      ["Pull Day", false, ["Back"], ["4"]],
      ["Leg Day", false, ["Quads", "Hamstring"], []],
    ],
  },
  {
    id: "s2", name: "Push Pull Legs Upper/Lower", kind: "preset", active: 0,
    days: [
      ["Upper", false, ["Chest", "Back"], ["1", "4"]],
      ["Lower", false, ["Quads", "Hamstring"], []],
      rest,
      ["Upper", false, ["Chest", "Back"], ["2", "5"]],
      ["Lower", false, ["Quads", "Hamstring"], []],
      rest,
      rest,
    ],
  },
  {
    id: "s3", name: "Bro Split", kind: "custom", active: 0,
    days: [
      ["Chest Day", false, ["Chest"], ["1", "2", "3"]],
      ["Back Day", false, ["Back"], ["4", "5", "6"]],
      ["Arm Day", false, ["Tricep"], ["7", "8"]],
      rest, empty, empty, empty,
    ],
  },
]

export async function seedIfEmpty() {
  const rows = (await sql`SELECT COUNT(*) AS n FROM workout`) as { n: number }[]
  if (rows[0].n > 0) return false

  await transaction(async (tx) => {
    for (const [id, name, muscle] of WORKOUTS) {
      await tx.sql`INSERT INTO workout (id, name, muscle_group) VALUES (${id}, ${name}, ${muscle})`
      for (const position of [1, 2, 3]) {
        await tx.sql`INSERT INTO workout_set (workout_id, position, set_type, weight_kg, reps)
          VALUES (${id}, ${position}, 'normal', 20, 8)`
      }
    }

    for (const s of SPLITS) {
      await tx.sql`INSERT INTO split (id, name, kind, is_active)
        VALUES (${s.id}, ${s.name}, ${s.kind}, ${s.active})`
      for (const [dow, [label, isRest, muscles, workoutIds]] of s.days.entries()) {
        await tx.sql`INSERT INTO split_day (split_id, day_of_week, label, is_rest)
          VALUES (${s.id}, ${dow}, ${label}, ${isRest ? 1 : 0})`
        for (const m of muscles) {
          await tx.sql`INSERT INTO split_day_muscle (split_id, day_of_week, muscle)
            VALUES (${s.id}, ${dow}, ${m})`
        }
        for (const [i, wid] of workoutIds.entries()) {
          await tx.sql`INSERT INTO split_day_workout (split_id, day_of_week, position, workout_id)
            VALUES (${s.id}, ${dow}, ${i + 1}, ${wid})`
        }
      }
    }

    // yesterday's finished Incline Dumbbell Press, so overload has history to read
    await tx.sql`INSERT INTO session (id, session_date, split_id, day_label)
      VALUES ('seed-session', date('now','localtime','-1 day'), 's1', 'Push Day')`
    for (const position of [1, 2, 3]) {
      await tx.sql`INSERT INTO set_log
        (id, session_id, workout_id, workout_name, position, set_type, weight_kg, reps, is_done, done_at)
        VALUES (${crypto.randomUUID()}, 'seed-session', '1', 'Incline Dumbbell Press',
                ${position}, 'normal', 25, 8, 1, datetime('now'))`
    }
  })
  return true
}

export async function wipeAll() {
  await transaction(async (tx) => {
    for (const t of [
      "set_log", "session", "split_day_workout", "split_day_muscle",
      "split_day", "split", "workout_set", "workout",
    ]) await tx.sql(`DELETE FROM ${t}`)
  })
}