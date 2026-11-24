/* Controller: connects the engine (TM), the renderers (UI) and the page. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { Simulator, ConfigError, parseConfig, fmtTransition } = window.TM;

  const SPEEDS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 500];          // steps per second
  const MAX_STEPS_CAP = 100000;

  const el = {
    preset: $("preset-select"), desc: $("preset-desc"), input: $("input-string"), hint: $("input-hint"),
    examples: $("examples"), maxSteps: $("max-steps"), upload: $("btn-upload"), file: $("file-input"),
    tuple: $("tuple"), deltaBody: $("delta-body"), deltaWrap: $("delta-wrap"),
    stats: { state: $("stat-state"), step: $("stat-step"), head: $("stat-head"), status: $("stat-status") },
    tape: { viewport: $("tape-viewport"), track: $("tape-track") },
    play: $("btn-play"), step: $("btn-step"), ff: $("btn-ff"), reset: $("btn-reset"),
    speed: $("speed"), speedLabel: $("speed-label"), follow: $("follow"),
    result: $("result"), alert: $("alert"), theme: $("btn-theme"), exportBtn: $("btn-export"),
    trace: { body: $("trace-body"), wrap: $("trace-wrap"), count: $("trace-count"), dropped: 0 },
  };

  const app = { presets: [], preset: null, sim: null, playing: false, timer: null, lastRec: null, animMs: 450 };

  /* state diagram (see diagram.js) */
  const diagram = new Diagram($("diagram-viewport"), $("diagram"));
  diagram.onFitChange = (fit) => { $("btn-zoom").textContent = fit ? "⤢ Fit" : "⤢ 1:1"; };

  /* ------------------------------------------------------------- messages */
  function showAlert(html) { el.alert.innerHTML = html; el.alert.classList.remove("hidden"); }
  function hideAlert() { el.alert.classList.add("hidden"); el.alert.innerHTML = ""; }

  /* ------------------------------------------------------------- presets */
  function fillSelect(customCount) {
    const option = (p, i) => `<option value="${i}">${UI.esc(p.name)}</option>`;
    const builtin = app.presets.slice(0, app.presets.length - customCount);
    const custom = app.presets.slice(app.presets.length - customCount);
    let html = `<optgroup label="Built-in presets">${builtin.map((p, i) => option(p, i)).join("")}</optgroup>`;
    if (custom.length) html += `<optgroup label="Custom (loaded from file)">${custom.map((p, i) => option(p, builtin.length + i)).join("")}</optgroup>`;
    el.preset.innerHTML = html;
  }

  async function loadBuiltIn() {
    try {
      const res = await fetch("../presets.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      app.presets = parseConfig(await res.json());
      fillSelect(0);
      selectPreset(0);
    } catch (err) {
      if (err instanceof ConfigError) { showAlert("<b>presets.json is invalid:</b>\n" + UI.esc(err.errors.join("\n"))); return; }
      showAlert(
        "<b>Could not load <code>presets.json</code>.</b>\nBrowsers block file access when the page is opened directly from disk. " +
        "Start the bundled server with <code>python serve.py</code> (from the project root) and open the address it prints — " +
        "or click <b>Load JSON…</b> and choose <code>presets.json</code> manually.");
      el.preset.innerHTML = "<option>No machine loaded</option>";
      updateControls();
    }
  }

  function selectPreset(index) {
    app.preset = app.presets[index];
    const p = app.preset;
    el.preset.value = String(index);
    el.desc.textContent = p.description;
    el.input.value = p.defaultInput;
    el.maxSteps.value = p.maxSteps;
    el.examples.innerHTML = p.examples.map((e, i) =>
      `<button class="chip" data-i="${i}" title="Expected: ${UI.esc(e.expected)}">${e.input === "" ? "(empty)" : UI.esc(e.input)}</button>`).join("");
    UI.renderTuple(p.definition, el.tuple);
    UI.renderDelta(p.definition, el.deltaBody);
    diagram.build(p.definition);
    initSim();
  }

  /* --------------------------------------------------------- simulation */
  function readMaxSteps() {
    const n = Number(el.maxSteps.value);
    return Number.isInteger(n) && n >= 1 && n <= MAX_STEPS_CAP ? n : null;
  }

  function initSim() {
    pause();
    UI.hideResult(el.result);
    UI.clearTrace(el.trace);
    app.lastRec = null;
    app.sim = null;
    const def = app.preset && app.preset.definition;
    if (!def) { render(); return; }

    const text = el.input.value;
    const bad = def.invalidSymbols(text);
    const max = readMaxSteps();
    el.input.classList.toggle("invalid", bad.length > 0);
    el.maxSteps.classList.toggle("invalid", max === null);

    if (bad.length) {
      const shown = [...new Set(bad.map((b) => `'${b.symbol}'`))].join(", ");
      setHint(`✗ ${shown} not in Σ = { ${def.sigma.join(", ")} } (first at position ${bad[0].index}).`, "error");
    } else if (max === null) {
      setHint(`✗ N_max must be an integer between 1 and ${MAX_STEPS_CAP}.`, "error");
    } else {
      setHint(`✓ Valid string over Σ = { ${def.sigma.join(", ")} }.`, "ok");
      app.sim = new Simulator(def, text, max);
      UI.traceInitial(el.trace, app.sim);
    }
    if (def) diagram.reset(def.start);
    render();
  }

  function setHint(msg, kind) { el.hint.textContent = msg; el.hint.className = "hint " + kind; }

  function render(writtenIndex) {
    const sim = app.sim;
    UI.renderStats(sim, el.stats);
    if (sim) {
      const fast = SPEEDS[el.speed.value - 1] > 6;
      UI.renderTape(sim, el.tape, { follow: el.follow.checked, smooth: !(app.playing && fast), writtenIndex });
      UI.highlightDelta(sim, el.deltaBody, el.deltaWrap, app.lastRec && app.lastRec.transition);
    } else {
      el.tape.track.innerHTML = "";
      UI.highlightDelta(null, el.deltaBody, el.deltaWrap, null);
    }
    UI.updateTraceCount(el.trace, sim);
    updateControls();
  }

  function updateControls() {
    const can = !!app.sim && !app.sim.halted;
    el.play.disabled = !can;
    el.step.disabled = !can || app.playing;
    el.ff.disabled = !can;
    el.reset.disabled = !app.sim;
    el.exportBtn.disabled = !app.sim || app.sim.steps === 0;
    el.play.textContent = app.playing ? "⏸ Pause" : "▶ Play";
    el.play.classList.toggle("playing", app.playing);
  }

  /** Executes one transition and updates the trace. Returns true if the machine is still running. */
  function advance() {
    const sim = app.sim;
    const rec = sim.step();
    if (rec) {
      UI.traceStep(el.trace, rec, fmtTransition);
      app.lastRec = rec;
      if (app.animMs >= 0) diagram.fire(rec, app.animMs);   // -1 = skip diagram (run to end)
    }
    if (sim.halted) { finish(); return false; }
    return true;
  }

  function finish() {
    pause();
    UI.traceFinal(el.trace, app.sim);
    UI.showResult(app.sim, el.result);
    diagram.markHalt(app.sim);
  }

  function stepOnce() {
    if (!app.sim || app.sim.halted) return;
    app.animMs = 450;
    advance();
    render(app.lastRec ? app.lastRec.headBefore : undefined);
  }

  /* ------------------------------------------------------------- playback */
  function speedInfo() {
    const sps = SPEEDS[el.speed.value - 1];
    const delay = Math.max(16, Math.round(1000 / sps));
    return { sps, delay, perTick: Math.max(1, Math.round((sps * delay) / 1000)) };
  }

  function play() {
    if (!app.sim || app.sim.halted) return;
    app.playing = true;
    updateControls();
    tick();
  }
  function pause() {
    app.playing = false;
    clearTimeout(app.timer);
    if (app.sim) updateControls();
  }
  function tick() {
    if (!app.playing) return;
    const { delay, perTick } = speedInfo();
    app.animMs = perTick > 1 ? 0 : Math.min(600, Math.round(delay * 0.8));
    for (let i = 0; i < perTick; i++) if (!advance()) break;
    render(app.lastRec ? app.lastRec.headBefore : undefined);
    if (app.playing) app.timer = setTimeout(tick, delay);
  }

  function runToEnd() {
    if (!app.sim || app.sim.halted) return;
    pause();
    app.animMs = -1;
    while (advance()) { /* keep going until it halts or hits N_max */ }
    diagram.reset(app.sim.state);
    diagram.markHalt(app.sim);
    app.animMs = 450;
    render();
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* --------------------------------------------------------------- events */
  el.preset.addEventListener("change", () => { hideAlert(); selectPreset(Number(el.preset.value)); });
  el.input.addEventListener("input", initSim);
  el.maxSteps.addEventListener("input", initSim);
  el.examples.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    el.input.value = app.preset.examples[Number(chip.dataset.i)].input;
    initSim();
  });
  el.play.addEventListener("click", () => (app.playing ? pause() : play()));
  el.step.addEventListener("click", stepOnce);
  el.ff.addEventListener("click", runToEnd);
  el.reset.addEventListener("click", initSim);
  el.follow.addEventListener("change", () => render());
  $("btn-zoom").addEventListener("click", () => diagram.setFit(!diagram.fit));
  el.speed.addEventListener("input", () => { el.speedLabel.textContent = SPEEDS[el.speed.value - 1] + " steps/s"; });
  el.exportBtn.addEventListener("click", () => download("turing-trace.txt", UI.traceToText(app.sim, fmtTransition)));

  el.upload.addEventListener("click", () => el.file.click());
  el.file.addEventListener("change", async () => {
    const file = el.file.files[0];
    el.file.value = "";
    if (!file) return;
    try {
      const loaded = parseConfig(JSON.parse(await file.text()));
      const firstNew = app.presets.length;
      app.customCount = (app.customCount || 0) + loaded.length;
      app.presets = app.presets.concat(loaded);
      fillSelect(app.customCount);
      hideAlert();
      selectPreset(firstNew);
    } catch (err) {
      const msg = err instanceof ConfigError ? err.errors.join("\n") : err instanceof SyntaxError ? "Not valid JSON: " + err.message : String(err);
      showAlert(`<b>Could not load ${UI.esc(file.name)}:</b>\n` + UI.esc(msg));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input[type=text], input[type=number], select")) return;
    if (e.code === "Space") { e.preventDefault(); if (!el.play.disabled) el.play.click(); }
    else if (e.key === "ArrowRight") { if (!el.step.disabled) stepOnce(); }
    else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) initSim();
  });

  /* ---------------------------------------------------------------- theme */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("tm-theme", t); } catch (_) { /* storage may be unavailable */ }
  }
  el.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  try { const saved = localStorage.getItem("tm-theme"); if (saved) setTheme(saved); } catch (_) { /* ignore */ }

  /* ---------------------------------------------------------------- start */
  el.speedLabel.textContent = SPEEDS[el.speed.value - 1] + " steps/s";
  loadBuiltIn();
})();