export type Selection =
  | { kind: "mission"; id: string }
  | { kind: "obstacle"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "start" }
  | null;
