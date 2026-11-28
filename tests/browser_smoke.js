/* Runs in the browser on the simulator page, using its actual DOM controls. */
(async () => {
  const out = document.createElement("pre");
  out.id = "browser-test-result";
  document.body.append(out);
  const $ = (id) => document.getElementById(id);
  const step = () => Number($("stat-step").textContent);
  const status = () => $("stat-status").textContent;
  const click = (id) => $(id).click();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const check = (test, name) => { if (!test) throw new Error(name); };
  async function until(predicate, name) {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await wait(10);
    }
    throw new Error(name);
  }
  function change(id, value) {
    $(id).value = value;
    $(id).dispatchEvent(new Event("input", { bubbles: true }));
  }
  async function upload(name, content, works = true) {
    const before = $("preset-select").options.length;
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], name, { type: "application/json" }));
    $("file-input").files = transfer.files;
    $("file-input").dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => works ? $("preset-select").options.length === before + 1 :
      $("alert").textContent.includes(name), "upload " + name);
  }
  const load = async (name, works) => upload(name + ".json", await (await fetch("/examples/" + name + ".json")).text(), works);

  try {
    await until(() => $("preset-select").options.length === 5, "five built-in options");
    check(document.querySelector("#diagram .active"), "active state node");
    check(document.querySelector("#delta-body .next"), "available transition highlight");
    click("btn-step");
    check(step() === 1 && $("stat-head").textContent === "1", "single step and head position");
    check(document.querySelector("#delta-body .applied"), "applied transition highlight");
    check(document.querySelector("#tape-track .head[data-i='1']"), "tape marker");
    check($("tape-viewport").scrollWidth > $("tape-viewport").clientWidth, "tape scrollable");
    click("btn-reset");
    check(step() === 0 && status() === "Ready", "reset");
    change("speed", "1");
    click("btn-play");
    await wait(100);
    check(step() === 1 && $("btn-step").disabled, "slow playback");
    click("btn-play");
    await wait(1050);
    check(step() === 1, "pause");
    change("speed", "10");
    click("btn-play");
    await until(() => status() === "Accepted", "fast playback");
    check($("btn-step").disabled && !$("btn-reset").disabled, "halt controls");
    check($("result").textContent.includes("1100"), "increment tape");
    change("input-string", "111");
    click("btn-ff");
    await until(() => status() === "Accepted", "run to end");
    check(document.querySelector("#tape-track .head[data-i='-1']"), "leftward tape growth");

    await load("accepted_even_ones");
    click("btn-ff");
    check(status() === "Accepted" && step() === 5, "accepted upload");
    await load("rejected_odd_ones");
    click("btn-ff");
    check(status() === "Rejected" && step() === 5, "rejected upload");
    await load("invalid_input");
    check(status() === "Invalid input" && $("input-string").getAttribute("aria-invalid") === "true" &&
      $("btn-play").disabled && $("input-hint").textContent.includes("Invalid input"), "invalid input");
    await load("undefined_transition");
    click("btn-step");
    check(status() === "Undefined transition" && step() === 0 && !$("btn-export").disabled, "undefined transition");
    await load("loop_protection");
    click("btn-ff");
    check(status() === "Step limit" && step() === 10, "loop protection");
    change("max-steps", "0");
    check(status() === "Invalid step limit" && $("btn-play").disabled, "invalid step limit");
    change("max-steps", "1600");
    click("btn-ff");
    click("btn-reset");
    await wait(50);
    check(step() === 0 && status() === "Ready", "reset cancels a pending batch");
    click("btn-ff");
    check(step() < 1600 && $("btn-ff").disabled, "run to end yields between batches");
    await until(() => step() === 1600, "completion of batched run");
    check($("trace-body").rows.length === 1000, "visible trace cap");

    let exported;
    let downloadName;
    const originalBlobURL = URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { exported = blob; return "blob:smoke"; };
    HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
    try { click("btn-export"); }
    finally { URL.createObjectURL = originalBlobURL; HTMLAnchorElement.prototype.click = originalClick; }
    check(exported && downloadName === "turing-trace.txt", "export download requested");
    const trace = await exported.text();
    check(trace.includes("Step    1 |") && trace.includes("Step 1600 |") &&
      (trace.match(/^Step +\d+ \|/gm) || []).length === 1601, "complete trace export");
    const initialHalt = await (await fetch("/examples/accepted_even_ones.json")).json();
    initialHalt.machine.start_state = initialHalt.machine.accept_state;
    await upload("initial-halt.json", JSON.stringify(initialHalt));
    check(status() === "Accepted" && step() === 0 && $("result").textContent.includes("Accepted"), "initial terminal state");
    await load("invalid_definition", false);
    check($("alert").textContent.includes("one of L, R, S"), "invalid movement message");
    await upload("malformed.json", "{oops", false);
    check($("alert").textContent.includes("Not valid JSON"), "malformed JSON message");
    check(status() === "Accepted", "failed upload preserves simulator");
    out.textContent = "PASS (presets, controls, diagram, tape, imports, outcomes, capped trace, export)";
  } catch (error) {
    out.textContent = "FAIL " + error.message;
  }
})();
