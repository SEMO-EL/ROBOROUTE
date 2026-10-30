"""Optional instrumentation of search algorithms for the educational mode.

The algorithms call the tracer from the same code path that computes the result, so a replayed
trace always describes what actually happened. Passing ``tracer=None`` costs one ``is None``
check per event.
"""

from dataclasses import dataclass, field
from typing import Literal, Protocol

Cell = tuple[int, int]


class Tracer(Protocol):
    def on_expand(self, cell: Cell, g: float, h: float, f: float) -> None: ...

    def on_push(self, cell: Cell, parent: Cell, g: float, h: float, f: float) -> None: ...


@dataclass(frozen=True)
class TraceEvent:
    kind: Literal["expand", "push"]
    cell: Cell
    parent: Cell | None
    g: float
    h: float
    f: float


@dataclass
class RecordingTracer:
    """Keeps the first ``max_events`` events; ``truncated`` tells whether any were dropped."""

    max_events: int = 50_000
    events: list[TraceEvent] = field(default_factory=list)
    truncated: bool = False

    def _record(self, event: TraceEvent) -> None:
        if len(self.events) < self.max_events:
            self.events.append(event)
        else:
            self.truncated = True

    def on_expand(self, cell: Cell, g: float, h: float, f: float) -> None:
        self._record(TraceEvent("expand", cell, None, g, h, f))

    def on_push(self, cell: Cell, parent: Cell, g: float, h: float, f: float) -> None:
        self._record(TraceEvent("push", cell, parent, g, h, f))
