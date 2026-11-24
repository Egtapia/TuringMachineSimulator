# Interactive Multi-Interface Turing Machine Simulator

A deterministic, single-tape Turing machine simulator with **two interfaces that share the same
configuration format**:

* **Web visualizer** – animated, scrollable tape, play / pause / step / reset / speed controls,
  live transition-table highlighting and a real-time execution trace.
ASCII terminal UI – tape, head pointer (`^`), step counter and state printed at every step,
  with interactive step-through and continuous-run modes.

**Zero external dependencies.** Python 3.8+ (standard library only) and any modern web browser.
No `pip install`, no `npm install`.

## Quick start

```bash
# Terminal UI (interactive menu)
python -m tm

# Web UI  ->  opens http://localhost:8000/web/
python serve.py
```

> The web page loads `presets.json` with `fetch()`, which browsers block for `file://` pages.
> That is why `serve.py` exists (a 30-line static server). If you open `web/index.html` by
> double-clicking it, use the **Load JSON…** button and select `presets.json`.

### Terminal examples

```bash
python -m tm --list                                   # show built-in machines
python -m tm -p binary-increment -i 1011              # step-through (press Enter)
python -m tm -p w-hash-w -i 01#01 -m run -d 0.2       # continuous, 0.2 s per step
python -m tm -p busy-beaver-4 -i "" -m run --final-only
python -m tm -p unary-multiplication -i 11*111 -m run -d 0 --trace-file trace.txt
python -m tm -c my_machine.json -i 0110 --max-steps 500
```

| Flag | Meaning |
| --- | --- |
| `-p, --preset` | preset id or number (`--list` shows them) |
| `-c, --config` | path to your own JSON machine file |
| `-i, --input` | input string (omit to be prompted, with validation) |
| `-m, --mode` | `step` (press Enter per step, `r` = run rest, `q` = quit) or `run` |
| `-d, --delay` | seconds between steps in `run` mode |
| `-n, --max-steps` | **N<sub>max</sub>**, overrides the preset's step limit |
| `--trace-file` | write the complete step-by-step trace to a text file |
| `--final-only` | print only the last configuration and the summary |
| `--no-color` | disable ANSI colours |

Exit codes: `0` accepted · `1` rejected / undefined transition · `2` bad config or input · `3` N<sub>max</sub> reached.

Sample terminal output:

```
Step    6  |  State: q1  |  Status: RUNNING
     -2  -1   0   1   2   3   4   5 
    +---+---+---+---+---+---+---+---+
    | _ | _ | 1 | 0 | 1 | 0 | _ | _ |
    +---+---+---+---+---+---+---+---+
                      ^  head = 2
    Applied: δ(q1, 1) → (q1, 0, L)
```

## Project structure

```
turing-machine-simulator/
├── presets.json            # built-in machines + test cases (shared by both UIs)
├── serve.py                # tiny local web server
├── README.md
├── tm/                     # Python package: engine + terminal UI
│   ├── definition.py       #   7-tuple model, JSON validation, input validation (Σ)
│   ├── tape.py             #   sparse, logically infinite tape
│   ├── simulator.py        #   step engine, statuses, N_max protection
│   ├── presets.py          #   JSON loading (presets file / single machine)
│   ├── cli.py              #   ASCII renderer, interactive & continuous modes
│   └── __main__.py         #   enables `python -m tm`
├── web/                    # browser UI (plain HTML/CSS/JS, no build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── engine.js       #   same engine as tm/, in JavaScript
│       ├── ui.js           #   DOM rendering (tape, trace, tables)
│       └── app.js          #   controller: playback, events, file loading
└── tests/test_presets.py   # unit tests (python -m unittest)
```

## Architecture

```
            ┌────────────────────────────┐
presets.json│  MachineDefinition         │  7-tuple (Q, Σ, Γ, δ, q0, q_accept, q_reject)
 / custom ─►│  + validation (all errors) │  → ConfigError lists *every* problem found
            └─────────────┬──────────────┘
                          │
            ┌─────────────▼──────────────┐
  input w ─►│  Simulator                 │  validates w ∈ Σ*  → InputError
            │  Tape (sparse dict / Map)  │  step() / run(), N_max, undefined δ handling
            └──────┬───────────────┬─────┘
                   │               │
          ┌────────▼───────┐ ┌─────▼────────────┐
          │ tm/cli.py      │ │ web/js/ui.js+app │
          │ ASCII UI       │ │ visual UI        │
          └────────────────┘ └──────────────────┘
```

* **Formal model** – `MachineDefinition` stores Q, Σ, Γ, δ, q₀, q_accept and q_reject; δ is a
  dictionary keyed by `(state, symbol)`, so lookups are O(1).
* **Tape** – sparse dictionary of non-blank cells. The head index may be any integer, so the tape
  grows to the left and to the right without shifting anything (no off-by-one on expansion).
* **Moves** – `L` (−1), `R` (+1) and `S` (stay, 0).
* **Halting** – the run ends in exactly one of these statuses:

| Status | Meaning |
| --- | --- |
| `accepted` | reached `q_accept` |
| `rejected` | reached `q_reject` |
| `no_transition` | δ(q, σ) is undefined → graceful *implicit rejection* (never a crash) |
| `max_steps` | N<sub>max</sub> steps executed without halting (infinite-loop protection) |

* **Validation** – the input string is checked against Σ before anything runs, reporting the first
  offending symbol and its position. The web UI does this live while you type.
* The Python and JavaScript engines implement identical semantics; both are verified against the
  expected results stored in `presets.json`.

## Built-in presets (`presets.json`)

| id | Machine | What it does |
| --- | --- | --- |
| `binary-increment` | f(x) = x + 1 | binary, MSB first. `1011 → 1100`, `111 → 1000` |
| `unary-multiplication` | integer multiplication | `1^a*1^b → 1^a*1^b=1^(a·b)`. `11*111 → 11*111=111111` |
| `w-hash-w` | L = { w#w ∣ w ∈ {0,1}* } | decider: accepts `01#01`, rejects `01#10` |
| `busy-beaver-3` | 3-state champion | six 1s in 13 steps on a blank tape |
| `busy-beaver-4` | 4-state champion (bonus) | thirteen 1s in 107 steps, tape grows in both directions |

Each preset ships with `examples` (inputs + expected status / tape / step count) that the test
suite checks automatically.

## Defining your own machine

Create a `.json` file. The simplest form is a bare machine definition:

```json
{
  "name": "Flip bits",
  "description": "Replaces every 0 by 1 and every 1 by 0.",
  "max_steps": 1000,
  "default_input": "10110",
  "machine": {
    "states": ["q0", "q_accept", "q_reject"],
    "input_alphabet": ["0", "1"],
    "tape_alphabet": ["0", "1", "_"],
    "blank": "_",
    "start_state": "q0",
    "accept_state": "q_accept",
    "reject_state": "q_reject",
    "transitions": [
      { "from": "q0", "read": "0", "to": "q0", "write": "1", "move": "R" },
      { "from": "q0", "read": "1", "to": "q0", "write": "0", "move": "R" },
      { "from": "q0", "read": "_", "to": "q_accept", "write": "_", "move": "S" }
    ]
  }
}
```

Load it with `python -m tm -c flip.json` or with **Load JSON…** in the web UI.
A file may also contain `{ "presets": [ … ] }` with several machines (this is the format of `presets.json`),
or just the machine object itself (the keys of `"machine"` at the top level).

### Transition syntax

Every entry of `"transitions"` encodes **δ(q<sub>i</sub>, σ) → (q<sub>j</sub>, σ′, D)**:

| JSON key | Symbol | Meaning |
| --- | --- | --- |
| `from` | q<sub>i</sub> | current state |
| `read` | σ | symbol under the head |
| `to` | q<sub>j</sub> | next state |
| `write` | σ′ | symbol written to the current cell |
| `move` | D | `"L"` left · `"R"` right · `"S"` stay |

### Validation rules

The loader reports **all** problems at once. A machine is rejected when:

* `states`, `input_alphabet`, `tape_alphabet` are not lists of non-empty strings, or contain duplicates;
* tape/input symbols are not exactly one character;
* `start_state`, `accept_state`, `reject_state` are missing or not in `states`; accept = reject;
* the blank symbol is not in Γ, or is in Σ; or Σ ⊄ Γ;
* a transition refers to an unknown state, a symbol outside Γ, or a move other than `L`/`R`/`S`;
* two transitions share the same `(from, read)` (machines are deterministic);
* a transition leaves `accept_state` or `reject_state` (halting states have none).

If no transition exists for the current `(state, symbol)` while *running*, the machine stops with
status `no_transition` (treated as rejection).

### Optional preset fields

| Field | Purpose |
| --- | --- |
| `id`, `name`, `description` | label and help text shown in both UIs |
| `max_steps` | default N<sub>max</sub> (can be overridden in the UI / with `--max-steps`) |
| `default_input` | pre-filled input string |
| `examples` | `[{ "input": "…", "expected": "accepted", "expected_tape": "…", "expected_steps": 13 }]` – shown as clickable chips in the web UI and checked by the tests |

## Web interface guide

* **Tape** – blank cells are drawn on both sides of the used region, so the tape looks infinite;
  scroll it freely or tick *Follow head* to keep the head centred. The cyan marker shows the head
  and the current state q<sub>i</sub>; the cell that was just written flashes.
* **Controls** – Play / Pause, single Step, Run to end (instant), Reset, and a 10-level speed
  slider (1 → 500 steps/s). Shortcuts: `Space`, `→`, `R`.
* **Transition table** – the transition about to be applied is highlighted in cyan, the one just applied in violet.
* **Trace panel** – step number, state sequence and transition for every step, plus a final row with
  the halting reason. *Export .txt* downloads the full trace.
* **Safety** – N<sub>max</sub> is editable (1 – 100 000). Hitting it stops the run and shows a
  "step limit reached" banner.
* **Themes** – dark and light (the choice is remembered).

## Running the tests

```bash
python -m unittest discover -s tests -v
```

The suite checks every example of every preset, exhaustively verifies increment (0–199),
multiplication (0×0 … 5×5) and `w#w` (all words up to length 3), the Busy Beaver results, tape
expansion, infinite-loop protection, undefined transitions, Σ validation and configuration errors.
