import unittest

from tm import InputError, Simulator, Status, load_presets


class PresetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.presets = {preset.id: preset for preset in load_presets()}

    def simulate(self, preset_id, text):
        preset = self.presets[preset_id]
        sim = Simulator(preset.definition, text, preset.max_steps)
        sim.run()
        return sim

    def test_increment(self):
        for value in range(200):
            with self.subTest(value=value):
                sim = self.simulate("binary-increment", format(value, "b"))
                self.assertEqual((sim.status, sim.tape.contents()), (Status.ACCEPTED, format(value + 1, "b")))
        sim = self.simulate("binary-increment", "")
        self.assertEqual((sim.status, sim.tape.contents(), sim.steps, sim.head), (Status.ACCEPTED, "1", 2, -1))
        with self.assertRaises(InputError):
            self.simulate("binary-increment", "1012")

    def test_multiplication(self):
        for a in range(6):
            for b in range(6):
                text = "1" * a + "*" + "1" * b
                with self.subTest(a=a, b=b):
                    sim = self.simulate("unary-multiplication", text)
                    self.assertEqual((sim.status, sim.tape.contents()), (Status.ACCEPTED, text + "=" + "1" * (a * b)))
        for text in ("1**1", "11"):
            self.assertEqual(self.simulate("unary-multiplication", text).status, Status.NO_TRANSITION)
        with self.assertRaises(InputError):
            self.simulate("unary-multiplication", "2*3")

    def test_language(self):
        for expected, inputs in [
            (Status.ACCEPTED, ("01#01", "0110#0110", "#")),
            (Status.REJECTED, ("01#10", "01#011", "011#01", "")),
            (Status.NO_TRANSITION, ("01", "01##01")),
        ]:
            for text in inputs:
                with self.subTest(text=text):
                    self.assertEqual(self.simulate("w-hash-w", text).status, expected)

    def test_busy_beavers(self):
        for states, steps, ones in [(3, 13, 6), (4, 107, 13)]:
            with self.subTest(states=states):
                sim = self.simulate(f"busy-beaver-{states}", "")
                self.assertEqual((sim.status, sim.steps, sim.tape.contents().count("1")), (Status.ACCEPTED, steps, ones))
