"""A logically infinite tape stored sparsely (only non-blank cells are kept)."""
from __future__ import annotations

from typing import Dict, Optional, Tuple


class Tape:
    def __init__(self, blank: str = "_", contents: str = ""):
        self.blank = blank
        self._cells: Dict[int, str] = {}
        for index, symbol in enumerate(contents):
            self.write(index, symbol)

    def read(self, position: int) -> str:
        return self._cells.get(position, self.blank)

    def write(self, position: int, symbol: str) -> None:
        if symbol == self.blank:
            self._cells.pop(position, None)
        else:
            self._cells[position] = symbol

    def bounds(self) -> Optional[Tuple[int, int]]:
        """(leftmost, rightmost) non-blank index, or None for an empty tape."""
        if not self._cells:
            return None
        return min(self._cells), max(self._cells)

    def contents(self) -> str:
        """Non-blank region of the tape as a string (inner blanks are kept)."""
        b = self.bounds()
        if b is None:
            return ""
        return "".join(self.read(i) for i in range(b[0], b[1] + 1))

    def count_non_blank(self) -> int:
        return len(self._cells)