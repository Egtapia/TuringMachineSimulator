const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const { ConfigError, InputError, Simulator, Tape, parseConfig } = require("../web/js/engine.js");

const root = resolve(__dirname, "..");
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const builtins = read("presets.json");
const fixtures = {
  accepted_even_ones: "accepted", rejected_odd_ones: "rejected",
  invalid_input: "invalid_input", undefined_transition: "no_transition",
  loop_protection: "max_steps", invalid_definition: "invalid_configuration",
};
const examples = Object.entries(fixtures).map(([name, expected]) =>
  ({ config: read(`examples/${name}.json`), expected }));
const even = examples[0].config.machine;

function snapshot({ config, index = 0, input }) {
  try {
    const p = parseConfig(config)[index];
    const sim = new Simulator(p.definition, input ?? p.defaultInput, p.maxSteps);
    sim.run();
    return [sim.status, sim.tape.contents(), sim.state, sim.steps, sim.head, sim.tape.bounds()];
  } catch (err) {
    if (err instanceof ConfigError) return "invalid_configuration";
    if (err instanceof InputError) return "invalid_input";
    throw err;
  }
}

const presetCase = (index, input) => ({ config: builtins, index, input });

test("built-in machine outcomes and tape contents", () => {
  for (let n = 0; n < 200; n++) {
    assert.deepEqual(snapshot(presetCase(0, n.toString(2))).slice(0, 2), ["accepted", (n + 1).toString(2)]);
  }
  assert.deepEqual(snapshot(presetCase(0, "")).slice(0, 2), ["accepted", "1"]);
  assert.equal(snapshot(presetCase(0, "1012")), "invalid_input");
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      const input = "1".repeat(a) + "*" + "1".repeat(b);
      assert.deepEqual(snapshot(presetCase(1, input)).slice(0, 2), ["accepted", input + "=" + "1".repeat(a * b)]);
    }
  }
  for (const input of ["1**1", "11"]) assert.equal(snapshot(presetCase(1, input))[0], "no_transition");
  assert.equal(snapshot(presetCase(1, "2*3")), "invalid_input");
  for (const input of ["#", "01#01", "0110#0110"]) assert.equal(snapshot(presetCase(2, input))[0], "accepted");
  for (const input of ["", "01#10", "01#011", "011#01"]) assert.equal(snapshot(presetCase(2, input))[0], "rejected");
  for (const input of ["01", "01##01"]) assert.equal(snapshot(presetCase(2, input))[0], "no_transition");
  for (const [index, steps, count] of [[3, 13, 6], [4, 107, 13]]) {
    const [status, tape, , length] = snapshot(presetCase(index, ""));
    assert.equal(status, "accepted");
    assert.equal(length, steps);
    assert.equal([...tape].filter((x) => x === "1").length, count);
  }
});

test("validation, supported shapes and the six demonstrations", () => {
  assert.throws(() => JSON.parse("{oops"), SyntaxError);
  for (const key of Object.keys(even)) {
    const missing = { ...even };
    delete missing[key];
    assert.throws(() => parseConfig(missing), ConfigError, key);
  }
  for (const bad of [
    null, [], { presets: [] }, { presets: {} }, { presets: [even, { ...even, id: "custom-1" }] },
    { ...even, states: [] }, { ...even, tape_alphabet: [] }, { ...even, blank: "2" },
    { ...even, input_alphabet: ["2"] }, { ...even, reject_state: "accept" },
    { ...even, transitions: [even.transitions[0], even.transitions[0]] },
    { ...even, transitions: [{ ...even.transitions[0], from: [] }] },
    { ...even, transitions: [{ ...even.transitions[0], to: "missing" }] },
    { ...even, transitions: [{ ...even.transitions[0], write: "2" }] },
    { ...even, transitions: [{ ...even.transitions[0], from: "accept" }] },
    { ...even, max_steps: true }, { ...even, max_steps: 2 ** 53 },
    { ...even, name: [] }, { ...even, default_input: 0 }, { ...even, examples: [null] },
  ]) assert.throws(() => parseConfig(bad), ConfigError);
  for (const shape of [even, { machine: even }, { presets: [even] }]) assert.equal(parseConfig(shape).length, 1);
  for (const example of examples) {
    const result = snapshot(example);
    assert.equal(Array.isArray(result) ? result[0] : result, example.expected);
    if (example.expected === "max_steps") assert.equal(result[3], 10);
  }
});

test("sparse tape, exact steps and reset", () => {
  const tape = new Tape("_", "01");
  assert.equal(tape.read(-10), "_");
  tape.write(-2, "1");
  tape.write(3, "0");
  assert.deepEqual(tape.bounds(), [-2, 3]);
  assert.equal(tape.contents(), "1_01_0");
  tape.write(-2, "_");
  assert.deepEqual(tape.bounds(), [0, 3]);
  const sim = new Simulator(parseConfig(builtins)[0].definition, "1");
  assert.deepEqual(Array.from({ length: 4 }, () => {
    const { move, headAfter } = sim.step();
    return [move, headAfter];
  }), [["R", 1], ["L", 0], ["L", -1], ["S", -1]]);
  assert.equal(sim.step(), null);
  sim.reset();
  assert.deepEqual([sim.steps, sim.head, sim.status, sim.tape.contents(), sim.history], [0, 0, "ready", "1", []]);
  const definition = parseConfig(even)[0].definition;
  const terminal = new Simulator(definition, "", 1);
  terminal.run();
  assert.equal(terminal.status, "accepted");
  assert.throws(() => new Simulator(definition, []), InputError);
});

test("Python and JavaScript agree on final execution snapshots", () => {
  const cases = [
    ...Array.from({ length: 200 }, (_, n) => presetCase(0, n.toString(2))),
    ...Array.from({ length: 36 }, (_, n) => presetCase(1, "1".repeat(Math.floor(n / 6)) + "*" + "1".repeat(n % 6))),
    ...["#", "01#01", "0110#0110", "01#10", "01#011", "011#01", "", "01", "01##01"].map((s) => presetCase(2, s)),
    presetCase(0, ""), presetCase(0, "1012"),
    ...["1**1", "11", "2*3"].map((s) => presetCase(1, s)),
    presetCase(3, ""), presetCase(4, ""), ...examples,
  ];
  const python = spawnSync(process.env.TM_PYTHON || "python", ["-B", "-m", "tests.parity_snapshot"], {
    cwd: root, input: JSON.stringify(cases), encoding: "utf8",
  });
  assert.ifError(python.error);
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(cases.map(snapshot), JSON.parse(python.stdout));
});
