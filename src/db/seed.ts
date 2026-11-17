import { sql } from "./client"

export async function seedIfEmpty() {
  const [{ n }] = await sql`SELECT COUNT(*) AS n FROM workout`
  if (n > 0) return false

  const [incline] = await sql`INSERT INTO workout (name, muscle_group, sets, min_reps, max_reps, weight_kg, weight_step)
    VALUES ('Incline Dumbbell Press', 'Chest', 3, 6, 8, 25, 2.5) RETURNING id`
  const [peck] = await sql`INSERT INTO workout (name, muscle_group, sets, min_reps, max_reps, weight_kg, weight_step)
    VALUES ('Peck Deck', 'Chest', 3, 8, 10, 40, 2.5) RETURNING id`
  const [squat] = await sql`INSERT INTO workout (name, muscle_group, sets, min_reps, max_reps, weight_kg, weight_step)
    VALUES ('Squat', 'Quads', 4, 6, 8, 60, 5) RETURNING id`

  const [split] = await sql`INSERT INTO split (name, is_active) VALUES ('Push Pull Legs', 1) RETURNING id`
  const [push] = await sql`INSERT INTO split_day (split_id, day_of_week, label)
    VALUES (${split.id}, 0, 'Push Day') RETURNING id`
  const [legs] = await sql`INSERT INTO split_day (split_id, day_of_week, label)
    VALUES (${split.id}, 2, 'Leg Day') RETURNING id`

  await sql`INSERT INTO split_day_muscle VALUES (${push.id}, 'Chest')`
  await sql`INSERT INTO split_day_workout VALUES (${push.id}, ${incline.id}, 1)`
  await sql`INSERT INTO split_day_workout VALUES (${push.id}, ${peck.id}, 2)`
  await sql`INSERT INTO split_day_workout VALUES (${legs.id}, ${squat.id}, 1)`

  const [session] = await sql`INSERT INTO session (split_day_id, session_date)
    VALUES (${push.id}, date('now')) RETURNING id`
  for (const n of [1, 2, 3]) {
    await sql`INSERT INTO set_log (session_id, workout_id, workout_name, set_number, weight_kg, reps)
      VALUES (${session.id}, ${incline.id}, 'Incline Dumbbell Press', ${n}, 25, 8)`
  }
  return true
}