export const MUSCLES = [
  "Chest", "Back", "Shoulder", "Bicep", "Tricep",
  "Hamstring", "Glutes", "Quads", "Calves", "Forearms", "Core",
] as const
export type Muscle = (typeof MUSCLES)[number]