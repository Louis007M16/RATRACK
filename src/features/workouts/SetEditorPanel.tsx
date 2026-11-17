import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import KebabMenu from "@/components/shared/KebabMenu"
import { fromKg, roundWeight, toKg, type Unit } from "@/lib/units"
import { SET_TYPES, setLabels, type SetType } from "@/lib/sets"
import { cn } from "@/lib/utils"
import { useWorkoutStore } from "./useWorkoutStore"
import type { Workout } from "@/types/workout"

type Row = { id: string; type: SetType; weight: string; reps: string }

const toRows = (w: Workout): Row[] =>
  w.sets.map((s) => ({
    id: crypto.randomUUID(),
    type: s.type,
    weight: s.weightKg == null ? "" : String(roundWeight(fromKg(s.weightKg, w.unit))),
    reps: s.reps == null ? "" : String(s.reps),
  }))

const parse = (v: string) => {
  const n = Number(v)
  return v.trim() === "" || Number.isNaN(n) ? null : Math.max(0, n)
}

type Props = { workout: Workout; onDone: () => void }

export default function SetEditorPanel({ workout, onDone }: Props) {
  const updateSets = useWorkoutStore((s) => s.updateSets)
  const [unit, setUnit] = useState<Unit>(workout.unit)
  const [rows, setRows] = useState<Row[]>(() => toRows(workout))
  const [picking, setPicking] = useState(false)

  const labels = setLabels(rows)
  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const changeUnit = (next: Unit) => {
    setRows((rs) =>
      rs.map((r) => {
        const w = parse(r.weight)
        return w == null ? r : { ...r, weight: String(roundWeight(fromKg(toKg(w, unit), next))) }
      })
    )
    setUnit(next)
  }

  const addSet = (type: SetType) => {
    const row: Row = { id: crypto.randomUUID(), type, weight: "", reps: "" }
    // warm-ups go to the top, like W above 1, 2, 3 in your design
    setRows((rs) => (type === "warmup" ? [row, ...rs] : [...rs, row]))
    setPicking(false)
  }

  const apply = () => {
    updateSets(
      workout.id,
      unit,
      rows.map((r) => {
        const w = parse(r.weight)
        const reps = parse(r.reps)
        return {
          type: r.type,
          weightKg: w == null ? null : toKg(w, unit),
          reps: reps == null ? null : Math.round(reps),
        }
      })
    )
    onDone()
  }

  return (
    <div className="px-4 pb-4">
      <div role="group" aria-label="Weight unit" className="inline-flex rounded-full bg-secondary p-1">
        {(["kg", "lbs"] as const).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => changeUnit(u)}
            className={cn(
              "rounded-full px-4 py-1 text-sm",
              unit === u ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {u === "kg" ? "Kg" : "Lbs"}
          </button>
        ))}
      </div>

      <div className="mt-1 divide-y divide-border">
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No sets yet. Tap + Add Set.</p>
        )}
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2 py-2.5">
            <span
              className={cn(
                "w-8 shrink-0 text-center text-2xl font-semibold",
                labels[i] === "W" || labels[i] === "D" ? "text-primary" : ""
              )}
            >
              {labels[i]}
            </span>
            <Input
              inputMode="decimal"
              placeholder={`Weight (${unit})`}
              aria-label={`Set ${labels[i]} weight`}
              value={r.weight}
              onChange={(e) => patch(r.id, { weight: e.target.value })}
            />
            <Input
              inputMode="numeric"
              placeholder="Reps"
              aria-label={`Set ${labels[i]} reps`}
              value={r.reps}
              onChange={(e) => patch(r.id, { reps: e.target.value })}
            />
            <KebabMenu
              label={`Options for set ${labels[i]}`}
              items={[
                ...SET_TYPES.filter((t) => t.type !== r.type).map((t) => ({
                  label: `Make ${t.label}`,
                  onSelect: () => patch(r.id, { type: t.type }),
                })),
                {
                  label: "Remove set",
                  destructive: true,
                  onSelect: () => setRows((rs) => rs.filter((x) => x.id !== r.id)),
                },
              ]}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button variant="secondary" size="lg" onClick={apply}>Apply</Button>
        <Button size="lg" onClick={() => setPicking(true)}>+ Add Set</Button>
      </div>

      {/* Select Set: bottom sheet, drag down to close */}
      <Drawer open={picking} onOpenChange={setPicking}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="px-5 pb-2 pt-3">
            <DrawerTitle className="text-center text-lg">Select Set</DrawerTitle>
          </DrawerHeader>
          <ul className="mx-5 mb-8 divide-y divide-border rounded-2xl border border-border bg-card">
            {SET_TYPES.map((t) => (
              <li key={t.type}>
                <button
                  type="button"
                  onClick={() => addSet(t.type)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left"
                >
                  <span className="w-6 text-center font-bold text-primary">{t.badge}</span>
                  <span>{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  )
}