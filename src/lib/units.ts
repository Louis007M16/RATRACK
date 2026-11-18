export type Unit = "kg" | "lbs"
const KG_PER_LB = 0.45359237

export const toKg = (v: number, unit: Unit) => (unit === "kg" ? v : v * KG_PER_LB)
export const fromKg = (kg: number, unit: Unit) => (unit === "kg" ? kg : kg / KG_PER_LB)
export const roundWeight = (n: number) => +n.toFixed(1)
export const fmtWeight = (kg: number, unit: Unit) => `${roundWeight(fromKg(kg, unit))} ${unit}`