/**
 * factory.js
 * ---------------------------------------------------------------
 * Creational factory pattern.
 *
 * The factory takes a `view-model` (a plain object emitted by the
 * controller) and produces the HTML string that the card inserts
 * into its shadow DOM. It pulls in:
 *   - icons.js   for any decorative <ha-icon> elements
 *   - helpers.js for safety (escapeHtml, etc.)
 *   - styles.js  indirectly — the card injects styles itself;
 *                the factory only emits *class* hooks
 *
 * The factory never touches `hass` or `this`. It is a pure
 * function of its input — easy to test and easy to reason about.
 * ---------------------------------------------------------------
 */

import { LAYOUTS, REGIONS } from './constants.js';
import { escapeHtml } from './helpers.js';

// ----------------------------------------------------------------
// Section builders
// ----------------------------------------------------------------

/**
 * Build the card header (title + optional subtitle).
 *
 * @param {{title:string, subtitle:string}} vm
 * @returns {string} raw HTML
 */
const buildHeader = (vm) => {
  const hasTitle = Boolean(vm.title);
  const hasSubtitle = Boolean(vm.subtitle);
  if (!hasTitle && !hasSubtitle) return '';
  return `
    <div class="${REGIONS.HEADER}">
      ${hasTitle ? `<h2 class="${REGIONS.TITLE}">${escapeHtml(vm.title)}</h2>` : ''}
      ${hasSubtitle ? `<p class="${REGIONS.SUBTITLE}">${escapeHtml(vm.subtitle)}</p>` : ''}
    </div>
  `;
};

/**
 * Build the card content area. `content` is user-supplied
 * markup; we trust it (same model as HA's built-in markdown card)
 * but only after escaping the surrounding boundaries.
 *
 * @param {{content:string}} vm
 * @returns {string} raw HTML
 */
const buildContent = (vm) => {
  const html = typeof vm.content === 'string' ? vm.content : '';
  return `
    <div class="${REGIONS.CONTENT}">
      ${html}
    </div>
  `;
};

/**
 * Build the card footer (currently just the version string).
 *
 * @param {{version:string}} vm
 * @returns {string} raw HTML
 */
const buildFooter = (vm) => `
  <div class="${REGIONS.FOOTER}">
    v${escapeHtml(vm.version)}
  </div>
`;

// ----------------------------------------------------------------
// Sub-component factories (for future expansion)
// ----------------------------------------------------------------

/**
 * Build a generic status pill. Reserved for future entity-aware
 * additions; left here to demonstrate the factory pattern.
 *
 * @param {string} label
 * @param {string} value
 * @param {'ok'|'warn'|'error'} tone
 * @returns {string} raw HTML
 */
export const buildStatusPill = (label, value, tone = 'ok') => `
  <span class="status-pill status-pill--${escapeHtml(tone)}">
    <span class="status-pill__label">${escapeHtml(label)}</span>
    <span class="status-pill__value">${escapeHtml(value)}</span>
  </span>
`;

// ----------------------------------------------------------------
// Top-level factory
// ----------------------------------------------------------------

/**
 * Render the entire card from a view-model.
 *
 * @param {ReturnType<import('./controller.js').CardController['getViewModel']>} vm
 * @returns {string} raw HTML
 */
export const buildCardHtml = (vm) => {
  // The single-page card is always LAYOUTS.MAIN today, but the
  // factory is structured so additional views can be added by
  // switching on `vm.view`.
  switch (vm.view) {
    case LAYOUTS.DETAIL:
    case LAYOUTS.SETTINGS:
      // Reserved for future expansion. Fall through to a minimal
      // placeholder so the card never renders an empty body.
      return `
        <ha-card>
          <div class="${REGIONS.CARD_WRAPPER}">
            ${buildHeader(vm)}
            <div class="${REGIONS.CONTENT}">
              <p>Coming soon.</p>
            </div>
            ${buildFooter(vm)}
          </div>
        </ha-card>
      `;
    case LAYOUTS.MAIN:
    default:
      return `
        <ha-card>
          <div class="${REGIONS.CARD_WRAPPER}">
            ${buildHeader(vm)}
            ${buildContent(vm)}
            ${buildFooter(vm)}
          </div>
        </ha-card>
      `;
  }
};
