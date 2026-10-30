import { formatAngle, formatLength, formatSeconds } from "./units";

describe("display formatting", () => {
  it("shows lengths in centimetres", () => {
    expect(formatLength(1.2)).toBe("120.0 cm");
    expect(formatLength(0.125)).toBe("12.5 cm");
  });

  it("shows angles in degrees, counter-clockwise from +x", () => {
    expect(formatAngle(Math.PI / 2)).toBe("90°");
    expect(formatAngle(-Math.PI / 2)).toBe("−90°");
  });

  it("shows durations in seconds", () => {
    expect(formatSeconds(120)).toBe("120 s");
    expect(formatSeconds(4.25)).toBe("4.3 s");
  });
});
