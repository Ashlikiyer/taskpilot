/** Preset project colors; the backend accepts any `#rrggbb` value. */
export const PROJECT_COLORS = [
  { value: "#6366f1", name: "Indigo" },
  { value: "#0ea5e9", name: "Sky" },
  { value: "#14b8a6", name: "Teal" },
  { value: "#22c55e", name: "Green" },
  { value: "#eab308", name: "Yellow" },
  { value: "#f97316", name: "Orange" },
  { value: "#ef4444", name: "Red" },
  { value: "#ec4899", name: "Pink" },
  { value: "#64748b", name: "Slate" },
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].value;
