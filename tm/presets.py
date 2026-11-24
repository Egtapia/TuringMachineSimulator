"""Loading preset / custom machine configurations from JSON files."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from .definition import ConfigError, MachineDefinition

DEFAULT_PRESETS_PATH = Path(__file__).resolve().parent.parent / "presets.json"
DEFAULT_MAX_STEPS = 10_000


@dataclass
class Preset:
    id: str
    name: str
    description: str
    definition: MachineDefinition
    max_steps: int = DEFAULT_MAX_STEPS
    default_input: str = ""
    examples: List[dict] = field(default_factory=list)


def _parse_preset(data: dict, index: int) -> Preset:
    if not isinstance(data, dict):
        raise ConfigError([f"presets[{index}] must be an object."])
    machine = data["machine"] if "machine" in data else data
    name = str(data.get("name", f"Machine {index + 1}"))
    try:
        definition = MachineDefinition.from_dict(machine, name)
    except ConfigError as exc:
        raise ConfigError([f"[{name}] {e}" for e in exc.errors]) from None
    max_steps = data.get("max_steps", DEFAULT_MAX_STEPS)
    if not isinstance(max_steps, int) or max_steps < 1:
        raise ConfigError([f"[{name}] 'max_steps' must be a positive integer."])
    return Preset(
        id=str(data.get("id", f"custom-{index + 1}")),
        name=name,
        description=str(data.get("description", "")),
        definition=definition,
        max_steps=max_steps,
        default_input=str(data.get("default_input", "")),
        examples=list(data.get("examples", [])),
    )


def load_config(path) -> List[Preset]:
    """Load a JSON file. It can contain:

    * {"presets": [ {...}, ... ]}   several machines (like presets.json)
    * {"machine": {...}, ...}       one machine with metadata
    * {"states": [...], ...}        a bare machine definition
    """
    path = Path(path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ConfigError([f"File not found: {path}"]) from None
    except json.JSONDecodeError as exc:
        raise ConfigError([f"{path.name} is not valid JSON: {exc}"]) from None

    if isinstance(data, dict) and "presets" in data:
        items = data["presets"]
        if not isinstance(items, list):
            raise ConfigError(["'presets' must be a list."])
    elif isinstance(data, dict):
        items = [data]
    else:
        raise ConfigError(["The top-level JSON value must be an object."])
    return [_parse_preset(item, i) for i, item in enumerate(items)]


def load_presets(path=DEFAULT_PRESETS_PATH) -> List[Preset]:
    return load_config(path)