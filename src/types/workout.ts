import type { Muscle } from "@/lib/constants"
import type { Unit } from "@/lib/units"
import type { SetType } from "@/lib/sets"

export type PlannedSet = { type: SetType; weightKg: number | null; reps: number | null }

export type Workout = {
  id: string
  name: string
  muscle: Muscle
  unit: Unit
  sets: PlannedSet[]
}