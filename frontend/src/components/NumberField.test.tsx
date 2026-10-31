import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NumberField } from "./NumberField";

function setup(onCommit = vi.fn()) {
  render(
    <NumberField label="Width" value={0.2} unit="cm" min={0.1} max={2000} onCommit={onCommit} />,
  );
  return { input: screen.getByLabelText("Width (cm)"), onCommit };
}

describe("NumberField", () => {
  it("shows SI values in display units", () => {
    const { input } = setup();
    expect(input).toHaveValue("20");
  });

  it("commits converted values on Enter", async () => {
    const { input, onCommit } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, "35.5{Enter}");
    expect(onCommit).toHaveBeenCalledWith(0.355);
  });

  it.each(["", "abc", "-5", "0"])("never commits an invalid entry (%j)", async (text) => {
    const { input, onCommit } = setup();
    await userEvent.clear(input);
    if (text) await userEvent.type(input, text);
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("converts degrees to radians", async () => {
    const onCommit = vi.fn();
    render(<NumberField label="Heading" value={0} unit="deg" onCommit={onCommit} />);
    const input = screen.getByLabelText("Heading (°)");
    await userEvent.clear(input);
    await userEvent.type(input, "90{Enter}");
    expect(onCommit.mock.calls[0]?.[0]).toBeCloseTo(Math.PI / 2);
  });
});
