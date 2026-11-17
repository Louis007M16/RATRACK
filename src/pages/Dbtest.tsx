import { useEffect, useState } from "react"
import { sql } from "@/db/client"
import { initDb } from "@/db/init"
import { seedIfEmpty } from "@/db/seed"

export default function DbTest() {
  const [out, setOut] = useState<Record<string, unknown>>({})
  const [error, setError] = useState("")

  useEffect(() => {
    ;(async () => {
      await initDb()
      const seeded = await seedIfEmpty()
      const byMuscle = await sql`
        SELECT muscle_group, COUNT(*) AS workouts
        FROM workout GROUP BY muscle_group`
      const plan = await sql`
        SELECT sd.day_of_week, sd.label, w.name, sdw.position
        FROM split_day sd
        JOIN split_day_workout sdw ON sdw.split_day_id = sd.id
        JOIN workout w ON w.id = sdw.workout_id
        ORDER BY sd.day_of_week, sdw.position`
      const lastSets = await sql`
        SELECT workout_name, set_number, weight_kg, reps
        FROM set_log ORDER BY done_at DESC, set_number`
      setOut({ seededThisLoad: seeded, byMuscle, plan, lastSets })
    })().catch((e) => setError(String(e)))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold">DB test</h1>
      {error && <p className="mt-2 text-red-600">{error}</p>}
      <pre className="mt-4 overflow-x-auto text-xs">{JSON.stringify(out, null, 2)}</pre>
    </div>
  )
}