/**
 * helpers.js
 * ---------------------------------------------------------------
 * Common utility functions used across the card lifecycle.
 * Covers:
 *  - text localization / formatting
 *  - safety state checks (entity existence, config validity)
 *  - custom click action dispatching (fireEvent)
 *  - error boundaries / warnings when an entity or config is missing
 *  - small DOM / template utilities
 * ---------------------------------------------------------------
 */

import { CARD_TYPE, DEFAULTS, ERROR_KEYS } from './constants.js';

// ----------------------------------------------------------------
// Localization / formatting
// ----------------------------------------------------------------

/**
 * Format a Date into a locale-aware string, falling back gracefully
 * if Intl is unavailable.
 *
 * @param {Date} [date=new Date()]
 * @param {string} [locale]
 * @returns {string}
 */
export const formatDateTime = (date = new Date(), locale = 'en-US') => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (_err) {
    // Fallback: ISO slice
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }
};

/**
 * Safe HTML escape — used whenever user-supplied text must be
 * inserted into a template literal as text content.
 *
 * @param {unknown} value
 * @returns {string}
 */
// Entity lookup table built from String.fromCharCode to avoid any
// tool that might mangle literal HTML entities in source files.
const HTML_ENTITIES = {
  '&': String.fromCharCode(38, 97, 109, 112, 59),   // &
  '<': String.fromCharCode(38, 108, 116, 59),        // <
  '>': String.fromCharCode(38, 103, 116, 59),        // >
  '"': String.fromCharCode(38, 113, 117, 111, 116, 59), // "
  "'": String.fromCharCode(38, 35, 51, 57, 59),      // &#39;
};
const ESCAPE_PATTERN = /[&<>"']/g;

export const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(ESCAPE_PATTERN, (ch) => HTML_ENTITIES[ch]);
};

/**
 * Mark a string as trusted HTML. The card itself does not sanitize
 * the `content` field; that is the user's responsibility (the same
 * as Markdown / html templates in HA). This helper exists so the
 * intent is explicit at the call-site.
 *
 * @param {string} html
 */
export const unsafeHTML = (html) => ({
  __html: typeof html === 'string' ? html : '',
  __unsafe: true,
});

// ----------------------------------------------------------------
// Safety / state checks
// ----------------------------------------------------------------

/**
 * Check whether a config object looks like a valid card config.
 * Currently a permissive shallow check; expand as needed.
 *
 * @param {unknown} config
 * @returns {boolean}
 */
export const isValidConfig = (config) =>
  config !== null && typeof config === 'object' && !Array.isArray(config);

/**
 * Merge a partial config with defaults so downstream code can rely
 * on every field being defined.
 *
 * @param {Partial<typeof DEFAULTS>|null|undefined} config
 * @returns {typeof DEFAULTS}
 */
export const mergeDefaults = (config) => ({
  ...DEFAULTS,
  ...(isValidConfig(config) ? config : {}),
});

/**
 * Verify that an entity id exists on the supplied hass object.
 *
 * @param {{states: Record<string, unknown>}|null|undefined} hass
 * @param {string} entityId
 * @returns {boolean}
 */
export const hasEntity = (hass, entityId) =>
  Boolean(
    hass &&
      hass.states &&
      Object.prototype.hasOwnProperty.call(hass.states, entityId),
  );

/**
 * Get a state object from hass, or null if missing.
 *
 * @param {{states: Record<string, any>}|null|undefined} hass
 * @param {string} entityId
 */
export const getEntityState = (hass, entityId) => {
  if (!hasEntity(hass, entityId)) return null;
  return hass.states[entityId] || null;
};

// ----------------------------------------------------------------
// fireEvent — standard Home Assistant event dispatcher
// ----------------------------------------------------------------

/**
 * Dispatch a CustomEvent on a node with composed:true so the event
 * crosses the shadow DOM boundary. This is the standard pattern
 * used by HA cards to invoke `hass-action` and `config-changed`.
 *
 * @param {HTMLElement} node
 * @param {string} type
 * @param {object} [detail]
 * @param {boolean} [bubbles=true]
 */
export const fireEvent = (node, type, detail = {}, bubbles = true) => {
  if (!node) return;
  const event = new CustomEvent(type, {
    detail,
    bubbles,
    composed: true,
    cancelable: Boolean(detail && detail.cancelable),
  });
  node.dispatchEvent(event);
};

/**
 * Convenience wrapper for the standard `hass-action` event.
 *
 * IMPORTANT — event detail shape:
 *   Home Assistant's `handle-action` mixin (handle-action.ts:39)
 *   reads `e.detail.action` and then `e.detail.config[action]`
 *   to find the user's `tap_action` / `hold_action` etc. So the
 *   detail MUST be:
 *     { action: 'tap', config: { tap_action: { ...user's... } } }
 *   NOT:
 *     { action: 'tap', data: { config: ... } }
 *
 * @param {HTMLElement} node
 * @param {string} action        e.g. 'tap', 'hold', 'double_tap'
 * @param {object} [actionConfig] the user's action config object
 *                               (the value of `tap_action` in YAML).
 *                               Defaults to `{ action: 'none' }` so
 *                               HA doesn't crash if the user has
 *                               not configured one.
 */
export const fireHassAction = (node, action, actionConfig) => {
  const config =
    actionConfig && typeof actionConfig === 'object'
      ? actionConfig
      : { action: 'none' };
  fireEvent(node, 'hass-action', { action, config });
};

/**
 * Convenience wrapper for the editor's `config-changed` event.
 *
 * @param {HTMLElement} node
 * @param {object} config
 */
export const fireConfigChanged = (node, config) => {
  fireEvent(node, 'config-changed', { config });
};

// ----------------------------------------------------------------
// Error boundaries / warnings
// ----------------------------------------------------------------

/**
 * Render a small, themed warning block. Used when config is
 * missing/invalid or when a referenced entity does not exist.
 *
 * @param {string} message
 * @returns {string} raw HTML string
 */
export const renderErrorMessage = (message) => `
  <div class="error-message" role="alert">
    <ha-icon icon="mdi:alert-circle"></ha-icon>
    <span>${escapeHtml(message)}</span>
  </div>
`;

/**
 * Warn-once helper. Calls console.warn the first time a given key
 * is seen; subsequent calls are silent to avoid log spam.
 *
 * @param {string} key
 * @param {...any} args
 */
const _warned = new Set();
export const warnOnce = (key, ...args) => {
  if (_warned.has(key)) return;
  _warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[${CARD_TYPE}]`, ...args);
};

/**
 * Assert a config is valid; log a warning and return false if not.
 *
 * @param {unknown} config
 * @returns {boolean}
 */
export const assertValidConfig = (config) => {
  if (!isValidConfig(config)) {
    warnOnce(ERROR_KEYS.INVALID_CONFIG, 'Invalid card config received:', config);
    return false;
  }
  return true;
};

// ----------------------------------------------------------------
// Misc small utilities
// ----------------------------------------------------------------

/**
 * Debounce — used by the editor to throttle config-changed events.
 *
 * @param {(...args: any[]) => void} fn
 * @param {number} wait
 * @returns {(...args: any[]) => void}
 */
export const debounce = (fn, wait = 150) => {
  let timer = null;
  return (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/**
 * Shallow clone — tiny helper for immutable config updates.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export const clone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice();
  return { ...obj };
};
