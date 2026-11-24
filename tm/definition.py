"""Formal definition of a deterministic Turing machine.

    M = (Q, Sigma, Gamma, delta, q0, q_accept, q_reject)

This module only describes *what a machine is* and validates it. Running a
machine is the job of :mod:`tm.simulator`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

MOVES = ("L", "R", "S")


class ConfigError(ValueError):
    """The machine definition is invalid. `errors` lists every problem found."""

    def __init__(self, errors: List[str]):
        self.errors = list(errors)
        super().__init__("Invalid machine definition:\n  - " + "\n  - ".join(self.errors))


class InputError(ValueError):
    """The input string contains symbols that are not in the input alphabet."""


@dataclass(frozen=True)
class Transition:
    """delta(state, read) -> (next_state, write, move)."""

    state: str
    read: str
    next_state: str
    write: str
    move: str

    def __str__(self) -> str:
        return f"δ({self.state}, {self.read}) → ({self.next_state}, {self.write}, {self.move})"


@dataclass
class MachineDefinition:
    name: str
    states: List[str]                      # Q
    input_alphabet: List[str]              # Sigma
    tape_alphabet: List[str]               # Gamma
    blank: str
    start_state: str                       # q0
    accept_state: str                      # q_accept
    reject_state: str                      # q_reject
    transitions: Dict[Tuple[str, str], Transition]   # delta

    # ------------------------------------------------------------------ build
    @classmethod
    def from_dict(cls, data: dict, name: str = "Unnamed machine") -> "MachineDefinition":
        """Build and validate a machine from a plain dict (parsed JSON)."""
        if not isinstance(data, dict):
            raise ConfigError(["Machine definition must be a JSON object."])
        errors: List[str] = []

        def string_list(key: str, single_char: bool) -> List[str]:
            value = data.get(key)
            if not isinstance(value, list) or not all(isinstance(x, str) and x for x in value):
                errors.append(f"'{key}' must be a list of non-empty strings.")
                return []
            if single_char:
                for item in value:
                    if len(item) != 1:
                        errors.append(f"'{key}': symbol '{item}' must be exactly one character.")
            if len(set(value)) != len(value):
                dups = sorted({x for x in value if value.count(x) > 1})
                errors.append(f"'{key}' contains duplicates: {dups}.")
            return value

        states = string_list("states", single_char=False)
        sigma = string_list("input_alphabet", single_char=True)
        gamma = string_list("tape_alphabet", single_char=True)

        blank = data.get("blank", "_")
        if not isinstance(blank, str) or len(blank) != 1:
            errors.append("'blank' must be a single character.")
            blank = "_"

        def state_field(key: str) -> str:
            value = data.get(key)
            if not isinstance(value, str):
                errors.append(f"'{key}' is required and must be a string.")
                return ""
            if states and value not in states:
                errors.append(f"'{key}' = '{value}' is not in the set of states Q.")
            return value

        start = state_field("start_state")
        accept = state_field("accept_state")
        reject = state_field("reject_state")
        if accept and accept == reject:
            errors.append("'accept_state' and 'reject_state' must be different.")

        if gamma and blank not in gamma:
            errors.append(f"The blank symbol '{blank}' must belong to the tape alphabet Γ.")
        if blank in sigma:
            errors.append(f"The blank symbol '{blank}' must not belong to the input alphabet Σ.")
        for symbol in sigma:
            if gamma and symbol not in gamma:
                errors.append(f"Input symbol '{symbol}' (Σ) must also belong to Γ.")

        delta: Dict[Tuple[str, str], Transition] = {}
        raw = data.get("transitions")
        if not isinstance(raw, list):
            errors.append("'transitions' must be a list of transition objects.")
            raw = []
        for i, item in enumerate(raw):
            where = f"transitions[{i}]"
            if not isinstance(item, dict):
                errors.append(f"{where}: must be an object with keys from/read/to/write/move.")
                continue
            missing = [k for k in ("from", "read", "to", "write", "move") if k not in item]
            if missing:
                errors.append(f"{where}: missing key(s) {missing}.")
                continue
            t = Transition(item["from"], item["read"], item["to"], item["write"], item["move"])
            if states and t.state not in states:
                errors.append(f"{where}: unknown source state '{t.state}'.")
            if states and t.next_state not in states:
                errors.append(f"{where}: unknown target state '{t.next_state}'.")
            if t.state in (accept, reject):
                errors.append(f"{where}: halting state '{t.state}' cannot have outgoing transitions.")
            if gamma and t.read not in gamma:
                errors.append(f"{where}: read symbol '{t.read}' is not in Γ.")
            if gamma and t.write not in gamma:
                errors.append(f"{where}: write symbol '{t.write}' is not in Γ.")
            if t.move not in MOVES:
                errors.append(f"{where}: move '{t.move}' must be one of L, R, S.")
            key = (t.state, t.read)
            if key in delta:
                errors.append(f"{where}: duplicate transition for δ({t.state}, {t.read}) (machine must be deterministic).")
            delta[key] = t

        if errors:
            raise ConfigError(errors)
        return cls(name, states, sigma, gamma, blank, start, accept, reject, delta)

    # ------------------------------------------------------------------- query
    def get_transition(self, state: str, symbol: str) -> Optional[Transition]:
        return self.transitions.get((state, symbol))

    def is_halting(self, state: str) -> bool:
        return state in (self.accept_state, self.reject_state)

    def invalid_symbols(self, text: str) -> List[Tuple[int, str]]:
        """(position, symbol) pairs of every character of `text` not in Σ."""
        allowed = set(self.input_alphabet)
        return [(i, ch) for i, ch in enumerate(text) if ch not in allowed]

    def check_input(self, text: str) -> None:
        """Raise InputError if `text` is not a string over Σ."""
        bad = self.invalid_symbols(text)
        if bad:
            pos, ch = bad[0]
            sigma = ", ".join(self.input_alphabet)
            raise InputError(
                f"Symbol '{ch}' at position {pos} is not in the input alphabet Σ = {{{sigma}}}"
                + (f" ({len(bad)} invalid symbols in total)." if len(bad) > 1 else ".")
            )

    def tuple_summary(self) -> List[Tuple[str, str]]:
        """Human readable 7-tuple, as (label, value) pairs."""
        fmt = lambda xs: "{" + ", ".join(xs) + "}"
        return [
            ("Q", fmt(self.states)),
            ("Σ", fmt(self.input_alphabet)),
            ("Γ", fmt(self.tape_alphabet)),
            ("δ", f"{len(self.transitions)} transitions"),
            ("q0", self.start_state),
            ("q_accept", self.accept_state),
            ("q_reject", self.reject_state),
        ]