import copy
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from tm import ConfigError, InputError, Simulator, Status, Tape, load_config
from tm.presets import parse_config

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"
EVEN = json.loads((EXAMPLES / "accepted_even_ones.json").read_text(encoding="utf-8"))
MACHINE = EVEN["machine"]


class ConfigurationTests(unittest.TestCase):
    def test_supported_shapes(self):
        for config in (MACHINE, EVEN, {"presets": [EVEN]}):
            self.assertEqual(parse_config(config)[0].definition.start_state, "even")
        self.assertEqual(parse_config(dict(MACHINE, input_alphabet=[]))[0].definition.input_alphabet, [])

    def test_invalid_definitions(self):
        for key, value in [
            ("states", []), ("states", ["even", "even"]), ("input_alphabet", "01"),
            ("input_alphabet", ["_"]), ("input_alphabet", ["2"]), ("tape_alphabet", []),
            ("blank", "x"), ("blank", "__"), ("start_state", "absent"),
            ("accept_state", "absent"), ("reject_state", "accept"), ("transitions", {}),
            ("transitions", [None]), ("transitions", [{}]),
            ("transitions", [dict(MACHINE["transitions"][0], **{"from": []})]),
            ("transitions", [dict(MACHINE["transitions"][0], **{"from": "accept"})]),
            ("transitions", [dict(MACHINE["transitions"][0], read="2")]),
            ("transitions", [dict(MACHINE["transitions"][0], write="2")]),
            ("transitions", [dict(MACHINE["transitions"][0], to="missing")]),
            ("transitions", [dict(MACHINE["transitions"][0], move="X")]),
            ("transitions", [MACHINE["transitions"][0]] * 2),
        ]:
            with self.subTest(key=key, value=value), self.assertRaises(ConfigError):
                parse_config(dict(MACHINE, **{key: value}))
        for key in MACHINE:
            data = copy.deepcopy(MACHINE)
            del data[key]
            with self.subTest(missing=key), self.assertRaises(ConfigError):
                parse_config(data)

    def test_invalid_wrappers(self):
        for data in ([], None, {"presets": []}, {"presets": {}}, {"presets": [EVEN, EVEN]},
                     dict(EVEN, machine=None), dict(EVEN, name=[]), dict(EVEN, id=" "),
                     dict(EVEN, default_input=0), dict(EVEN, description=False),
                     dict(EVEN, max_steps=True), dict(EVEN, max_steps=0),
                     dict(EVEN, max_steps=1.5), dict(EVEN, max_steps=2**53),
                     dict(EVEN, examples=[None]), dict(EVEN, examples=[{"input": "0", "expected_steps": -1}])):
            with self.subTest(data=data), self.assertRaises(ConfigError):
                parse_config(data)

    def test_invalid_json(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "broken.json"
            for body in ("{oops", '{"max_steps": NaN}'):
                path.write_text(body, encoding="utf-8")
                with self.assertRaisesRegex(ConfigError, "Could not read JSON"):
                    load_config(path)


class ExecutionTests(unittest.TestCase):
    def test_tape_expansion_and_erasure(self):
        tape = Tape("_", "01")
        self.assertEqual(tape.read(-10), "_")
        tape.write(-2, "1")
        tape.write(3, "0")
        self.assertEqual(tape.bounds(), (-2, 3))
        self.assertEqual(tape.contents(), "1_01_0")
        tape.write(-2, "_")
        self.assertEqual(tape.bounds(), (0, 3))

    def test_step_and_reset(self):
        preset = load_config(ROOT / "presets.json")[0]
        sim = Simulator(preset.definition, "1")
        records = [sim.step() for _ in range(4)]
        self.assertEqual([(r.move, r.head_after) for r in records], [("R", 1), ("L", 0), ("L", -1), ("S", -1)])
        self.assertEqual(sim.tape.contents(), "10")
        self.assertIsNone(sim.step())
        sim.reset()
        self.assertEqual((sim.status, sim.steps, sim.head, sim.tape.contents(), sim.history),
                         (Status.READY, 0, 0, "1", []))

    def test_terminal_precedes_limit_and_can_be_initial(self):
        for state, expected in [("even", Status.ACCEPTED), ("accept", Status.ACCEPTED), ("reject", Status.REJECTED)]:
            with self.subTest(state=state):
                definition = parse_config(dict(MACHINE, start_state=state))[0].definition
                sim = Simulator(definition, "", 1)
                self.assertEqual(sim.run(), expected)
                self.assertEqual(sim.steps, int(state == "even"))

    def test_examples(self):
        cases = [
            ("accepted_even_ones", Status.ACCEPTED, 5), ("rejected_odd_ones", Status.REJECTED, 5),
            ("undefined_transition", Status.NO_TRANSITION, 0), ("loop_protection", Status.MAX_STEPS, 10),
        ]
        for name, status, steps in cases:
            with self.subTest(name=name):
                preset = load_config(EXAMPLES / (name + ".json"))[0]
                sim = Simulator(preset.definition, preset.default_input, preset.max_steps)
                self.assertEqual((sim.run(), sim.steps, len(sim.history)), (status, steps, steps))
        invalid = load_config(EXAMPLES / "invalid_input.json")[0]
        for value in (invalid.default_input, None, ["0"]):
            with self.assertRaises(InputError):
                Simulator(invalid.definition, value)
        with self.assertRaisesRegex(ConfigError, "one of L, R, S"):
            load_config(EXAMPLES / "invalid_definition.json")


class CLITests(unittest.TestCase):
    def cli(self, *args, stdin=""):
        return subprocess.run([sys.executable, "-B", "-m", "tm", *args], cwd=ROOT, input=stdin,
                              capture_output=True, encoding="utf-8", timeout=10)

    def test_list(self):
        result = self.cli("--list")
        self.assertEqual(result.returncode, 0, result.stderr)
        for preset in ("binary-increment", "unary-multiplication", "w-hash-w", "busy-beaver-3", "busy-beaver-4"):
            self.assertIn(preset, result.stdout)

    def test_step_and_run(self):
        step = self.cli("-p", "binary-increment", "-i", "111", "-m", "step", "-d", "0",
                        stdin="\nr\n")
        self.assertEqual(step.returncode, 0, step.stderr)
        for token in ("^", "head =", "Step    1", "ACCEPTED", "1000"):
            self.assertIn(token, step.stdout)
        run = self.cli("-p", "binary-increment", "-i", "1011", "-m", "run", "-d", "0")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("1100", run.stdout)

    def test_custom_and_errors(self):
        for name, code, label in [
            ("accepted_even_ones", 0, "ACCEPTED"),
            ("rejected_odd_ones", 1, "REJECTED"),
            ("undefined_transition", 1, "UNDEFINED TRANSITION"),
            ("loop_protection", 3, "STEP LIMIT REACHED"),
            ("invalid_input", 2, "INVALID INPUT"),
            ("invalid_definition", 2, "one of L, R, S"),
        ]:
            with self.subTest(name=name):
                path = str(EXAMPLES / (name + ".json"))
                args = ["-c", path, "--final-only"]
                result = self.cli(*args, stdin="\n")
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertIn(label, result.stdout + result.stderr)
        for option, value in [("-n", "0"), ("-d", "nan"), ("-d", "-1")]:
            self.assertEqual(self.cli("-p", "1", "-i", "0", "--final-only", option, value).returncode, 2)

    def test_trace(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "trace.txt"
            result = self.cli("-p", "1", "-i", "111", "--final-only", "--trace-file", str(path))
            self.assertEqual(result.returncode, 0, result.stderr)
            trace = path.read_text(encoding="utf-8")
            self.assertEqual(trace.count("Applied:"), 8)
            self.assertIn("ACCEPTED", trace)
