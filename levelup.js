/* Level up calculator. Depends on relics.js and common.js being loaded first. */
(() => {
  "use strict";

  const { parseAmount, formatValue, formatPercent, formatLike, formatAs, isShorthand } = window.RelicNumbers;

  /* ---------- Data ---------- */

  const TYPE_DATA = {
    OOPART: OOPART,
    T1_EXPENSIVE: T1_EXPENSIVE_RELICS,
    T1_CHEAP: T1_CHEAP_RELICS,
  };
  const TYPE_LABELS = {
    OOPART: "OOPArt",
    T1_EXPENSIVE: "Tier 1, expensive",
    T1_CHEAP: "Tier 1, cheap",
  };

  const OOPART_RELIC = RELICS.find((r) => r.type === "OOPART");
  const OOPART_MAX = OOPART_RELIC.levelCap ?? OOPART.costs.length + 1;

  /** Special effect % at a level, respecting specialEffectMax. */
  function specialAt(relic, level) {
    const value = relic.specialEffectMin + relic.specialEffectPerLevel * (level - 1);
    return relic.specialEffectMax != null ? Math.min(value, relic.specialEffectMax) : value;
  }

  /** Basic effect % at a level, from the relic's type. */
  function basicAt(relic, level) {
    const data = TYPE_DATA[relic.type];
    return data.basicEffectMin + data.basicEffectPerLevel * (level - 1);
  }

  /** OOPArt Compact's cost reduction %. Level 0 means not owned. */
  function reductionAt(oopartLevel) {
    return oopartLevel < 1 ? 0 : specialAt(OOPART_RELIC, oopartLevel);
  }

  // All non-OOPArt costs were recorded with this reduction already applied.
  const RECORDED_REDUCTION = reductionAt(RECORDED_AT_OOPART_LEVEL);

  /**
   * costs[i] is the cost to go from level i + 1 to level i + 2, so the
   * highest level we can calculate to is costs.length + 1.
   */
  function levelLimits(relic) {
    const dataMax = TYPE_DATA[relic.type].costs.length + 1;
    const cap = relic.levelCap ?? null;
    return { cap, dataMax, max: cap == null ? dataMax : Math.min(cap, dataMax) };
  }

  const usesOOPArt = (relic) => relic.useOOPArt !== false;
  const fillValue = (template, value) => template.replaceAll("{value}", formatValue(value));
  const describe = (relic, value) => fillValue(relic.description, value);
  const BASIC_DESCRIPTION = "+{value}% Jinwoo's ATK";
  const describeBasic = (value) => fillValue(BASIC_DESCRIPTION, value);

  /* ---------- Elements ---------- */

  const $ = (id) => document.getElementById(id);
  const els = {
    relic: $("lvl-relic"),
    relicHint: $("lvl-relic-hint"),
    current: $("lvl-current"),
    currentHint: $("lvl-current-hint"),
    target: $("lvl-target"),
    targetHint: $("lvl-target-hint"),
    oopart: $("lvl-oopart"),
    oopartField: $("lvl-oopart-field"),
    oopartHint: $("lvl-oopart-hint"),
    oopartStat: $("lvl-oopart-stat"),
    reduction: $("lvl-reduction"),
    total: $("lvl-total"),
    totalNote: $("lvl-total-note"),
    basic: $("lvl-basic"),
    basicNote: $("lvl-basic-note"),
    special: $("lvl-special"),
    specialNote: $("lvl-special-note"),
    status: $("lvl-status"),
    head: $("lvl-head"),
    body: $("lvl-body"),
  };

  // Relic picker, grouped by type.
  for (const type of Object.keys(TYPE_DATA)) {
    const group = document.createElement("optgroup");
    group.label = TYPE_LABELS[type];
    RELICS.forEach((relic, index) => {
      if (relic.type !== type) return;
      group.append(new Option(relic.name, String(index)));
    });
    if (group.children.length) els.relic.append(group);
  }

  els.oopart.max = OOPART_MAX;
  els.oopartHint.textContent = `0 if you don't have it, up to ${OOPART_MAX}`;

  /* ---------- Saved inputs ---------- */

  const STORAGE_KEY = "relicCalc.levelUp";

  function loadInputs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      if (saved.relic != null && RELICS[saved.relic]) els.relic.value = saved.relic;
      if (saved.current != null) els.current.value = saved.current;
      if (saved.target != null) els.target.value = saved.target;
      if (saved.oopart != null) els.oopart.value = saved.oopart;
    } catch { /* storage unavailable or corrupt: keep defaults */ }
  }

  function saveInputs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        relic: els.relic.value,
        current: els.current.value,
        target: els.target.value,
        oopart: els.oopart.value,
      }));
    } catch { /* ignore */ }
  }

  /* ---------- Rendering ---------- */

  function readWhole(input) {
    const raw = input.value.trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : NaN;
  }

  function setStatus(message, isError = false) {
    els.status.textContent = message;
    els.status.classList.toggle("error", isError);
  }

  function cell(text, className, label) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    if (label) td.dataset.label = label;
    return td;
  }

  const COLUMNS = [
    ["Level", ""],
    ["Cost", "num"],
    ["Total spent", "num"],
    ["Special effect", "num"],
    ["Basic effect", "num"],
  ];

  function renderTable(relic, current, steps) {
    els.head.replaceChildren(...COLUMNS.map(([text, cls]) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      if (cls) th.className = cls;
      return th;
    }));

    const start = document.createElement("tr");
    start.className = "start";
    start.append(
      cell(`Starting at level ${current}`, "title"),
      cell("—", "num", "Cost"),
      cell("0", "num", "Total spent"),
      cell(formatPercent(specialAt(relic, current)), "num", "Special effect"),
      cell(formatPercent(basicAt(relic, current)), "num", "Basic effect"),
    );

    const rows = steps.map((step) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(`${step.from} → ${step.to}`, "title"),
        cell(formatLike(step.source, step.cost), "num cost", "Cost"),
        cell(formatAs(step.spentShort, step.spent), "num", "Total spent"),
        cell(formatPercent(step.special), "num effect", "Special effect"),
        cell(formatPercent(step.basic), "num basic", "Basic effect"),
      );
      return tr;
    });

    els.body.replaceChildren(start, ...rows);
  }

  /** Shows the effects at one level with no cost, used when there's nothing to calculate. */
  function showLevelOnly(relic, level) {
    els.total.textContent = "0";
    els.totalNote.textContent = "Relic Fragments";
    if (Number.isInteger(level)) {
      els.basic.textContent = formatPercent(basicAt(relic, level));
      els.basicNote.textContent = describeBasic(basicAt(relic, level));
      els.special.textContent = formatPercent(specialAt(relic, level));
      els.specialNote.textContent = describe(relic, specialAt(relic, level));
    } else {
      els.basic.textContent = els.special.textContent = "—";
      els.basicNote.textContent = els.specialNote.textContent = "";
    }
    els.head.replaceChildren();
    els.body.replaceChildren();
  }

  function limitsText({ cap, dataMax }) {
    if (cap == null) return `No level cap. Costs are recorded up to level ${dataMax}.`;
    if (cap > dataMax) return `Level cap ${cap}. Costs are recorded up to level ${dataMax}.`;
    return `Level cap ${cap}.`;
  }

  function render() {
    saveInputs();

    const relic = RELICS[Number(els.relic.value)];
    const limits = levelLimits(relic);
    const reduced = usesOOPArt(relic);

    els.relicHint.textContent = `${TYPE_LABELS[relic.type]}. ${limitsText(limits)}`;
    els.current.max = limits.max;
    els.target.max = limits.max;
    els.currentHint.textContent = `1 to ${limits.max}`;
    els.targetHint.textContent = `Up to ${limits.max}`;
    els.oopartField.hidden = !reduced;
    els.oopartStat.hidden = !reduced;

    // OOPArt level and its reduction
    let reduction = 0;
    if (reduced) {
      const oopartLevel = readWhole(els.oopart);
      if (oopartLevel === null) {
        els.reduction.textContent = "—";
        showLevelOnly(relic, readWhole(els.current));
        return setStatus("Enter your OOPArt Compact level.");
      }
      if (Number.isNaN(oopartLevel) || oopartLevel < 0 || oopartLevel > OOPART_MAX) {
        els.reduction.textContent = "—";
        showLevelOnly(relic, readWhole(els.current));
        return setStatus(`OOPArt Compact level must be a whole number from 0 to ${OOPART_MAX}.`, true);
      }
      reduction = reductionAt(oopartLevel);
      els.reduction.textContent = formatPercent(reduction);
    }

    // Current level
    const current = readWhole(els.current);
    if (current === null) {
      showLevelOnly(relic, null);
      return setStatus("Enter the relic's current level.");
    }
    if (Number.isNaN(current) || current < 1 || current > limits.max) {
      showLevelOnly(relic, null);
      return setStatus(`Current level must be a whole number from 1 to ${limits.max}.`, true);
    }
    if (current === limits.max) {
      showLevelOnly(relic, current);
      return setStatus(limits.max === limits.cap
        ? `${relic.name} is at its level cap.`
        : `There are no recorded costs past level ${limits.max} yet.`);
    }

    // Target level
    const target = readWhole(els.target);
    if (target === null) {
      showLevelOnly(relic, current);
      return setStatus("Enter the level you want to reach.");
    }
    if (Number.isNaN(target) || target <= current || target > limits.max) {
      showLevelOnly(relic, current);
      return setStatus(`Target level must be a whole number from ${current + 1} to ${limits.max}.`, true);
    }

    // Costs were recorded at OOPArt level RECORDED_AT_OOPART_LEVEL: undo that
    // reduction, then apply the player's own.
    const factor = reduced ? (1 - reduction / 100) / (1 - RECORDED_REDUCTION / 100) : 1;
    const costs = TYPE_DATA[relic.type].costs;

    const steps = [];
    let spent = 0;
    let spentShort = false;
    for (let level = current; level < target; level++) {
      const cost = Math.round(parseAmount(costs[level - 1]) * factor);
      spent += cost;
      spentShort ||= isShorthand(costs[level - 1]);
      steps.push({
        from: level,
        to: level + 1,
        cost,
        source: costs[level - 1],
        spent,
        spentShort,
        basic: basicAt(relic, level + 1),
        special: specialAt(relic, level + 1),
      });
    }

    const special = specialAt(relic, target);
    const maxed = relic.specialEffectMax != null && special >= relic.specialEffectMax;

    els.total.textContent = formatAs(spentShort, spent);
    els.totalNote.textContent = reduced
      ? `After ${formatPercent(reduction)} OOPArt reduction`
      : "OOPArt Compact's own costs aren't reduced";
    els.basic.textContent = formatPercent(basicAt(relic, target));
    els.basicNote.textContent = describeBasic(basicAt(relic, target));
    els.special.textContent = formatPercent(special);
    els.specialNote.textContent = describe(relic, special) + (maxed ? " (max)" : "");

    renderTable(relic, current, steps);

    if (maxed) {
      const maxLevel = Math.ceil((relic.specialEffectMax - relic.specialEffectMin) / relic.specialEffectPerLevel) + 1;
      setStatus(maxLevel <= target
        ? `The special effect reaches its max of ${formatPercent(relic.specialEffectMax)} at level ${maxLevel}.`
        : "");
    } else {
      setStatus("");
    }
  }

  /* ---------- Wire up ---------- */

  loadInputs();
  [els.current, els.target, els.oopart].forEach((input) => input.addEventListener("input", render));
  els.relic.addEventListener("change", render);
  render();
})();
