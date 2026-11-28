# Compliance report

The assignment DOCX was absent from the workspace. This report uses the five rubric categories and requirements supplied in the project brief.

## Formal Model & Execution Engine · 30 points available

| Requirement | Status | Source | Verification and result | Limitation |
|---|---|---|---|---|
| Seven-tuple, deterministic partial δ, and distinct terminal states | PASS | `tm/definition.py`, `web/js/engine.js` | Both suites checked required fields, duplicate rules, invalid terminal states, missing rules, and valid definitions. | |
| Read, write, L/R/S, blank, and bidirectional expansion | PASS | `tm/tape.py`, `tm/simulator.py`, `web/js/engine.js` | Tape unit checks covered sparse writes on both sides and blank erasure. Increment step tests covered all three movements and a negative head index. | |
| Exact steps, terminal states, reset, and engine agreement | PASS | `tm/simulator.py`, `web/js/engine.js`, `tests/engine.test.cjs` | Reset tests and 258 parity cases matched final status, tape contents and bounds, state, step count, and head index where execution was possible. | |

## UI & Visual Representation · 25 points available

| Requirement | Status | Source | Verification and result | Limitation |
|---|---|---|---|---|
| Web tape, indices, diagram, and active transitions | PASS | `web/index.html`, `web/js/ui.js`, `web/js/diagram.js` | Edge smoke test verified scrollable tape, both directions of tape growth, head marker and index, active state, and next/applied rule highlighting. | The tape uses a bounded display window. |
| Play, Pause, Step, Reset, speed, and Run to end | PASS | `web/js/app.js` | Edge verified the slow and fast schedules, pause stability, exact manual step, reset, canceling a queued batch, duplicate-run prevention through the disabled control, and disabled controls on halt. | |
| ASCII interface | PASS | `tm/cli.py`, `tm/__main__.py` | Startup, listing, custom loading, step mode, continuous mode and error exits passed. CLI output showed the tape, caret, head index, state, and count. | The tape uses a bounded display window. |
| Visible trace and complete export | PASS | `web/js/ui.js`, `web/js/app.js`, `tm/cli.py` | Edge confirmed a 1,000-row display cap and content of the full 1,600-transition export Blob. Python verified that a trace file included all eight transitions for incrementing `111`. | Edge intercepted the download after generating the Blob, so it did not exercise the OS save dialog. |
| Responsive layout and accessibility | PARTIAL | `web/index.html`, `web/css/styles.css`, `web/js/app.js` | Edge checked input validation feedback through `aria-invalid`, disabled states, and a scrollable tape. | Touch, assistive technology, reduced motion and cross-browser layout were not independently verified. |

## Configuration, Validation & Safety · 20 points available

| Requirement | Status | Source | Verification and result | Limitation |
|---|---|---|---|---|
| Bare definitions, wrappers, collections and built-in discovery | PASS | `tm/presets.py`, `web/js/engine.js` | Both parser suites exercised the three supported shapes. CLI and browser each loaded all five built-ins. | |
| Malformed JSON, invalid definitions, numeric and optional fields | PASS | `tm/definition.py`, `tm/presets.py`, `web/js/engine.js`, `web/js/app.js` | Unit tests checked type, field, transition, and numeric constraints. Edge showed validation errors for both bad JSON and invalid movement and retained the previously loaded simulator. | |
| Accepted, rejected, invalid input, undefined transition, step limit, and invalid configuration | PASS | `tm/simulator.py`, `tm/cli.py`, `web/js/engine.js`, `web/js/app.js` | All six demonstrations passed in Python and JavaScript. Edge exercised all six using the upload handler and confirmed termination or blocked execution. | The web step-limit control caps runs at 100,000 transitions. |
| Bounded execution and terminal precedence | PASS | `tm/simulator.py`, `web/js/engine.js`, `web/js/app.js` | Unit tests checked the inclusive budget and terminal precedence. The browser confirmed a stationary loop stops at ten and yields between batches on a longer run. | Full history grows with the number of executed transitions. |

## Preset Configurations & Verification · 15 points available

| Requirement | Status | Source | Verification and result | Limitation |
|---|---|---|---|---|
| Binary Increment | PASS | `presets.json`, `tests/test_presets.py`, `tests/engine.test.cjs` | Both engines computed all integers 0–199 correctly. Empty input produced `1`, and `1012` was invalid. | |
| Unary Integer Multiplication | PASS | Same preset and test files | All 36 products for operands 0–5 matched the complete output tape. The tested malformed strings reached the expected undefined-transition or invalid-input outcome. | |
| Language w#w | PASS | Same preset and test files | Identical halves and `#` were accepted. The specified mismatched cases were explicitly rejected. Incomplete formats produced the documented outcomes. | |
| Busy Beaver, 3 and 4 states | PASS | Same preset and test files | The blank-tape runs reached acceptance after 13 and 107 transitions and produced six and thirteen ones respectively. | |
| Six demonstrations | PASS | `examples/`, `tests/test_simulator.py`, `tests/browser_smoke.js` | Tested the expected outcome of each fixture through the engines, CLI and browser. | |

## Code Structure & Documentation · 10 points available

| Requirement | Status | Source | Verification and result | Limitation |
|---|---|---|---|---|
| Modular architecture and preserved presets | PASS | `tm/`, `web/js/`, `presets.json` | Reviewed module boundaries and confirmed `presets.json` was identical to the baseline. Normal execution uses Python’s standard library and native web APIs. | |
| Repository hygiene | PASS | `.gitignore`, `tm/cli.py` | Removed seven generated bytecode files from Git tracking. `git diff --check HEAD` passed. The pre-existing untracked bit-flip demonstration remains available. | |
| Setup, JSON format, trace, tests, and presentation | PASS | `README.md`, `examples/README.md`, `docs/PRESENTATION_GUIDE.md` | Checked file paths, verified launch commands and documented sample inputs. Each presenter’s segments total 7 minutes 30 seconds. | |
| Assignment DOCX review | NOT VERIFIED | Project brief | Searched the workspace for DOCX files and used the supplied rubric. | The original DOCX may contain requirements absent from the brief. |

## Test runs

- `python -m unittest discover -s tests -v` passed 16 tests.
- `node --test tests/engine.test.cjs` passed 4 tests, including 258 cross-engine comparisons.
- `python -B tests/browser_smoke.py "<Edge executable>"` passed in headless Microsoft Edge.
- A loopback HTTP check confirmed that `serve.py` serves the web page and the preset collection.
- The CLI commands for listing presets, stepping on `111`, running on `1011`, and rejecting `01#10` produced the expected results.
