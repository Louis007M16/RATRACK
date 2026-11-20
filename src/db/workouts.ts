import { sql, transaction } from "./client"
import type { Muscle } from "@/lib/constants"
import type { Unit } from "@/lib/units"
import type { SetType } from "@/lib/sets"
import type { PlannedSet, Workout } from "@/types/workout"

type WRow = { id: string; name: string; muscle_group: string; weight_unit: string; overload_on: number; weight_step_kg: number }
type SRow = { workout_id: string; position: number; set_type: string; weight_kg: number | null; reps: number | null }

export async function loadWorkouts(): Promise<Workout[]> {
  const ws = (await sql`SELECT id, name, muscle_group, weight_unit, overload_on, weight_step_kg
    FROM workout WHERE deleted_at IS NULL ORDER BY rowid`) as WRow[]
  const ss = (await sql`SELECT workout_id, position, set_type, weight_kg, reps
    FROM workout_set ORDER BY workout_id, position`) as SRow[]

  const byWorkout = new Map<string, PlannedSet[]>()
  for (const s of ss) {
    const list = byWorkout.get(s.workout_id) ?? []
    list.push({ type: s.set_type as SetType, weightKg: s.weight_kg, reps: s.reps })
    byWorkout.set(s.workout_id, list)
  }
  return ws.map((w) => ({
    id: w.id,
    name: w.name,
    muscle: w.muscle_group as Muscle,
    unit: w.weight_unit as Unit,
    sets: byWorkout.get(w.id) ?? [],
    overload: { on: w.overload_on === 1, stepKg: w.weight_step_kg },
  }))
}

export async function writeWorkout(w: Workout) {
  await transaction(async (tx) => {
    await tx.sql`INSERT INTO workout (id, name, muscle_group, weight_unit, overload_on, weight_step_kg)
      VALUES (${w.id}, ${w.name}, ${w.muscle}, ${w.unit}, ${w.overload.on ? 1 : 0}, ${w.overload.stepKg})
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, muscle_group = excluded.muscle_group,
        weight_unit = excluded.weight_unit, overload_on = excluded.overload_on,
        weight_step_kg = excluded.weight_step_kg`
    await tx.sql`DELETE FROM workout_set WHERE workout_id = ${w.id}`
    for (const [i, s] of w.sets.entries()) {
      await tx.sql`INSERT INTO workout_set (workout_id, position, set_type, weight_kg, reps)
        VALUES (${w.id}, ${i + 1}, ${s.type}, ${s.weightKg}, ${s.reps})`
    }
  })
}

export async function deleteWorkoutRow(id: string) {
  await sql`DELETE FROM workout WHERE id = ${id}`
}