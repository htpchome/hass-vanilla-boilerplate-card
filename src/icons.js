/**
 * icons.js
 * ---------------------------------------------------------------
 * Centralized dictionary of Material Design Icons (MDI) used by
 * the card and its editor. We store *names*, not raw SVG paths,
 * because Home Assistant ships <ha-icon> natively which resolves
 * the MDI glyph set automatically. That keeps the card bundle
 * tiny and ensures icons match the rest of the HA UI.
 *
 * If you ever need to render an SVG path manually, drop a path
 * string into the SVG_PATHS map below and call `getIconPath()`.
 * ---------------------------------------------------------------
 */

// MDI icon *names* (used with <ha-icon icon="mdi:...">)
export const ICON_NAMES = Object.freeze({
  CARD: 'mdi:card-outline',
  EDIT: 'mdi:pencil',
  ALERT: 'mdi:alert-circle',
  CHECK: 'mdi:check-circle',
  HOME: 'mdi:home',
  SETTINGS: 'mdi:cog',
  REFRESH: 'mdi:refresh',
  // Internal-card navigation arrows (used by the header nav
  // buttons the factory renders to switch between views).
  ARROW_RIGHT: 'mdi:chevron-right',
  ARROW_LEFT: 'mdi:chevron-left',
});

// Inline SVG path data — only used if you need a fully offline
// render. The strings are deliberately simple to keep this
// module readable; expand as your card needs grow.
export const SVG_PATHS = Object.freeze({
  [ICON_NAMES.CARD]:
    'M2 4h20v16H2z M4 8h16 M4 12h16 M4 16h10', // card outline
  [ICON_NAMES.ALERT]:
    'M12 2 L22 20 L2 20 Z M12 9v5 M12 17h.01', // triangle exclamation
  [ICON_NAMES.CHECK]:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12l3 3 7-7', // circle check
});

/**
 * Convenience accessor — return the MDI name for a logical key.
 *
 * @param {string} key
 * @returns {string|undefined}
 */
export const getIcon = (key) => ICON_NAMES[key];

/**
 * Return the raw SVG path for a key, if one is defined.
 * Most cards should not need this — prefer <ha-icon>.
 *
 * @param {string} key
 * @returns {string|undefined}
 */
export const getIconPath = (key) => SVG_PATHS[key];

/**
 * Render an <ha-icon> element for the given logical key.
 * Returned as a raw string for easy template interpolation.
 *
 * @param {string} key
 * @param {object} [opts]
 * @param {string} [opts.className]
 * @param {Record<string,string>} [opts.attrs] extra HTML attrs
 *        (e.g. `{ 'data-card-nav': 'main' }`).
 * @returns {string}
 */
export const renderIcon = (key, opts = {}) => {
  const name = getIcon(key);
  if (!name) return '';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const attrs = opts.attrs
    ? ' ' + Object.entries(opts.attrs)
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '"')}"`)
        .join(' ')
    : '';
  return `<ha-icon icon="${name}"${cls}${attrs}></ha-icon>`;
};
