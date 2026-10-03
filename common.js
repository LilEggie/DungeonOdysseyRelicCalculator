/* Shared helpers for every calculator. Depends on relics.js being loaded first. */
(() => {
  "use strict";

  /* ---------- Number helpers (shared shape with the game's "1.28k" style) ---------- */

  const SUFFIX_LETTERS = NUMBER_SUFFIXES.filter(Boolean).join("");
  const AMOUNT_PATTERN = new RegExp(`^(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*([${SUFFIX_LETTERS}]?)$`);

  /** "1.28k" -> 1280, 899 -> 899. Returns NaN for anything unreadable. */
  function parseAmount(value) {
    if (typeof value === "number") return value;
    const match = String(value).trim().toLowerCase().replace(/,/g, "").match(AMOUNT_PATTERN);
    if (!match) return NaN;
    const tier = NUMBER_SUFFIXES.indexOf(match[2]);
    return parseFloat(match[1]) * 1000 ** tier;
  }

  /** 1280 -> "1.28k", 899 -> "899". */
  function formatAmount(n) {
    if (n < 1000) return String(Math.round(n));
    let tier = Math.min(Math.floor(Math.log10(n) / 3), NUMBER_SUFFIXES.length - 1);
    let scaled = Math.round((n / 1000 ** tier) * 100) / 100;
    if (scaled >= 1000 && tier < NUMBER_SUFFIXES.length - 1) {
      tier += 1;
      scaled = Math.round((n / 1000 ** tier) * 100) / 100;
    }
    return `${scaled}${NUMBER_SUFFIXES[tier]}`;
  }

  /** 29.75 -> "29.75%", 2.625 -> "2.625%". */
  function formatPercent(n) {
    return `${parseFloat(n.toFixed(3))}%`;
  }

  /**
   * Formats a value the same way its source is written in relics.js:
   * shorthand ("1.28k") only if the source is shorthand, otherwise the full number.
   */
  function formatLike(source, n) {
    return formatAs(isShorthand(source), n);
  }

  /** True when a relics.js value is written in shorthand ("1.28k"), false for plain numbers. */
  function isShorthand(source) {
    return typeof source === "string";
  }

  /**
   * Formats a calculated value: shorthand if any shorthand value went into
   * the calculation, otherwise the full number.
   */
  function formatAs(shorthand, n) {
    return shorthand ? formatAmount(n) : String(Math.round(n));
  }

  window.RelicNumbers = { parseAmount, formatAmount, formatPercent, formatLike, formatAs, isShorthand };
})();
