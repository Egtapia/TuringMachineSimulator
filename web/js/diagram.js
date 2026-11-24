/* State diagram with animated transitions. Pure SVG, no dependencies. Exposes window.Diagram.
 *
 *   const d = new Diagram(viewportDiv, svgElement);
 *   d.build(machineDefinition);     // draw states + transitions (auto layout)
 *   d.reset(stateName);             // highlight a state, clear edge highlights
 *   d.fire(stepRecord, ms);         // animate a token along the edge that was just taken
 *   d.markHalt(simulator);          // colour the final state (accept / reject / stuck)
 */
(function (root) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const NODE_H = 34, ROW_GAP = 124, COL_GAP = 140;
  const MARGIN_X = 78, MARGIN_TOP = 92, MARGIN_BOTTOM = 60;
  const MAX_LABEL_LINES = 4;

  const svgEl = (name, attrs, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const ekey = (a, b) => a + "\u0000" + b;

  /** Point where the segment centre→target leaves the node rectangle. */
  function clip(node, target, gap) {
    const dx = target.x - node.x, dy = target.y - node.y;
    const hw = node.w / 2 + gap, hh = NODE_H / 2 + gap;
    const t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy), 1);
    return { x: node.x + dx * t, y: node.y + dy * t };
  }

  class Diagram {
    constructor(viewport, svg) {
      this.viewport = viewport;
      this.svg = svg;
      this.nodes = new Map();
      this.edges = new Map();
      this.fit = true;
      this.anim = null;
      this.size = { w: 0, h: 0 };
    }

    /* ------------------------------------------------------------- layout */
    _layout(def) {
      const adj = new Map(def.states.map((s) => [s, []]));
      def.transitionList().forEach((t) => { if (!adj.get(t.state).includes(t.next)) adj.get(t.state).push(t.next); });

      // BFS layers from the start state
      const layer = new Map([[def.start, 0]]);
      const queue = [def.start];
      while (queue.length) {
        const s = queue.shift();
        for (const n of adj.get(s)) if (!layer.has(n)) { layer.set(n, layer.get(s) + 1); queue.push(n); }
      }
      const halting = (s) => s === def.accept || s === def.reject;
      let maxLayer = 0;
      layer.forEach((l, s) => { if (!halting(s)) maxLayer = Math.max(maxLayer, l); });
      const lastLayer = maxLayer + 1;
      def.states.forEach((s) => {
        if (halting(s) && s !== def.start) layer.set(s, lastLayer);
        else if (!layer.has(s)) layer.set(s, maxLayer);          // unreachable states
      });

      const columns = [];
      for (let i = 0; i <= lastLayer; i++) columns.push([]);
      def.states.forEach((s) => columns[layer.get(s)].push(s));
      const last = columns[lastLayer];                            // accept above reject
      last.sort((a, b) => (a === def.accept ? -1 : b === def.accept ? 1 : 0));

      const width = (s) => Math.max(56, s.length * 7.6 + 24);
      const colW = columns.map((c) => c.reduce((m, s) => Math.max(m, width(s)), 0));
      const rows = Math.max(1, ...columns.map((c) => c.length));
      const midY = MARGIN_TOP + ((rows - 1) * ROW_GAP) / 2 + NODE_H / 2;

      let x = MARGIN_X;
      columns.forEach((col, ci) => {
        const cx = x + colW[ci] / 2;
        col.forEach((s, ri) => {
          const cy = midY + (ri - (col.length - 1) / 2) * ROW_GAP;
          this.nodes.set(s, { name: s, x: cx, y: cy, w: width(s), layer: ci });
        });
        x += colW[ci] + COL_GAP;
      });
      this.size = { w: x - COL_GAP + MARGIN_X, h: MARGIN_TOP + (rows - 1) * ROW_GAP + NODE_H + MARGIN_BOTTOM };
    }

    /* -------------------------------------------------------------- build */
    build(def) {
      this._finishAnim();
      this.def = def;
      this.nodes.clear();
      this.edges.clear();
      this.svg.innerHTML = "";
      this._layout(def);
      const { w, h } = this.size;
      this.natural = { w, h };
      this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const arrow = (id, cls) =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="${cls}" d="M0 0 L10 5 L0 10 z"/></marker>`;
      this.svg.insertAdjacentHTML("afterbegin", `<defs>${arrow("tm-arrow", "arrow-n")}${arrow("tm-arrow-a", "arrow-a")}</defs>`);

      const gEdges = svgEl("g"), gLabels = svgEl("g"), gNodes = svgEl("g"), gTop = svgEl("g");
      this.svg.append(gEdges, gLabels, gNodes, gTop);

      // group transitions per (from, to)
      const groups = new Map();
      def.transitionList().forEach((t) => {
        const k = ekey(t.state, t.next);
        if (!groups.has(k)) groups.set(k, { from: t.state, to: t.next, items: [] });
        groups.get(k).items.push(t);
      });

      groups.forEach((g, k) => {
        const a = this.nodes.get(g.from), b = this.nodes.get(g.to);
        let d, lx, ly;
        if (a === b) {
          const top = a.y - NODE_H / 2;
          d = `M ${a.x - 12} ${top} C ${a.x - 38} ${top - 50} ${a.x + 38} ${top - 50} ${a.x + 12} ${top}`;
          lx = a.x; ly = top - 44;
        } else {
          const hasReverse = groups.has(ekey(g.to, g.from));
          const dl = Math.abs(a.layer - b.layer);
          const back = b.layer < a.layer;
          const curv = Math.min(0.5, (hasReverse ? 0.26 : 0.1) + (back ? 0.12 : 0) + 0.07 * Math.max(0, dl - 1));
          const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
          const c = { x: (a.x + b.x) / 2 + (dy / dist) * curv * dist, y: (a.y + b.y) / 2 - (dx / dist) * curv * dist };
          const p0 = clip(a, c, 2), p2 = clip(b, c, 5);
          d = `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`;
          lx = 0.25 * p0.x + 0.5 * c.x + 0.25 * p2.x;
          ly = 0.25 * p0.y + 0.5 * c.y + 0.25 * p2.y;
        }
        const path = svgEl("path", { d, class: "edge", "marker-end": "url(#tm-arrow)" });
        gEdges.appendChild(path);

        const lines = g.items.map((t) => `${t.read}/${t.write},${t.move}`);
        const shown = lines.length > MAX_LABEL_LINES ? lines.slice(0, MAX_LABEL_LINES - 1).concat(`+${lines.length - MAX_LABEL_LINES + 1} more`) : lines;
        const text = svgEl("text", { class: "edge-label", x: lx, y: ly - ((shown.length - 1) * 6.5) + 4, "text-anchor": "middle" });
        shown.forEach((line, i) => text.appendChild(svgEl("tspan", { x: lx, dy: i === 0 ? 0 : 13 }, line)));
        text.appendChild(svgEl("title", {}, `${g.from} → ${g.to}\n` + lines.join("\n")));
        gLabels.appendChild(text);
        this.edges.set(k, { path, text, from: g.from, to: g.to });
      });

      // nodes
      this.nodes.forEach((n) => {
        const cls = ["node"];
        if (n.name === def.accept) cls.push("accept");
        if (n.name === def.reject) cls.push("reject");
        const g = svgEl("g", { class: cls.join(" "), transform: `translate(${n.x} ${n.y})` });
        if (n.name === def.accept) g.appendChild(svgEl("rect", { class: "ring", x: -n.w / 2 - 4, y: -NODE_H / 2 - 4, width: n.w + 8, height: NODE_H + 8, rx: NODE_H / 2 + 4 }));
        g.appendChild(svgEl("rect", { class: "body", x: -n.w / 2, y: -NODE_H / 2, width: n.w, height: NODE_H, rx: NODE_H / 2 }));
        g.appendChild(svgEl("text", { class: "node-label", x: 0, y: 4.5, "text-anchor": "middle" }, n.name));
        gNodes.appendChild(g);
        n.g = g;
      });

      // start arrow
      const s = this.nodes.get(def.start);
      gNodes.appendChild(svgEl("path", { class: "edge start-arrow", d: `M ${s.x - s.w / 2 - 44} ${s.y} L ${s.x - s.w / 2 - 3} ${s.y}`, "marker-end": "url(#tm-arrow)" }));
      gNodes.appendChild(svgEl("text", { class: "edge-label", x: s.x - s.w / 2 - 44, y: s.y - 8, "text-anchor": "start" }, "start"));

      // token travelling along the edges
      this.token = svgEl("circle", { class: "token", r: 7, cx: 0, cy: 0, visibility: "hidden" });
      gTop.appendChild(this.token);

      this.setFit(this.natural.w <= 1000);
      this.reset(def.start);
    }

    /* ----------------------------------------------------------- zoom/fit */
    setFit(fit) {
      this.fit = fit;
      this.svg.style.width = fit ? "100%" : this.natural.w + "px";
      this.svg.style.height = fit ? "auto" : this.natural.h + "px";
      this.svg.style.maxHeight = fit ? "340px" : "none";
      if (this.onFitChange) this.onFitChange(fit);
      if (this.activeName) this._follow(this.activeName);
    }

    _follow(name) {
      if (this.fit) return;
      const n = this.nodes.get(name);
      if (!n) return;
      const scale = this.svg.getBoundingClientRect().width / this.size.w || 1;
      this.viewport.scrollLeft = n.x * scale - this.viewport.clientWidth / 2;
    }

    /* ---------------------------------------------------------- highlights */
    _clearStatus() { this.nodes.forEach((n) => n.g.classList.remove("ok", "bad", "stuck")); }
    _clearEdges() { this.edges.forEach((e) => { e.path.classList.remove("firing"); e.text.classList.remove("firing"); }); }

    setActive(name) {
      this.activeName = name;
      this.nodes.forEach((n) => n.g.classList.remove("active", "pulse"));
      const n = this.nodes.get(name);
      if (!n) return;
      n.g.classList.add("active");
      void n.g.getBoundingClientRect();           // restart the CSS animation
      n.g.classList.add("pulse");
      this._follow(name);
    }

    reset(name) {
      this._finishAnim();
      this._clearEdges();
      this._clearStatus();
      this.setActive(name);
    }

    markHalt(sim) {
      this._finishAnim();
      const n = this.nodes.get(sim.state);
      if (!n) return;
      this._clearStatus();
      const cls = { accepted: "ok", rejected: "bad", no_transition: "stuck", max_steps: "stuck" }[sim.status];
      if (cls) n.g.classList.add(cls);
    }

    /* ----------------------------------------------------------- animation */
    _finishAnim() {
      if (!this.anim) return;
      cancelAnimationFrame(this.anim.raf);
      const target = this.anim.target;
      this.anim = null;
      this.token.setAttribute("visibility", "hidden");
      this.setActive(target);
    }

    /** Highlights the edge just taken and moves a token from the old state to the new one. */
    fire(rec, ms) {
      this._finishAnim();
      this._clearEdges();
      const edge = this.edges.get(ekey(rec.stateBefore, rec.stateAfter));
      if (!edge) { this.setActive(rec.stateAfter); return; }
      edge.path.classList.add("firing");
      edge.text.classList.add("firing");
      if (!(ms >= 60)) { this.setActive(rec.stateAfter); return; }

      this.setActive(rec.stateBefore);
      const path = edge.path, len = path.getTotalLength(), start = performance.now();
      this.token.setAttribute("visibility", "visible");
      const frame = (now) => {
        const p = Math.min(1, (now - start) / ms);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const pt = path.getPointAtLength(len * eased);
        this.token.setAttribute("cx", pt.x);
        this.token.setAttribute("cy", pt.y);
        if (p < 1) this.anim.raf = requestAnimationFrame(frame);
        else this._finishAnim();
      };
      this.anim = { target: rec.stateAfter, raf: requestAnimationFrame(frame) };
    }
  }

  root.Diagram = Diagram;
})(window);