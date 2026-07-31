/**
 * constants.js
 * ---------------------------------------------------------------
 * Centralized configuration defaults, action strings, and internal
 * layout types. All static keys and magic strings used across the
 * card live here to prevent drift and enable safe refactors.
 * ---------------------------------------------------------------
 */

// ---------- Card identity ----------
export const CARD_VERSION = "0.1.49";
export const CARD_TYPE = "hass-vanilla-boilerplate-card";
export const CARD_NAME = "HASS Vanilla Boilerplate Card";
export const CARD_DESCRIPTION =
  "A production-ready vanilla JS Home Assistant Lovelace card boilerplate.";

// ---------- Editor schema (used for getStubConfig + editor UI) ----------
export const CONFIG_KEYS = Object.freeze({
  TITLE: "title",
  SUBTITLE: "subtitle",
  CONTENT: "content",
});

// ---------- Defaults (used by setConfig + getStubConfig) ----------
export const DEFAULTS = Object.freeze({
  title: "Vanilla Boilerplate",
  subtitle: "A modular Home Assistant card",
  content: "<p>Hello, <strong>Home Assistant</strong>!</p>",
});

// ---------- Internal action / event names ----------
export const ACTIONS = Object.freeze({
  // Standard HA fireEvent names
  HASS_ACTION: "hass-action",
  CONFIG_CHANGED: "config-changed",
  // Card-specific internal events (reserved for future use)
  TAB_CHANGED: "card-tab-changed",
});

// ---------- Layout / view identifiers (used by router.js) ----------
export const LAYOUTS = Object.freeze({
  MAIN: "main",
  // Reserved for future tabs/views added via router.js
  DETAIL: "detail",
  // Third view: the 8-way dpad. See src/dpad-8way.js.
  DETAIL_8WAY: "detail-8way",
  // Fourth view: the circle pad. See src/circle-pad.js.
  DETAIL_CIRCLE: "detail-circle",
  SETTINGS: "settings",
});

// ---------- Selector regions in the card DOM ----------
export const REGIONS = Object.freeze({
  CARD_WRAPPER: "card-wrapper",
  HEADER: "card-header",
  TITLE: "card-title",
  SUBTITLE: "card-subtitle",
  CONTENT: "card-content",
  FOOTER: "card-footer",
});

// ---------- CSS class names (mirror of REGIONS where needed) ----------
export const CLASS_NAMES = Object.freeze({
  ...REGIONS,
});

// ---------- Safety / error message keys ----------
export const ERROR_KEYS = Object.freeze({
  MISSING_CONFIG: "missing_config",
  INVALID_CONFIG: "invalid_config",
  MISSING_HASS: "missing_hass",
});
