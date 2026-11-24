/* Rendering helpers: pure DOM code, no simulation logic. Exposes window.UI. */
(function (root) {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAX_TRACE_ROWS = 1000;
  const TAPE_MARGIN = 12;       // blank cells always shown beyond the used region
  const TAPE_RADIUS = 150;      // never draw more than this many cells around the head

  const STATUS_TEXT = {
    ready: "Ready", running: "Running", accepted: "Accepted", rejected: "Rejected",
    no_transition: "No transition", max_steps: "Step limit",
  };
  const RESULT_VIEW = {
    accepted: { icon: "✅", title: "Accepted" },
    rejected: { icon: "⛔", title: "Rejected" },
    no_transition: { icon: "⚠️", title: "Rejected - undefined transition" },
    max_steps: { icon: "♾️", title: "Step limit reached (possible infinite loop)" },
  };

  /* ------------------------------------------------------------------ tape */
  function renderTape(sim, els, opts) {
    const { head, tape } = sim;
    const b = tape.bounds();
    let lo = (b ? Math.min(b[0], head) : head) - TAPE_MARGIN;
    let hi = (b ? Math.max(b[1], head) : head) + TAPE_MARGIN;
    lo = Math.max(lo, head - TAPE_RADIUS);
    hi = Math.min(hi, head + TAPE_RADIUS);

    let html = "";
    for (let i = lo; i <= hi; i++) {
      const sym = tape.read(i);
      const cls = ["cell"];
      if (sym === tape.blank) cls.push("blank");
      if (i === head) cls.push("head");
      if (i === opts.writtenIndex) cls.push("written");
      if (i < lo + 3 || i > hi - 3) cls.push("edge");
      html += `<div class="${cls.join(" ")}" data-i="${i}"><span class="sym">${esc(sym)}</span><span class="idx">${i}</span>`;
      if (i === head) html += `<div class="head-marker"><span class="pill">${esc(sim.state)}</span><span class="arrow">▼</span></div>`;
      html += "</div>";
    }
    els.track.innerHTML = html;

    if (opts.follow) {
      const target = els.track.querySelector(".cell.head");
      if (target) {
        const vp = els.viewport;
        vp.style.scrollBehavior = opts.smooth ? "smooth" : "auto";
        vp.scrollLeft = target.offsetLeft - vp.clientWidth / 2 + target.offsetWidth / 2;
      }
    }
  }

  /* ----------------------------------------------------------------- stats */
  function renderStats(sim, els) {
    els.state.textContent = sim ? sim.state : "–";
    els.step.textContent = sim ? sim.steps : 0;
    els.head.textContent = sim ? sim.head : 0;
    const status = sim ? sim.status : "ready";
    els.status.textContent = STATUS_TEXT[status];
    els.status.className = "badge " + status;
  }

  /* ------------------------------------------------------ formal definition */
  function renderTuple(def, el) {
    const set = (xs) => "{ " + xs.map(esc).join(", ") + " }";
    const rows = [
      ["Q", set(def.states)], ["Σ", set(def.sigma)], ["Γ", set(def.gamma)],
      ["δ", `${def.delta.size} transitions (table below)`],
      ["q₀", esc(def.start)], ["q_accept", esc(def.accept)], ["q_reject", esc(def.reject)], ["blank", esc(def.blank)],
    ];
    el.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  function renderDelta(def, tbody) {
    tbody.innerHTML = def.transitionList().map((t) =>
      `<tr data-k="${esc(t.state)}\u0000${esc(t.read)}"><td>${esc(t.state)}</td><td>${esc(t.read)}</td><td>→</td>` +
      `<td>${esc(t.next)}</td><td>${esc(t.write)}</td><td>${esc(t.move)}</td></tr>`).join("");
  }

  /** Highlights the transition that will run next, and the one that just ran. */
  function highlightDelta(sim, tbody, wrap, lastTransition) {
    tbody.querySelectorAll("tr.next, tr.applied").forEach((r) => r.classList.remove("next", "applied"));
    const mark = (t, cls) => {
      if (!t) return null;
      const row = [...tbody.rows].find((r) => r.cells[0].textContent === t.state && r.cells[1].textContent === t.read);
      if (row) row.classList.add(cls);
      return row;
    };
    mark(lastTransition, "applied");
    const next = sim && !sim.halted ? sim.definition.getTransition(sim.state, sim.currentSymbol) : null;
    const row = mark(next, "next");
    if (row) wrap.scrollTop = Math.max(0, row.offsetTop - wrap.clientHeight / 2);
  }

  /* ----------------------------------------------------------------- trace */
  function clearTrace(els) {
    els.body.innerHTML = "";
    els.count.textContent = "";
    els.dropped = 0;
  }

  function addTraceRow(els, cells, cls) {
    const last = els.body.querySelector("tr.latest");
    if (last) last.classList.remove("latest");
    const tr = document.createElement("tr");
    tr.className = (cls || "") + " latest";
    tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
    els.body.appendChild(tr);
    while (els.body.rows.length > MAX_TRACE_ROWS) { els.body.deleteRow(0); els.dropped = (els.dropped || 0) + 1; }
    els.wrap.scrollTop = els.wrap.scrollHeight;
  }

  function traceInitial(els, sim) {
    addTraceRow(els, ["0", esc(sim.state), "initial configuration"]);
  }
  function traceStep(els, rec, fmt) {
    addTraceRow(els, [rec.step, `${esc(rec.stateBefore)} → ${esc(rec.stateAfter)}`, esc(fmt(rec.transition))]);
  }
  function traceFinal(els, sim) {
    addTraceRow(els, ["■", esc(sim.state), esc(sim.message)], "final-" + sim.status);
  }
  function updateTraceCount(els, sim) {
    const dropped = els.dropped || 0;
    els.count.textContent = sim ? `(${sim.steps} steps${dropped ? `, showing last ${MAX_TRACE_ROWS}` : ""})` : "";
  }

  /* ---------------------------------------------------------------- result */
  function showResult(sim, el) {
    const v = RESULT_VIEW[sim.status];
    el.className = "result " + sim.status;
    el.innerHTML = `<span class="icon">${v.icon}</span><div><h3>${v.title}</h3>` +
      `<p>${esc(sim.message)} · ${sim.steps} steps · tape: <code>${esc(sim.tape.contents() || "(empty)")}</code></p></div>`;
  }
  function hideResult(el) { el.className = "result hidden"; el.innerHTML = ""; }

  function traceToText(sim, fmt) {
    const d = sim.definition;
    const lines = [
      `Trace report - ${d.name}`, `Input: ${JSON.stringify(sim.input)}   N_max: ${sim.maxSteps}`, "",
      `Step    0 | state ${d.start} | initial configuration`,
    ];
    sim.history.forEach((r) => lines.push(
      `Step ${String(r.step).padStart(4)} | ${r.stateBefore} -> ${r.stateAfter} | head ${r.headBefore} -> ${r.headAfter} | ${fmt(r.transition)}`));
    lines.push("", `Result: ${STATUS_TEXT[sim.status]} - ${sim.message}`, `Steps: ${sim.steps}`,
      `Final state: ${sim.state}`, `Tape: ${sim.tape.contents() || "(empty)"}`);
    return lines.join("\n");
  }

  root.UI = { esc, renderTape, renderStats, renderTuple, renderDelta, highlightDelta, clearTrace, traceInitial, traceStep,
              traceFinal, updateTraceCount, showResult, hideResult, traceToText };
})(window);