export type Overload = { on: boolean; minReps: number; maxReps: number; stepKg: number }
export const defaultOverload: Overload = { on: true, minReps: 8, maxReps: 12, stepKg: 2.5 }

export type Perf = { weightKg: number; reps: number }
export type Suggestion = { weightKg: number; reps: number; increase: boolean; message: string }

export function suggestNext(last: Perf[] | undefined, o: Overload): Suggestion | null {
  if (!o.on || !last || last.length === 0) return null
  const top = Math.max(...last.map((s) => s.weightKg))

  if (last.every((s) => s.reps >= o.maxReps)) {
    return {
      weightKg: top + o.stepKg,
      reps: o.minReps,
      increase: true,
      message: `You hit ${o.maxReps} reps on every set. Add weight.`,
    }
  }
  const lowest = Math.min(...last.map((s) => s.reps))
  return {
    weightKg: top,
    reps: Math.min(o.maxReps, Math.max(o.minReps, lowest + 1)),
    increase: false,
    message: "Keep the weight and add a rep.",
  }
}