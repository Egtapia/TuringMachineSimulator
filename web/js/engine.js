/* Turing machine engine (no dependencies). Mirrors the Python package in /tm.
 *
 *   M = (Q, Σ, Γ, δ, q0, q_accept, q_reject)
 *
 * Exposes a single global: window.TM  (also module.exports under Node, for testing).
 */
(function (root) {
  "use strict";

  const MOVES = ["L", "R", "S"];
  const MOVE_DELTA = { L: -1, R: 1, S: 0 };

  const Status = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    NO_TRANSITION: "no_transition",   // δ undefined -> implicit rejection
    MAX_STEPS: "max_steps",           // N_max reached
  });
  const HALTED = new Set([Status.ACCEPTED, Status.REJECTED, Status.NO_TRANSITION, Status.MAX_STEPS]);

  class ConfigError extends Error {
    constructor(errors) {
      super("Invalid machine definition:\n  - " + errors.join("\n  - "));
      this.name = "ConfigError";
      this.errors = errors;
    }
  }

  class InputError extends Error {
    constructor(message, invalid) {
      super(message);
      this.name = "InputError";
      this.invalid = invalid;         // [{index, symbol}, ...]
    }
  }

  const isString = (x) => typeof x === "string";
  const isSymbol = (x) => isString(x) && [...x].length === 1;
  const key = (state, symbol) => state + "\u0000" + symbol;
  const fmtTransition = (t) => `δ(${t.state}, ${t.read}) → (${t.next}, ${t.write}, ${t.move})`;

  /* ------------------------------------------------------------------ Tape */
  class Tape {
    constructor(blank, contents) {
      this.blank = blank;
      this.cells = new Map();
      [...(contents || "")].forEach((s, i) => this.write(i, s));
    }
    read(pos) { return this.cells.has(pos) ? this.cells.get(pos) : this.blank; }
    write(pos, symbol) {
      if (symbol === this.blank) this.cells.delete(pos);
      else this.cells.set(pos, symbol);
    }
    bounds() {
      if (this.cells.size === 0) return null;
      let lo = Infinity, hi = -Infinity;
      for (const i of this.cells.keys()) { if (i < lo) lo = i; if (i > hi) hi = i; }
      return [lo, hi];
    }
    contents() {
      const b = this.bounds();
      if (!b) return "";
      let out = "";
      for (let i = b[0]; i <= b[1]; i++) out += this.read(i);
      return out;
    }
    countNonBlank() { return this.cells.size; }
  }

  /* ------------------------------------------------------- MachineDefinition */
  class MachineDefinition {
    constructor(f) { Object.assign(this, f); }

    static fromObject(data, name = "Unnamed machine") {
      if (data === null || typeof data !== "object" || Array.isArray(data))
        throw new ConfigError(["Machine definition must be a JSON object."]);
      const errors = [];

      const stringList = (k, singleChar) => {
        const v = data[k];
        if (!Array.isArray(v) || !v.every((x) => isString(x) && x.length > 0)) {
          errors.push(`'${k}' must be a list of non-empty strings.`);
          return [];
        }
        if (singleChar) v.filter((x) => !isSymbol(x)).forEach((x) => errors.push(`'${k}': symbol '${x}' must be exactly one character.`));
        const dups = [...new Set(v.filter((x, i) => v.indexOf(x) !== i))];
        if (dups.length) errors.push(`'${k}' contains duplicates: ${JSON.stringify(dups)}.`);
        return v;
      };

      const states = stringList("states", false);
      const sigma = stringList("input_alphabet", true);
      const gamma = stringList("tape_alphabet", true);

      let blank = data.blank === undefined ? "_" : data.blank;
      if (!isSymbol(blank)) { errors.push("'blank' must be a single character."); blank = "_"; }

      const stateField = (k) => {
        const v = data[k];
        if (!isString(v)) { errors.push(`'${k}' is required and must be a string.`); return ""; }
        if (states.length && !states.includes(v)) errors.push(`'${k}' = '${v}' is not in the set of states Q.`);
        return v;
      };
      const start = stateField("start_state");
      const accept = stateField("accept_state");
      const reject = stateField("reject_state");
      if (accept && accept === reject) errors.push("'accept_state' and 'reject_state' must be different.");

      if (gamma.length && !gamma.includes(blank)) errors.push(`The blank symbol '${blank}' must belong to the tape alphabet Γ.`);
      if (sigma.includes(blank)) errors.push(`The blank symbol '${blank}' must not belong to the input alphabet Σ.`);
      sigma.forEach((s) => { if (gamma.length && !gamma.includes(s)) errors.push(`Input symbol '${s}' (Σ) must also belong to Γ.`); });

      const delta = new Map();
      let raw = data.transitions;
      if (!Array.isArray(raw)) { errors.push("'transitions' must be a list of transition objects."); raw = []; }
      raw.forEach((item, i) => {
        const where = `transitions[${i}]`;
        if (item === null || typeof item !== "object") { errors.push(`${where}: must be an object with keys from/read/to/write/move.`); return; }
        const missing = ["from", "read", "to", "write", "move"].filter((k) => !(k in item));
        if (missing.length) { errors.push(`${where}: missing key(s) ${JSON.stringify(missing)}.`); return; }
        const t = { state: item.from, read: item.read, next: item.to, write: item.write, move: item.move };
        if (states.length && !states.includes(t.state)) errors.push(`${where}: unknown source state '${t.state}'.`);
        if (states.length && !states.includes(t.next)) errors.push(`${where}: unknown target state '${t.next}'.`);
        if (t.state === accept || t.state === reject) errors.push(`${where}: halting state '${t.state}' cannot have outgoing transitions.`);
        if (gamma.length && !gamma.includes(t.read)) errors.push(`${where}: read symbol '${t.read}' is not in Γ.`);
        if (gamma.length && !gamma.includes(t.write)) errors.push(`${where}: write symbol '${t.write}' is not in Γ.`);
        if (!MOVES.includes(t.move)) errors.push(`${where}: move '${t.move}' must be one of L, R, S.`);
        const k = key(t.state, t.read);
        if (delta.has(k)) errors.push(`${where}: duplicate transition for δ(${t.state}, ${t.read}) (machine must be deterministic).`);
        delta.set(k, t);
      });

      if (errors.length) throw new ConfigError(errors);
      return new MachineDefinition({ name, states, sigma, gamma, blank, start, accept, reject, delta });
    }

    getTransition(state, symbol) { return this.delta.get(key(state, symbol)) || null; }
    isHalting(state) { return state === this.accept || state === this.reject; }

    invalidSymbols(text) {
      const allowed = new Set(this.sigma);
      return [...text].map((symbol, index) => ({ index, symbol })).filter((x) => !allowed.has(x.symbol));
    }
    checkInput(text) {
      const bad = this.invalidSymbols(text);
      if (bad.length) {
        const extra = bad.length > 1 ? ` (${bad.length} invalid symbols in total)` : "";
        throw new InputError(`Symbol '${bad[0].symbol}' at position ${bad[0].index} is not in the input alphabet Σ = {${this.sigma.join(", ")}}${extra}.`, bad);
      }
    }
    transitionList() { return [...this.delta.values()]; }
  }

  /* -------------------------------------------------------------- Simulator */
  class Simulator {
    constructor(definition, input, maxSteps = 10000) {
      if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError("N_max must be a positive integer.");
      definition.checkInput(input);
      this.definition = definition;
      this.input = input;
      this.maxSteps = maxSteps;
      this.reset();
    }
    reset() {
      const d = this.definition;
      this.tape = new Tape(d.blank, this.input);
      this.head = 0;
      this.state = d.start;
      this.steps = 0;
      this.status = Status.READY;
      this.message = "";
      this.history = [];
      this._checkHalting();
    }
    get halted() { return HALTED.has(this.status); }
    get currentSymbol() { return this.tape.read(this.head); }

    _checkHalting() {
      const d = this.definition;
      if (this.state === d.accept) { this.status = Status.ACCEPTED; this.message = `Halted in accept state ${this.state}.`; }
      else if (this.state === d.reject) { this.status = Status.REJECTED; this.message = `Halted in reject state ${this.state}.`; }
      else if (this.steps >= this.maxSteps) {
        this.status = Status.MAX_STEPS;
        this.message = `Step limit N_max = ${this.maxSteps} reached - the machine may not terminate.`;
      }
    }

    /** Applies one transition. Returns the step record, or null if the machine has halted. */
    step() {
      if (this.halted) return null;
      const symbol = this.tape.read(this.head);
      const t = this.definition.getTransition(this.state, symbol);
      if (!t) {
        this.status = Status.NO_TRANSITION;
        this.message = `No transition defined for δ(${this.state}, ${symbol}) - implicit rejection.`;
        return null;
      }
      const record = {
        step: this.steps + 1, stateBefore: this.state, stateAfter: t.next,
        read: symbol, write: t.write, move: t.move,
        headBefore: this.head, headAfter: this.head + MOVE_DELTA[t.move], transition: t,
      };
      this.tape.write(this.head, t.write);
      this.head = record.headAfter;
      this.state = t.next;
      this.steps += 1;
      this.status = Status.RUNNING;
      this.history.push(record);
      this._checkHalting();
      return record;
    }

    /** Runs until the machine halts (or N_max). Returns the number of steps executed. */
    run() {
      const before = this.steps;
      while (!this.halted) this.step();
      return this.steps - before;
    }
  }

  /* ----------------------------------------------------------- Config files */
  const DEFAULT_MAX_STEPS = 10000;

  function parsePreset(data, index) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new ConfigError([`presets[${index}] must be an object.`]);
    const machine = "machine" in data ? data.machine : data;
    const name = String(data.name || `Machine ${index + 1}`);
    let definition;
    try { definition = MachineDefinition.fromObject(machine, name); }
    catch (e) { if (e instanceof ConfigError) throw new ConfigError(e.errors.map((m) => `[${name}] ${m}`)); throw e; }
    const maxSteps = data.max_steps === undefined ? DEFAULT_MAX_STEPS : data.max_steps;
    if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new ConfigError([`[${name}] 'max_steps' must be a positive integer.`]);
    return {
      id: String(data.id || `custom-${index + 1}`), name, description: String(data.description || ""),
      definition, maxSteps, defaultInput: String(data.default_input || ""), examples: Array.isArray(data.examples) ? data.examples : [],
    };
  }

  /** Accepts the parsed JSON of presets.json, a single preset, or a bare machine definition. */
  function parseConfig(data) {
    let items;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if ("presets" in data) {
        if (!Array.isArray(data.presets)) throw new ConfigError(["'presets' must be a list."]);
        items = data.presets;
      } else items = [data];
    } else throw new ConfigError(["The top-level JSON value must be an object."]);
    return items.map(parsePreset);
  }

  const api = { Status, ConfigError, InputError, Tape, MachineDefinition, Simulator, parseConfig, fmtTransition, DEFAULT_MAX_STEPS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TM = api;
})(typeof window !== "undefined" ? window : globalThis);
