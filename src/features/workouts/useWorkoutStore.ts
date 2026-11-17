import { create } from "zustand"
import type { PlannedSet, Workout } from "@/types/workout"
import type { Unit } from "@/lib/units"

const seed = (id: string, name: string, muscle: Workout["muscle"]): Workout => ({
  id, name, muscle, unit: "kg", sets: [],
})

type State = {
  workouts: Workout[]
  save: (w: Omit<Workout, "id"> & { id?: string }) => void
  updateSets: (id: string, unit: Unit, sets: PlannedSet[]) => void
  remove: (id: string) => void
}

export const useWorkoutStore = create<State>((set) => ({
  workouts: [
    seed("1", "Incline Dumbbell Press", "Chest"),
    seed("2", "Flat Barbell Press", "Chest"),
    seed("3", "Peck Deck", "Chest"),
    seed("4", "Lat Pulldown", "Back"),
    seed("5", "Cable Pullover", "Back"),
    seed("6", "Seated Cable Row", "Back"),
    seed("7", "Cable Tricep Pushdowns", "Tricep"),
    seed("8", "Overhead Extension", "Tricep"),
  ],
  save: (w) =>
    set((s) =>
      w.id
        ? { workouts: s.workouts.map((x) => (x.id === w.id ? ({ ...w, id: w.id } as Workout) : x)) }
        : { workouts: [...s.workouts, { ...w, id: crypto.randomUUID() }] }
    ),
  updateSets: (id, unit, sets) =>
    set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, unit, sets } : w)) })),
  remove: (id) => set((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) })),
}))