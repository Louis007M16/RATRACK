import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import KebabMenu from "@/components/shared/KebabMenu"
import { fromKg, roundWeight, toKg, type Unit } from "@/lib/units"
import { SET_TYPES, setLabels, type SetType } from "@/lib/sets"
import { cleanDecimal, cleanInt, validateSet, type SetErrors } from "@/lib/validation"
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

const num = (v: string) => (v.trim() === "" ? null : Number(v))

type Props = { workout: Workout; onDone: () => void }

export default function SetEditorPanel({ workout, onDone }: Props) {
  const updateSets = useWorkoutStore((s) => s.updateSets)
  const [unit, setUnit] = useState<Unit>(workout.unit)
  const [rows, setRows] = useState<Row[]>(() => toRows(workout))
  const [errors, setErrors] = useState<Record<string, SetErrors>>({})
  const [picking, setPicking] = useState(false)

  const labels = setLabels(rows)

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  // typing clears that field's error
  const edit = (id: string, field: "weight" | "reps", value: string) => {
    patch(id, { [field]: field === "weight" ? cleanDecimal(value) : cleanInt(value) })
    setErrors((e) => (e[id]?.[field] ? { ...e, [id]: { ...e[id], [field]: undefined } } : e))
  }

  const changeUnit = (next: Unit) => {
    setRows((rs) =>
      rs.map((r) => {
        const w = num(r.weight)
        if (w == null || Number.isNaN(w)) return r
        return { ...r, weight: String(roundWeight(fromKg(toKg(w, unit), next))) }
      })
    )
    setErrors({})
    setUnit(next)
  }

  const addSet = (type: SetType) => {
    const row: Row = { id: crypto.randomUUID(), type, weight: "", reps: "" }
    setRows((rs) => (type === "warmup" ? [row, ...rs] : [...rs, row]))
    setPicking(false)
  }

  const apply = () => {
    const found: Record<string, SetErrors> = {}
    for (const r of rows) {
      const e = validateSet(r.weight, r.reps, unit)
      if (e.weight || e.reps) found[r.id] = e
    }
    setErrors(found)

    const bad = rows.find((r) => found[r.id])
    if (bad) {
      // jump to the first problem so the user sees it
      const field = found[bad.id].weight ? "weight" : "reps"
      document.getElementById(`${bad.id}-${field}`)?.focus()
      return
    }

    updateSets(
      workout.id,
      unit,
      rows.map((r) => {
        const w = num(r.weight)
        const reps = num(r.reps)
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
        {rows.map((r, i) => {
          const e = errors[r.id] ?? {}
          return (
            <div key={r.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-8 shrink-0 text-center text-2xl font-semibold",
                    labels[i] === "W" || labels[i] === "D" ? "text-primary" : ""
                  )}
                >
                  {labels[i]}
                </span>
                <Input
                  id={`${r.id}-weight`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={`Weight (${unit})`}
                  aria-label={`Set ${labels[i]} weight`}
                  aria-invalid={!!e.weight}
                  aria-describedby={e.weight ? `${r.id}-weight-err` : undefined}
                  className={cn(e.weight && "border-destructive focus-visible:ring-destructive/40")}
                  value={r.weight}
                  onChange={(ev) => edit(r.id, "weight", ev.target.value)}
                />
                <Input
                  id={`${r.id}-reps`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Reps"
                  aria-label={`Set ${labels[i]} reps`}
                  aria-invalid={!!e.reps}
                  aria-describedby={e.reps ? `${r.id}-reps-err` : undefined}
                  className={cn(e.reps && "border-destructive focus-visible:ring-destructive/40")}
                  value={r.reps}
                  onChange={(ev) => edit(r.id, "reps", ev.target.value)}
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
                      onSelect: () => {
                        setRows((rs) => rs.filter((x) => x.id !== r.id))
                        setErrors((er) => {
                          const { [r.id]: _removed, ...rest } = er
                          return rest
                        })
                      },
                    },
                  ]}
                />
              </div>
              {(e.weight || e.reps) && (
                <div className="mt-1 flex gap-2 pl-10 text-xs text-destructive" role="alert">
                  {e.weight && <p id={`${r.id}-weight-err`} className="flex-1">{e.weight}</p>}
                  {e.reps && (
                    <p id={`${r.id}-reps-err`} className={cn("flex-1", !e.weight && "col-start-2")}>
                      {e.reps}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button variant="secondary" size="lg" onClick={apply}>Apply</Button>
        <Button size="lg" onClick={() => setPicking(true)}>+ Add Set</Button>
      </div>

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