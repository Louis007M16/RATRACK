import type { Overload, Workout } from "@/types/workout"
export type { Overload }

export type Perf = { weightKg: number; reps: number }
export type Suggestion = { weightKg: number; reps: number; increase: boolean; message: string }

// target = the reps planned for the workout's normal sets
export function targetReps(w: Pick<Workout, "sets">): number | null {
  const reps = w.sets.filter((s) => s.type === "normal" && s.reps != null).map((s) => s.reps as number)
  return reps.length ? Math.max(...reps) : null
}

export function suggestNext(last: Perf[] | undefined, target: number | null, o: Overload): Suggestion | null {
  if (!o.on || !last || last.length === 0 || target == null) return null
  const top = Math.max(...last.map((s) => s.weightKg))

  if (last.every((s) => s.reps >= target)) {
    return {
      weightKg: top + o.stepKg,
      reps: target,
      increase: true,
      message: `You hit ${target} reps on every set. Add weight.`,
    }
  }
  return {
    weightKg: top,
    reps: target,
    increase: false,
    message: `Keep the weight and hit ${target} reps on every set.`,
  }
}