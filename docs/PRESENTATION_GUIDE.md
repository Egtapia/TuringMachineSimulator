# Fifteen-minute presentation guide

Start `python serve.py` from the project root. Keep a terminal and the `examples/` directory open. Use the browser’s **Run to end** for demonstrations where timing matters.

## Group member 1 · 7 minutes 30 seconds

| Duration | Explain | Show on screen and expected result | Suggested script |
|---|---|---|---|
| 0:45 | Introduction and objectives | Open the web simulator. The default preset is Binary Increment with `1011`. | “We built a simulator for deterministic Turing machines. The web view shows how each rule changes the state, tape and head.” |
| 1:20 | Formal seven-tuple and transition function | Point to the tuple and next rule with input `1011`. The next step scans the first `1` and moves right. | “The transition function uses the current state and scanned symbol to select a write, a move and the next state. The alphabet includes a blank for the unwritten tape.” |
| 0:55 | Architecture | Show `presets.json`, `tm/simulator.py`, and `web/js/engine.js`. Keep `1011` as the shared example. | “The terminal runs the Python engine. The browser runs a JavaScript engine. Both interpret the same definitions.” |
| 1:50 | Web controls and Binary Increment | Set `111`. Step once, play slowly, pause, then run to end. Show the current state, head and applied rule. The result is `1000` after eight transitions, with head at −1. Reset to restore `111`. | “This machine scans right to find the end of the number. Carry propagation runs left, and this input needs a new digit one cell left of the initial tape.” |
| 1:20 | Unary multiplication | Select Unary Integer Multiplication and run `11*111`. The tape ends as `11*111=111111`. | “The operands have two and three tally marks. The machine copies the three marks for each of the two marks in the left operand.” |
| 1:20 | w#w and Busy Beaver overview | Run `01#01` and `01#10` in w#w. Then run each Busy Beaver on empty input. Expect acceptance, rejection, then 13 transitions with six ones and 107 with thirteen ones. | “The recognizer matches both sides of the separator. The Busy Beaver examples start from blank tape and show how much activity a small state set can produce.” |

## Group member 2 · 7 minutes 30 seconds

| Duration | Explain | Show on screen and expected result | Suggested script |
|---|---|---|---|
| 1:15 | JSON structure | Open `accepted_even_ones.json` with default `1010`. Point to the alphabets and the two parity states. Expect acceptance. | “The machine toggles its parity state on a one and preserves it on a zero. When it scans blank it halts based on the current parity.” |
| 1:30 | Custom loading and explicit halts | Upload the accepted and rejected parity files. Run defaults `1010` and `1011`. Expect acceptance and rejection in five transitions each. | “These two files use the same rules. The last symbol changes the parity and sends the machine to a different terminal state.” |
| 1:15 | Input and definition validation | Load `invalid_input.json` with `102`; execution controls are disabled. Upload `invalid_definition.json` with movement `X`; the error lists the allowed directions. | “The first file has a valid machine and a bad input. The second file has a rule the machine cannot interpret.” |
| 1:10 | Undefined transitions and step limits | Load `undefined_transition.json`, input `0`, and step. Then load `loop_protection.json`, input `0`, and run to end. Expect zero transitions in the first case and the limit at ten in the second. | “The first machine has no applicable rule. The second keeps applying a stationary rule until its budget is exhausted.” |
| 1:20 | Python ASCII execution | Run `python -m tm -p binary-increment -i 111 -m step -d 0`. Press Enter, then R. Expect a caret under the scanned cell and acceptance with tape `1000`. | “The caret follows the head here. The terminal shows the same state changes and tape result as the browser.” |
| 1:00 | Testing and conclusion | Show `python -m unittest discover -s tests -v` and `node --test tests/engine.test.cjs` in an environment with Node installed. Point to the checks for `11*111` and `01#10`. | “The tests check output tape contents, transition counts and halt status. The parity suite also compares the head position, state and tape across both engines.” |
