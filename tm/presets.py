"""Load built-in presets and custom JSON machine definitions."""
from dataclasses import dataclass
import json
from pathlib import Path

from .definition import ConfigError, MAX_SAFE_STEPS, MachineDefinition


@dataclass
class Preset:
    id: str
    name: str
    description: str
    definition: MachineDefinition
    max_steps: int
    default_input: str
    examples: list


def parse_config(data):
    """Parse a bare definition, a machine wrapper, or a preset collection."""
    if not isinstance(data, dict):
        raise ConfigError(["The top-level JSON value must be an object."])
    items = data.get("presets", [data])
    if not isinstance(items, list) or not items:
        raise ConfigError(["'presets' must be a non-empty list."])
    presets = []
    for index, item in enumerate(items, 1):
        if not isinstance(item, dict):
            raise ConfigError([f"Preset {index} must be an object."])
        location = f"Preset {index}"
        values = {}
        for field, default in (
            ("id", f"custom-{index}"), ("name", f"Machine {index}"),
            ("description", ""), ("default_input", ""),
        ):
            value = item.get(field, default)
            if not isinstance(value, str) or (field in ("id", "name") and not value.strip()):
                raise ConfigError([f"{location}: '{field}' must be a valid string."])
            values[field] = value
        name = values["name"]
        max_steps = item.get("max_steps", 10_000)
        if (type(max_steps) not in (int, float) or not 1 <= max_steps <= MAX_SAFE_STEPS
                or int(max_steps) != max_steps):
            raise ConfigError([f"[{name}] 'max_steps' must be a positive safe integer."])
        examples = item.get("examples", [])
        if not isinstance(examples, list):
            raise ConfigError([f"[{name}] 'examples' must be a list."])
        for number, example in enumerate(examples, 1):
            if (not isinstance(example, dict) or not isinstance(example.get("input"), str)
                    or any(key in example and not isinstance(example[key], str)
                           for key in ("expected", "expected_tape"))):
                raise ConfigError([f"[{name}] Example {number} must have a string input and string result fields."])
            if "expected_steps" in example:
                steps = example["expected_steps"]
                if (type(steps) not in (int, float) or not 0 <= steps <= MAX_SAFE_STEPS
                        or int(steps) != steps):
                    raise ConfigError([f"[{name}] Example {number}: invalid 'expected_steps'."])
        try:
            definition = MachineDefinition.from_dict(item.get("machine", item), name)
        except ConfigError as exc:
            raise ConfigError([f"[{name}] {error}" for error in exc.errors]) from exc
        presets.append(Preset(**values, definition=definition, max_steps=int(max_steps), examples=examples))
    if len({preset.id for preset in presets}) != len(presets):
        raise ConfigError(["Preset IDs must be unique within a collection."])
    return presets


def _reject_constant(value):
    raise ValueError(f"{value} is not a JSON number")


def load_config(path):
    """Read and validate a UTF-8 configuration file."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8-sig"), parse_constant=_reject_constant)
    except (OSError, ValueError, RecursionError) as exc:
        raise ConfigError([f"Could not read JSON from {path}: {exc}"]) from exc
    return parse_config(data)


def load_presets():
    """Load the shared configuration independently of the working directory."""
    return load_config(Path(__file__).resolve().parent.parent / "presets.json")
