"""CSV export with protection against spreadsheet formula injection.

Spreadsheet programs execute a cell whose text starts with ``=``, ``+``, ``-`` or ``@`` (and some
also treat a leading tab or carriage return specially). User-provided text — plan labels, mission
names — is therefore prefixed with an apostrophe when it starts with one of these characters.
Numbers are written by the program itself and left untouched (a negative score is legitimate).
"""

import csv
import io
from collections.abc import Iterable, Sequence

DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_cell(text: str) -> str:
    return f"'{text}" if text.startswith(DANGEROUS_PREFIXES) else text


def to_csv(header: Sequence[str], rows: Iterable[Sequence[str | int | float | bool]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow([sanitize_cell(h) for h in header])
    for row in rows:
        writer.writerow(
            [sanitize_cell(cell) if isinstance(cell, str) else _number(cell) for cell in row]
        )
    return buffer.getvalue()


def _number(value: int | float | bool) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, float):
        return repr(round(value, 6))
    return str(value)
