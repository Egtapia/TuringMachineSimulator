"""ASCII terminal interface for the Turing machine simulator.

Examples
    python -m tm                                   interactive menu
    python -m tm --list                            list built-in presets
    python -m tm -p binary-increment -i 1011       step-through mode
    python -m tm -p w-hash-w -i 01#01 -m run -d 0.2
    python -m tm -c my_machine.json -i 0110 --max-steps 500
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from typing import List, Optional

from .definition import ConfigError, InputError
from .presets import Preset, load_config, load_presets
from .simulator import Simulator, Status, StepRecord
from .tape import Tape

# ----------------------------------------------------------------- appearance
RESET, BOLD, DIM = "\033[0m", "\033[1m", "\033[2m"
CYAN, GREEN, RED, YELLOW, MAGENTA = "\033[36m", "\033[32m", "\033[31m", "\033[33m", "\033[35m"
REVERSE = "\033[7m"

STATUS_STYLE = {
    Status.READY: ("READY", CYAN),
    Status.RUNNING: ("RUNNING", YELLOW),
    Status.ACCEPTED: ("ACCEPTED", GREEN),
    Status.REJECTED: ("REJECTED", RED),
    Status.NO_TRANSITION: ("REJECTED (no transition)", RED),
    Status.MAX_STEPS: ("STEP LIMIT REACHED", MAGENTA),
}


def paint(text: str, *codes: str, color: bool = True) -> str:
    return "".join(codes) + text + RESET if color else text


# ------------------------------------------------------------------ rendering
def render_tape(tape: Tape, head: int, color: bool = False, max_cells: int = 21) -> str:
    """ASCII drawing of the tape with a '^' under the head cell.

        +---+---+---+
        | 1 | 0 | 1 |
        +---+---+---+
              ^
    """
    bounds = tape.bounds()
    lo = head if bounds is None else min(bounds[0], head)
    hi = head if bounds is None else max(bounds[1], head)
    lo, hi = lo - 2, hi + 2                       # always show a little blank margin
    if hi - lo + 1 > max_cells:                   # too wide: window centred on the head
        lo = head - max_cells // 2
        hi = lo + max_cells - 1
    more_left = bounds is not None and bounds[0] < lo
    more_right = bounds is not None and bounds[1] > hi

    width = max(3, len(str(lo)), len(str(hi)))
    indices = range(lo, hi + 1)
    border = "+" + "+".join("-" * width for _ in indices) + "+"
    index_row = " " + " ".join(f"{i:^{width}}" for i in indices)
    cells = []
    for i in indices:
        text = f"{tape.read(i):^{width}}"
        cells.append(paint(text, BOLD, REVERSE, color=color) if (i == head and color) else text)
    cell_row = "|" + "|".join(cells) + "|"
    pointer_offset = (head - lo) * (width + 1) + 1 + width // 2
    pointer = " " * pointer_offset + paint("^", BOLD, YELLOW, color=color)

    left = "... " if more_left else "    "
    right = " ..." if more_right else ""
    pad = "    "
    return "\n".join([
        pad + index_row,
        pad + border,
        left + cell_row + right,
        pad + border,
        pad + pointer + paint(f"  head = {head}", DIM, color=color),
    ])


def render_frame(sim: Simulator, last: Optional[StepRecord], color: bool = False) -> str:
    label, tint = STATUS_STYLE[sim.status]
    header = (f"{paint(f'Step {sim.steps:>4}', BOLD, color=color)}  |  "
              f"State: {paint(sim.state, CYAN, BOLD, color=color)}  |  "
              f"Status: {paint(label, tint, BOLD, color=color)}")
    lines = [header, render_tape(sim.tape, sim.head, color)]
    if last is not None:
        lines.append(paint(f"    Applied: {last.transition}", DIM, color=color))
    elif sim.steps == 0:
        lines.append(paint("    Initial configuration", DIM, color=color))
    return "\n".join(lines)


def render_summary(sim: Simulator, color: bool = False) -> str:
    label, tint = STATUS_STYLE[sim.status]
    if not sim.halted:
        label, tint = "STOPPED BEFORE HALTING", YELLOW
    bar = "=" * 60
    return "\n".join([
        bar,
        f" Result        : {paint(label, tint, BOLD, color=color)}",
        f" Reason        : {sim.message or '-'}",
        f" Steps         : {sim.steps} (N_max = {sim.max_steps})",
        f" Final state   : {sim.state}",
        f" Head position : {sim.head}",
        f" Tape contents : {sim.tape.contents() or '(empty)'}",
        bar,
    ])


def machine_banner(preset: Preset, color: bool = False) -> str:
    d = preset.definition
    lines = [paint(f"Machine: {preset.name}", BOLD, color=color)]
    if preset.description:
        lines.append(preset.description)
    lines.append("")
    lines.extend(f"  {label:<9}= {value}" for label, value in d.tuple_summary())
    return "\n".join(lines)


# --------------------------------------------------------------------- helpers
def enable_ansi() -> None:
    if os.name == "nt":
        os.system("")          # turns on ANSI escape processing in recent Windows consoles
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def choose_preset(presets: List[Preset], wanted: Optional[str]) -> Preset:
    if wanted:
        for i, p in enumerate(presets, 1):
            if wanted in (p.id, str(i)):
                return p
        raise ConfigError([f"Unknown preset '{wanted}'. Use --list to see the available ones."])
    print("\nAvailable machines:")
    for i, p in enumerate(presets, 1):
        print(f"  {i}. {p.name}   [{p.id}]")
    while True:
        raw = input("\nSelect a machine (number or id): ").strip()
        try:
            return choose_preset(presets, raw)
        except ConfigError:
            print("  Invalid choice, try again.")


def ask_input(preset: Preset) -> str:
    d = preset.definition
    sigma = ", ".join(d.input_alphabet)
    print(f"\nInput alphabet Σ = {{{sigma}}}")
    if preset.examples:
        shown = ", ".join(repr(e["input"]) for e in preset.examples[:4])
        print(f"Examples: {shown}")
    while True:
        raw = input(f"Input string [default {preset.default_input!r}]: ").strip()
        text = raw if raw else preset.default_input
        try:
            d.check_input(text)
            return text
        except InputError as exc:
            print(f"  ✗ {exc}")


def exit_code(status: Status) -> int:
    return {Status.ACCEPTED: 0, Status.MAX_STEPS: 3}.get(status, 1)


# --------------------------------------------------------------------- session
class Session:
    def __init__(self, sim: Simulator, color: bool, trace_path: Optional[str], final_only: bool):
        self.sim, self.color, self.final_only = sim, color, final_only
        self.trace = open(trace_path, "w", encoding="utf-8") if trace_path else None
        if self.trace:
            self.trace.write(f"Trace report - {sim.definition.name}\n")
            self.trace.write(f"Input: {sim.input_string!r}   N_max: {sim.max_steps}\n\n")

    def show(self, last: Optional[StepRecord]) -> None:
        if not self.final_only:
            print()
            print(render_frame(self.sim, last, self.color))
        if self.trace:
            self.trace.write(render_frame(self.sim, last, color=False) + "\n\n")

    def finish(self) -> None:
        if self.final_only:
            print(render_frame(self.sim, None, self.color))
        print()
        print(render_summary(self.sim, self.color))
        if self.trace:
            self.trace.write(render_summary(self.sim) + "\n")
            self.trace.close()
            print(f"Trace report saved to {self.trace.name}")

    def run_continuous(self, delay: float) -> None:
        while not self.sim.halted:
            record = self.sim.step()
            self.show(record)
            if delay > 0 and not self.sim.halted:
                time.sleep(delay)

    def run_stepwise(self, delay: float) -> None:
        while not self.sim.halted:
            try:
                cmd = input("\n[Enter] next step   [r] run to the end   [q] quit  > ").strip().lower()
            except EOFError:
                cmd = "q"
            if cmd == "q":
                print("Stopped by user.")
                return
            if cmd == "r":
                self.run_continuous(delay)
                return
            self.show(self.sim.step())


def main(argv: Optional[List[str]] = None) -> int:
    enable_ansi()
    parser = argparse.ArgumentParser(prog="python -m tm", description="Turing Machine Simulator (terminal UI)")
    parser.add_argument("-p", "--preset", help="preset id or number (see --list)")
    parser.add_argument("-c", "--config", help="path to a custom JSON machine file")
    parser.add_argument("-i", "--input", dest="text", help="input string (skips the prompt)")
    parser.add_argument("-m", "--mode", choices=["step", "run"], help="step-through or continuous run")
    parser.add_argument("-d", "--delay", type=float, default=0.3, help="seconds between steps in run mode (default 0.3)")
    parser.add_argument("-n", "--max-steps", type=int, help="N_max, maximum number of steps")
    parser.add_argument("--trace-file", help="write the full step trace to this file")
    parser.add_argument("--final-only", action="store_true", help="print only the final configuration")
    parser.add_argument("--no-color", action="store_true", help="disable ANSI colours")
    parser.add_argument("--list", action="store_true", help="list the available machines and exit")
    args = parser.parse_args(argv)
    color = not args.no_color and sys.stdout.isatty()

    try:
        presets = load_config(args.config) if args.config else load_presets()
        if args.list:
            for i, p in enumerate(presets, 1):
                print(f"{i}. {p.id:<22} {p.name}")
            return 0

        wanted = args.preset
        if wanted is None and len(presets) == 1:      # e.g. a custom file with a single machine
            wanted = "1"
        preset = choose_preset(presets, wanted)
        print()
        print(machine_banner(preset, color))
        text = args.text if args.text is not None else ask_input(preset)
        max_steps = args.max_steps or preset.max_steps
        sim = Simulator(preset.definition, text, max_steps)
    except (ConfigError, InputError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except (EOFError, KeyboardInterrupt):
        print("\nAborted.")
        return 130

    mode = args.mode
    if mode is None:
        mode = "run" if args.final_only else (
            "run" if input("\nMode - [s]tep-through or [r]un continuously? [s]: ").strip().lower().startswith("r")
            else "step")

    session = Session(sim, color, args.trace_file, args.final_only)
    session.show(None)
    try:
        if mode == "run":
            session.run_continuous(0 if args.final_only else args.delay)
        else:
            session.run_stepwise(args.delay)
    except KeyboardInterrupt:
        print(f"\nInterrupted at step {sim.steps}.")
    session.finish()
    return exit_code(sim.status)


if __name__ == "__main__":
    sys.exit(main())