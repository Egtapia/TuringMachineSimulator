# Turing Machine Simulator

Theory of Computation · Fall 2026

The simulator executes deterministic Turing machines from JSON definitions. Its objectives are to connect the formal model to individual tape operations, demonstrate machines that compute functions or recognize languages, and show how execution can stop under different conditions.

## Run the simulator

The terminal and local web server require Python 3.9 or newer. The web interface uses native HTML, CSS and JavaScript and requires a modern browser. Node.js 20 or newer is used for JavaScript tests only.

From the project root, run:

```text
python serve.py
```

Open [http://127.0.0.1:8000/web/](http://127.0.0.1:8000/web/) if the browser does not open automatically. Use `python serve.py 9000` to select a different port. When opening the HTML file directly from disk, use **Load JSON…** to import `presets.json` manually if the browser blocks the built-in fetch.

```text
python -m tm
python -m tm --list
python -m tm -p binary-increment -i 111 -m step
python -m tm -p binary-increment -i 1011 -m run -d 0.3
python -m tm -p w-hash-w -i "01#10" -m run
python -m tm -c examples/accepted_even_ones.json -i 1010 --final-only
python -m tm -p binary-increment -i 111 --final-only --trace-file trace.txt
```

`-p` accepts a preset ID or its list number. `-c` loads a custom JSON file. `-i` supplies the input and skips the prompt. At the input prompt, Enter selects the configured default. `-n` overrides the step limit, `-d` sets the delay in seconds, and `--no-color` disables ANSI colors. In step mode press Enter for one transition, `r` to continue automatically, or `q` to stop. The ASCII view shows the current state, head index, step count and status, with a caret under the scanned tape cell.

The terminal exits with 0 for acceptance, 1 for rejection, an undefined transition or a voluntary step-mode stop, 2 for invalid input or configuration, and 3 for a reached step limit. The displayed result distinguishes outcomes that share an exit code.

## Formal model

A deterministic Turing machine is the seven-tuple **M = (Q, Σ, Γ, δ, q₀, q_accept, q_reject)**. Q is a finite state set. Σ is the input alphabet, and Γ is the tape alphabet. Γ contains Σ and a blank symbol outside Σ. The initial state and both terminal states belong to Q. The accept and reject states are distinct.

For a nonterminal state and a scanned symbol, **δ(q, σ) = (q′, σ′, D)** changes the state to q′, writes σ′ at the current index, and moves the head left, right, or in place for **L**, **R**, or **S**. Each state/symbol pair has at most one transition. The head starts at index 0. The sparse tape extends in both directions and returns the blank symbol at every unwritten index.

## Architecture and files

Python and JavaScript execute machines independently. They read the same JSON format and use equivalent sparse tape and halting semantics.

| Path | Responsibility |
|---|---|
| `tm/definition.py`, `tm/presets.py` | Validate definitions, load files and unpack preset metadata |
| `tm/tape.py`, `tm/simulator.py` | Python tape and execution |
| `tm/cli.py`, `tm/__main__.py` | ASCII controls and module entry point |
| `web/js/engine.js` | JavaScript validation, tape and execution |
| `web/js/app.js`, `web/js/ui.js` | Web controls and rendering |
| `web/js/diagram.js` | SVG state diagram, active state and transition highlights |
| `web/index.html`, `web/css/styles.css` | Web markup and styling |
| `serve.py`, `presets.json` | Loopback HTTP server and five shared presets |
| `examples/`, `tests/`, `docs/` | Demonstrations, regression tests and submission guides |

## Create and load a JSON machine

Save a UTF-8 JSON object with the fields below. This bare machine accepts the empty string or a string of ones. The transition on blank stays in place as it enters the accept state.

```json
{
  "states": ["scan", "accept", "reject"],
  "input_alphabet": ["1"],
  "tape_alphabet": ["1", "_"],
  "blank": "_",
  "start_state": "scan",
  "accept_state": "accept",
  "reject_state": "reject",
  "transitions": [
    {"from": "scan", "read": "1", "to": "scan", "write": "1", "move": "R"},
    {"from": "scan", "read": "_", "to": "accept", "write": "_", "move": "S"}
  ]
}
```

Put the definition under `"machine"` to attach preset metadata, or put definitions and wrappers in a nonempty `"presets"` array. Optional fields are `id`, `name`, `description`, `default_input`, `max_steps`, and `examples`. An example has an `input` string and may include `expected`, `expected_tape` and `expected_steps`. Preset IDs must be unique within each collection. Alphabet symbols are single characters. Empty input alphabets and partial transition tables are supported. Inputs are validated before execution, so a configuration can include an intentionally invalid demonstration string.

Select **Load JSON…** in the browser or use `python -m tm -c FILE` in the terminal. For a collection, add `--list` to see its entries or use `-p ID` to select one. See [examples/README.md](examples/README.md) for ready-to-run files.

## Built-in machines

| Preset | Verified examples |
|---|---|
| Binary Increment | `0 → 1`, `1 → 10`, `1010 → 1011`, `1011 → 1100`, `111 → 1000`, `1111 → 10000`. Empty input writes `1` in two transitions at index −1. `1012` is invalid. |
| Unary Integer Multiplication | `1*1 → 1*1=1`, `11*111 → 11*111=111111`, `111*11 → 111*11=111111`, `1*111 → 1*111=111`, `11* → 11*=`, `*11 → *11=`. `1**1` and `11` reach undefined transitions. `2*3` is invalid. |
| Language w#w | Accepts `01#01`, `0110#0110` and `#`. Explicitly rejects `01#10`, `01#011`, `011#01` and the empty string. `01` and `01##01` reach undefined transitions. The tape contains the recognizer’s work marks. |
| Busy Beaver, 3 states | Blank input reaches the accept state after 13 transitions with six ones. |
| Busy Beaver, 4 states | Blank input reaches the accept state after 107 transitions with thirteen ones. The nonblank span contains one internal blank. |

## Controls, outcomes and traces

The web tape shows symbols, indices and the active head. Scroll horizontally to inspect cells or enable **Follow head** to track execution. The SVG diagram shows states, edges and terminal states. The transition table highlights the next and most recently applied rule. The state, head index and step count appear above the tape.

Use **Play/Pause**, **Step**, **Run to end**, and **Reset**. Adjust the speed slider during playback. Run to end processes batches so the page can handle other events between them. With focus outside interactive controls, Space toggles playback, Right Arrow steps, and R resets.

| Outcome | Meaning |
|---|---|
| Accepted | The machine entered its accept state. |
| Rejected | The machine entered its reject state. |
| Undefined transition | No rule applies to the scanned symbol and current state. |
| Invalid input | A character is outside Σ. Execution is blocked. |
| Step limit reached | The transition budget was exhausted. This result gives no conclusion about whether the machine would eventually halt. |
| Invalid configuration | The file could not be parsed as JSON or failed definition validation. |

The default limit for custom definitions is 10,000 transitions. The web input allows 1 through 100,000. The engines and CLI accept positive integers up to 2⁵³−1. Use practical limits because trace storage grows with execution length.

Each transition records its number, previous state, read symbol, write symbol, direction, next state and before/after head index. The browser displays up to 1,000 recent trace rows and **Export .txt** includes the complete execution up to the current step. The terminal writes the complete trace with `--trace-file PATH`. Both tape views render a bounded window near the head on long tapes.

## Tests

```text
python -m unittest discover -s tests -v
node --test tests/engine.test.cjs
python tests/browser_smoke.py "<path to Chromium or Edge executable>"
```

The Node suite includes independent JavaScript tests and compares execution snapshots against Python. Set `TM_PYTHON` if the Python executable has a different name. The browser smoke test exercises the served page in headless Chromium or Edge.

See the [presentation guide](docs/PRESENTATION_GUIDE.md) and [compliance report](docs/COMPLIANCE_REPORT.md).
