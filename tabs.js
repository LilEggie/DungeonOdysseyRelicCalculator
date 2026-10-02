/* Switches between calculators. The open tab is kept in the URL (#summon, #level-up). */
(() => {
  "use strict";

  const tabList = document.querySelector(".tabs");
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const STORAGE_KEY = "relicCalc.tab";

  function select(tab, { focus = false, updateUrl = true } = {}) {
    for (const t of tabs) {
      const isActive = t === tab;
      t.setAttribute("aria-selected", String(isActive));
      t.tabIndex = isActive ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !isActive;
    }
    if (focus) tab.focus();

    if (updateUrl) {
      history.replaceState(null, "", `#${tab.dataset.hash}`);
      try { localStorage.setItem(STORAGE_KEY, tab.dataset.hash); } catch { /* ignore */ }
    }

    // If you were scrolled down the other calculator, bring the new one into view.
    const tabsTop = tabList.offsetTop;
    if (window.scrollY > tabsTop) window.scrollTo({ top: tabsTop });
  }

  const byHash = (hash) => tabs.find((t) => t.dataset.hash === hash);

  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab)));

  // Arrow keys move between tabs, as in any standard tab bar.
  tabList.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    let next;
    if (event.key in moves) next = tabs[(index + moves[event.key] + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    select(next, { focus: true });
  });

  window.addEventListener("hashchange", () => {
    const tab = byHash(location.hash.slice(1));
    if (tab) select(tab, { updateUrl: false });
  });

  // Open the tab from the link, else the last one used, else the first.
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  const initial = byHash(location.hash.slice(1)) || byHash(saved) || tabs[0];
  select(initial, { updateUrl: Boolean(location.hash) || initial !== tabs[0] });
})();
