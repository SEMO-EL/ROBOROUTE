import { SCENARIO_A } from "@/test/fixtures";

import { useProjectStore } from "./project";

const renamed = (name: string) => ({ ...SCENARIO_A, name });

describe("project history", () => {
  beforeEach(() => {
    useProjectStore.setState({
      ...useProjectStore.getInitialState(),
      scenario: SCENARIO_A,
      status: "ready",
    });
  });

  it("undoes and redoes edits", () => {
    const store = useProjectStore.getState();
    store.edit(renamed("one"));
    store.edit(renamed("two"));
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().scenario?.name).toBe("one");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().scenario?.name).toBe(SCENARIO_A.name);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().scenario?.name).toBe("one");
  });

  it("forgets the redo branch after a new edit", () => {
    const store = useProjectStore.getState();
    store.edit(renamed("one"));
    useProjectStore.getState().undo();
    useProjectStore.getState().edit(renamed("other"));
    expect(useProjectStore.getState().future).toHaveLength(0);
  });

  it("records a whole drag as one undo step", () => {
    const before = useProjectStore.getState().scenario;
    if (!before) throw new Error("no scenario");
    for (const name of ["a", "b", "c"]) useProjectStore.getState().preview(renamed(name));
    useProjectStore.getState().commit(before);
    expect(useProjectStore.getState().past).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().scenario?.name).toBe(SCENARIO_A.name);
  });

  it("ignores a drag that changed nothing", () => {
    const before = useProjectStore.getState().scenario;
    if (!before) throw new Error("no scenario");
    useProjectStore.getState().commit(before);
    expect(useProjectStore.getState().past).toHaveLength(0);
  });

  it("keeps at most 100 steps", () => {
    for (let i = 0; i < 120; i += 1) useProjectStore.getState().edit(renamed(`v${i}`));
    expect(useProjectStore.getState().past).toHaveLength(100);
  });

  it("starts a fresh history when another scenario is loaded", () => {
    useProjectStore.getState().edit(renamed("one"));
    useProjectStore.getState().replace(SCENARIO_A);
    expect(useProjectStore.getState().past).toHaveLength(0);
  });
});
