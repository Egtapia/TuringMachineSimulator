"""Step-by-step execution engine for a :class:`MachineDefinition`."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable, List, Optional

from .definition import MachineDefinition, Transition
from .tape import Tape


class Status(str, Enum):
    READY = "ready"                  # nothing executed yet
    RUNNING = "running"
    ACCEPTED = "accepted"            # reached q_accept
    REJECTED = "rejected"            # reached q_reject
    NO_TRANSITION = "no_transition"  # delta undefined -> implicit rejection
    MAX_STEPS = "max_steps"          # N_max reached (possible infinite loop)


HALTED = (Status.ACCEPTED, Status.REJECTED, Status.NO_TRANSITION, Status.MAX_STEPS)


@dataclass(frozen=True)
class StepRecord:
    step: int
    state_before: str
    state_after: str
    read: str
    write: str
    move: str
    head_before: int
    head_after: int
    transition: Transition


class Simulator:
    """Executes one machine on one input, one transition at a time."""

    def __init__(self, definition: MachineDefinition, input_string: str,
                 max_steps: int = 10_000, keep_history: bool = True):
        if not isinstance(max_steps, int) or max_steps < 1:
            raise ValueError("max_steps (N_max) must be a positive integer.")
        definition.check_input(input_string)         # raises InputError
        self.definition = definition
        self.input_string = input_string
        self.max_steps = max_steps
        self.keep_history = keep_history
        self.reset()

    # ------------------------------------------------------------------ state
    def reset(self) -> None:
        d = self.definition
        self.tape = Tape(d.blank, self.input_string)
        self.head = 0
        self.state = d.start_state
        self.steps = 0
        self.status = Status.READY
        self.message = ""
        self.history: List[StepRecord] = []
        self._check_halting()

    @property
    def halted(self) -> bool:
        return self.status in HALTED

    @property
    def current_symbol(self) -> str:
        return self.tape.read(self.head)

    def _check_halting(self) -> None:
        d = self.definition
        if self.state == d.accept_state:
            self.status, self.message = Status.ACCEPTED, f"Halted in accept state {self.state}."
        elif self.state == d.reject_state:
            self.status, self.message = Status.REJECTED, f"Halted in reject state {self.state}."
        elif self.steps >= self.max_steps:
            self.status = Status.MAX_STEPS
            self.message = (f"Step limit N_max = {self.max_steps} reached "
                            "- the machine may not terminate.")

    # -------------------------------------------------------------- execution
    def step(self) -> Optional[StepRecord]:
        """Apply one transition. Returns None if the machine has halted."""
        if self.halted:
            return None
        symbol = self.tape.read(self.head)
        t = self.definition.get_transition(self.state, symbol)
        if t is None:
            self.status = Status.NO_TRANSITION
            self.message = (f"No transition defined for δ({self.state}, {symbol}) "
                            "- implicit rejection.")
            return None

        head_before, state_before = self.head, self.state
        self.tape.write(self.head, t.write)
        self.head += {"L": -1, "R": 1, "S": 0}[t.move]
        self.state = t.next_state
        self.steps += 1
        self.status = Status.RUNNING
        record = StepRecord(self.steps, state_before, self.state, symbol, t.write,
                            t.move, head_before, self.head, t)
        if self.keep_history:
            self.history.append(record)
        self._check_halting()
        return record

    def run(self, on_step: Optional[Callable[[StepRecord], None]] = None) -> Status:
        """Run until the machine halts or N_max is hit."""
        while not self.halted:
            record = self.step()
            if record is not None and on_step is not None:
                on_step(record)
        return self.status

    # ------------------------------------------------------------------ report
    def state_sequence(self) -> List[str]:
        seq = [self.definition.start_state]
        seq.extend(r.state_after for r in self.history)
        return seq