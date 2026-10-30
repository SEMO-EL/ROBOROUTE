import { estimateBox, overlaps, placeLabels } from "./labels";

it("places a lone label above and to the right of its marker", () => {
  const [label] = placeLabels([{ x: 100, y: 100, text: "Beacon" }]);
  expect(label).toMatchObject({ x: 110, y: 90, anchor: "start" });
});

it("moves labels that would overlap", () => {
  const placed = placeLabels([
    { x: 100, y: 100, text: "Light the beacon" },
    { x: 150, y: 100, text: "Dock at bay B" },
  ]);
  const [a, b] = placed.map((label) => estimateBox(label));
  expect(a && b && overlaps(a, b)).toBe(false);
});
