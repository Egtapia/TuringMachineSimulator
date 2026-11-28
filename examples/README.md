# Demonstration configurations

Use **Load JSON…** in the browser and keep the populated input. For the terminal, run the command below and press Enter at the input prompt to use the file’s default.

```text
python -m tm -c examples/accepted_even_ones.json --final-only
```

| File | Default | Expected outcome |
|---|---|---|
| `accepted_even_ones.json` | `1010` | Accepted after five transitions. |
| `rejected_odd_ones.json` | `1011` | Rejected after five transitions. |
| `invalid_input.json` | `102` | Invalid input. The symbol `2` is outside the input alphabet. |
| `undefined_transition.json` | `0` | Undefined transition at step zero. Press Step or Run to end in the browser. |
| `loop_protection.json` | `0` | Step limit reached after ten stationary transitions. |
| `invalid_definition.json` | `0` | Configuration validation error. Movement `X` is unsupported. |
