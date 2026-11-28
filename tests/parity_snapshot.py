"""Read shared test scenarios from stdin and emit Python execution snapshots."""
import json
import sys

from tm import ConfigError, InputError, Simulator
from tm.presets import parse_config


def snapshot(case):
    try:
        preset = parse_config(case["config"])[case.get("index", 0)]
        sim = Simulator(preset.definition, case.get("input", preset.default_input), preset.max_steps)
    except ConfigError:
        return "invalid_configuration"
    except InputError:
        return "invalid_input"
    sim.run()
    return [sim.status.value, sim.tape.contents(), sim.state, sim.steps, sim.head, sim.tape.bounds()]


if __name__ == "__main__":
    json.dump([snapshot(case) for case in json.load(sys.stdin)], sys.stdout)
