/* Summoning calculator. Depends on relics.js being loaded first. */
(() => {
  "use strict";

  const { parseAmount, formatLike, formatAs, isShorthand } = window.RelicNumbers;

  /* ---------- Data ---------- */

  // COSTS[i] = fragments needed to summon your (i + 1)th relic while owning i.
  const COSTS = SUMMON_COSTS.map((row) => parseAmount(row.nextCost));
  const MAX_OWNED = COSTS.length;

  // DESTROY[n] = fragments needed to destroy a relic while owning n.
  const DESTROY = SUMMON_COSTS.map((row) => parseAmount(row.destroy));
  const destroyText = (owned) =>
    DESTROY[owned] > 0 ? formatLike(SUMMON_COSTS[owned].destroy, DESTROY[owned]) : "—";
  const EPSILON = 1e-6;

  /* ---------- Elements ---------- */

  const $ = (id) => document.getElementById(id);
  const els = {
    modes: document.querySelectorAll('input[name="summon-mode"]'),
    owned: $("owned"),
    ownedHint: $("owned-hint"),
    count: $("count"),
    countField: $("count-field"),
    countHint: $("count-hint"),
    budget: $("budget"),
    budgetField: $("budget-field"),
    totalCost: $("total-cost"),
    totalNote: $("total-note"),
    ownedAfter: $("owned-after"),
    ownedNote: $("owned-note"),
    status: $("status"),
    head: $("breakdown-head"),
    body: $("breakdown-body"),
  };

  els.owned.max = MAX_OWNED;
  els.ownedHint.textContent = `0 to ${MAX_OWNED}`;

  /* ---------- Saved inputs ---------- */

  const STORAGE_KEY = "relicCalc.summon";

  function loadInputs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      if (saved.mode === "budget") $("mode-budget").checked = true;
      if (saved.owned != null) els.owned.value = saved.owned;
      if (saved.count != null) els.count.value = saved.count;
      if (saved.budget != null) els.budget.value = saved.budget;
    } catch { /* storage unavailable or corrupt: keep defaults */ }
  }

  function saveInputs(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode,
        owned: els.owned.value,
        count: els.count.value,
        budget: els.budget.value,
      }));
    } catch { /* ignore */ }
  }

  /* ---------- Rendering ---------- */

  /** Returns null when empty, NaN when not a whole number. */
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

  function renderHead(showRemaining) {
    const cols = [["Relics owned", ""], ["Cost", "num"], ["Total spent", "num"], ["Destroy cost", "num"]];
    if (showRemaining) cols.push(["Fragments left", "num"]);
    els.head.replaceChildren(...cols.map(([text, cls]) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      if (cls) th.className = cls;
      return th;
    }));
  }

  /** steps: [{ number, cost, spent, spentShort, left?, leftShort? }] */
  function renderTable(owned, steps, budget, budgetShort) {
    const showRemaining = budget != null;
    renderHead(showRemaining);

    const start = document.createElement("tr");
    start.className = "start";
    start.append(
      cell(`Starting with ${owned} owned`, "title"),
      cell("—", "num", "Cost"),
      cell("0", "num", "Total spent"),
      cell(destroyText(owned), "num", "Destroy cost"),
    );
    if (showRemaining) start.append(cell(formatAs(budgetShort, budget), "num", "Fragments left"));

    const rows = steps.map((step) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(`${step.number - 1} → ${step.number}`, "title"),
        cell(formatLike(SUMMON_COSTS[step.number - 1].nextCost, step.cost), "num cost", "Cost"),
        cell(formatAs(step.spentShort, step.spent), "num", "Total spent"),
        cell(destroyText(step.number), "num destroy", "Destroy cost"),
      );
      if (showRemaining) tr.append(cell(formatAs(step.leftShort, step.left), "num muted", "Fragments left"));
      return tr;
    });

    els.body.replaceChildren(start, ...rows);
  }

  function renderSummary(total, ownedAfter, note, totalShort = false) {
    els.totalCost.textContent = formatAs(totalShort, total);
    els.totalNote.textContent = note;
    els.ownedAfter.textContent = String(ownedAfter);
    els.ownedNote.textContent = `of ${MAX_OWNED} relics`;
  }

  function clearResults(ownedAfter = 0) {
    renderSummary(0, ownedAfter, "Relic Fragments");
    els.head.replaceChildren();
    els.body.replaceChildren();
  }

  function render() {
    const mode = [...els.modes].find((r) => r.checked).value;
    els.countField.hidden = mode !== "count";
    els.budgetField.hidden = mode !== "budget";
    saveInputs(mode);

    const owned = readWhole(els.owned);
    const remaining = Number.isInteger(owned) ? MAX_OWNED - owned : MAX_OWNED;
    els.count.max = Math.max(remaining, 1);
    els.countHint.textContent = remaining > 0 ? `Up to ${remaining} more` : "Nothing left to summon";

    if (owned === null) {
      clearResults();
      return setStatus("Enter how many relics you own.");
    }
    if (Number.isNaN(owned) || owned < 0 || owned > MAX_OWNED) {
      clearResults();
      return setStatus(`Relics owned must be a whole number from 0 to ${MAX_OWNED}.`, true);
    }
    if (owned === MAX_OWNED) {
      clearResults(owned);
      return setStatus("You own every relic, so there's nothing left to summon.");
    }

    return mode === "count" ? renderByCount(owned, remaining) : renderByBudget(owned);
  }

  function renderByCount(owned, remaining) {
    const count = readWhole(els.count);
    if (count === null) {
      clearResults(owned);
      return setStatus("Enter how many relics you want to summon.");
    }
    if (Number.isNaN(count) || count < 1 || count > remaining) {
      clearResults(owned);
      return setStatus(`Relics to summon must be a whole number from 1 to ${remaining}.`, true);
    }

    const steps = [];
    let spent = 0;
    let spentShort = false;
    for (let i = owned; i < owned + count; i++) {
      spent += COSTS[i];
      spentShort ||= isShorthand(SUMMON_COSTS[i].nextCost);
      steps.push({ number: i + 1, cost: COSTS[i], spent, spentShort });
    }

    renderSummary(spent, owned + count, "Relic Fragments", spentShort);
    renderTable(owned, steps);
    setStatus(owned + count === MAX_OWNED ? "This completes your collection." : "");
  }

  function renderByBudget(owned) {
    const raw = els.budget.value.trim();
    if (raw === "") {
      clearResults(owned);
      return setStatus("Enter how many Relic Fragments you want to spend.");
    }
    const budget = parseAmount(raw);
    if (Number.isNaN(budget)) {
      clearResults(owned);
      return setStatus("Fragments to spend must be a number, like 5000 or 12.5k.", true);
    }

    const steps = [];
    // The budget is typed by the player, so it's shorthand if they typed it that way.
    const budgetShort = /[a-z]/i.test(raw);
    let spent = 0;
    let spentShort = false;
    let i = owned;
    while (i < MAX_OWNED && spent + COSTS[i] <= budget + EPSILON) {
      spent += COSTS[i];
      spentShort ||= isShorthand(SUMMON_COSTS[i].nextCost);
      steps.push({
        number: i + 1,
        cost: COSTS[i],
        spent,
        spentShort,
        left: budget - spent,
        leftShort: budgetShort || spentShort,
      });
      i++;
    }

    const leftShort = budgetShort || spentShort;
    renderSummary(spent, i, `${formatAs(leftShort, budget - spent)} left over`, spentShort);
    renderTable(owned, steps, budget, budgetShort);

    if (i === MAX_OWNED) {
      setStatus("That's enough to summon every remaining relic.");
    } else {
      const shortfall = spent + COSTS[i] - budget;
      setStatus(`The next summon (${i} → ${i + 1}) costs ${formatLike(SUMMON_COSTS[i].nextCost, COSTS[i])}. You need ${formatAs(leftShort || isShorthand(SUMMON_COSTS[i].nextCost), shortfall)} more fragments for it.`);
    }
  }

  /* ---------- Wire up ---------- */

  loadInputs();
  [els.owned, els.count, els.budget].forEach((input) => input.addEventListener("input", render));
  els.modes.forEach((radio) => radio.addEventListener("change", render));
  render();

})();
