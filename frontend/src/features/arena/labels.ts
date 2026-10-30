/**
 * Greedy label placement for mission markers: try four positions around each marker and keep the
 * first one that does not overlap an already placed label. Text width is estimated from the
 * character count (12 px font), which is good enough to avoid collisions without measuring DOM.
 */

export interface LabelRequest {
  x: number;
  y: number;
  text: string;
}

export interface PlacedLabel extends LabelRequest {
  anchor: "start" | "end";
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const CHAR_WIDTH = 6.6;
const HEIGHT = 14;
const OFFSET = 10;

export function estimateBox(label: PlacedLabel): Box {
  const width = label.text.length * CHAR_WIDTH;
  const left = label.anchor === "start" ? label.x : label.x - width;
  return { left, right: left + width, top: label.y - HEIGHT + 3, bottom: label.y + 3 };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function placeLabels(requests: readonly LabelRequest[]): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [];
  for (const { x, y, text } of requests) {
    const options: PlacedLabel[] = [
      { x: x + OFFSET, y: y - OFFSET, text, anchor: "start" },
      { x: x + OFFSET, y: y + OFFSET + HEIGHT - 2, text, anchor: "start" },
      { x: x - OFFSET, y: y - OFFSET, text, anchor: "end" },
      { x: x - OFFSET, y: y + OFFSET + HEIGHT - 2, text, anchor: "end" },
    ];
    const [first] = options as [PlacedLabel, ...PlacedLabel[]];
    const choice =
      options.find((option) => boxes.every((box) => !overlaps(estimateBox(option), box))) ?? first;
    placed.push(choice);
    boxes.push(estimateBox(choice));
  }
  return placed;
}
