/**
 * factory.js
 * ---------------------------------------------------------------
 * Creational factory pattern.
 *
 * The factory takes a `view-model` (a plain object emitted by the
 * controller) and produces the HTML string that the card inserts
 * into its shadow DOM. It pulls in:
 *   - icons.js   for decorative <ha-icon> elements (incl. nav arrows)
 *   - helpers.js for safety (escapeHtml, etc.)
 *   - styles.js  indirectly \u2014 the card injects styles itself;
 *                the factory only emits *class* hooks
 *
 * The factory never touches `hass` or `this`. It is a pure
 * function of its input \u2014 easy to test and easy to reason about.
 * ---------------------------------------------------------------
 */

import { LAYOUTS, REGIONS } from './constants.js';
import { renderIcon } from './icons.js';
import { escapeHtml } from './helpers.js';

// CSS class hook + data attribute for the header nav arrow
// buttons. The card wires up click handlers via event delegation
// on the host, using [data-card-nav="<target-view>"].
const NAV_CLASS = 'card-nav-arrow';
const NAV_DATA_TARGET = 'data-card-nav';

// ----------------------------------------------------------------
// Section builders
// ----------------------------------------------------------------

/**
 * Build a navigation arrow button for the header. The arrow points
 * forward (right) on the main view, and back (left) on any other
 * view. Clicking it asks the router to navigate to `targetView`.
 *
 * The button is rendered as a bare <ha-icon> wrapped in a <button>
 * so it's keyboard-focusable and announces its role correctly.
 *
 * @param {string} targetView  one of LAYOUTS.MAIN | LAYOUTS.DETAIL
 * @returns {string} raw HTML
 */
const buildNavArrow = (targetView) => {
  const isBack = targetView === LAYOUTS.MAIN;
  const iconKey = isBack ? 'ARROW_LEFT' : 'ARROW_RIGHT';
  const label = isBack ? 'Back' : 'Next';
  return (
    '<button type="button" class="' + NAV_CLASS + '" ' +
      NAV_DATA_TARGET + '="' + escapeHtml(targetView) + '" ' +
      'aria-label="' + label + '">' +
      renderIcon(iconKey, { className: NAV_CLASS + '__icon' }) +
    '</button>'
  );
};

/**
 * Build the card header (title + subtitle + optional nav arrow).
 *
 * @param {{title:string, subtitle:string, view:string}} vm
 * @returns {string} raw HTML
 */
const buildHeader = (vm) => {
  const hasTitle = Boolean(vm.title);
  const hasSubtitle = Boolean(vm.subtitle);
  if (!hasTitle && !hasSubtitle) return '';

  // Decide which arrow to show based on the current view:
  //   - LAYOUTS.MAIN     -> right arrow pointing to LAYOUTS.DETAIL
  //   - LAYOUTS.DETAIL   -> left arrow pointing back to LAYOUTS.MAIN
  //   - LAYOUTS.SETTINGS -> left arrow pointing back to LAYOUTS.MAIN
  //     (settings is reserved for future use; behaves like detail)
  let navArrow = '';
  if (vm.view === LAYOUTS.MAIN) {
    navArrow = buildNavArrow(LAYOUTS.DETAIL);
  } else if (vm.view === LAYOUTS.DETAIL || vm.view === LAYOUTS.SETTINGS) {
    navArrow = buildNavArrow(LAYOUTS.MAIN);
  }

  return (
    '<div class="' + REGIONS.HEADER + '">' +
      '<div class="' + REGIONS.HEADER + '__row">' +
        '<div class="' + REGIONS.HEADER + '__text">' +
          (hasTitle ? '<h2 class="' + REGIONS.TITLE + '">' + escapeHtml(vm.title) + '</h2>' : '') +
          (hasSubtitle ? '<p class="' + REGIONS.SUBTITLE + '">' + escapeHtml(vm.subtitle) + '</p>' : '') +
        '</div>' +
        navArrow +
      '</div>' +
    '</div>'
  );
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
  return (
    '<div class="' + REGIONS.CONTENT + '">' +
      html +
    '</div>'
  );
};

/**
 * Build an empty content area \u2014 used by views that intentionally
 * have no user content (e.g. a static landing page).
 *
 * @returns {string} raw HTML
 */
const buildEmptyContent = () =>
  '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--empty"></div>';

/**
 * Build the card footer (currently just the version string).
 *
 * @param {{version:string}} vm
 * @returns {string} raw HTML
 */
const buildFooter = (vm) =>
  '<div class="' + REGIONS.FOOTER + '">v' + escapeHtml(vm.version) + '</div>';

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
export const buildStatusPill = (label, value, tone = 'ok') =>
  '<span class="status-pill status-pill--' + escapeHtml(tone) + '">' +
    '<span class="status-pill__label">' + escapeHtml(label) + '</span>' +
    '<span class="status-pill__value">' + escapeHtml(value) + '</span>' +
  '</span>';

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
  switch (vm.view) {
    case LAYOUTS.DETAIL:
      // Static secondary page: same header + footer as the main
      // view, but the content <div> is empty.
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildEmptyContent() +
            buildFooter(vm) +
          '</div>' +
        '</ha-card>'
      );
    case LAYOUTS.SETTINGS:
      // Reserved for a future settings view. For now, treat it
      // identically to the detail view.
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildEmptyContent() +
            buildFooter(vm) +
          '</div>' +
        '</ha-card>'
      );
    case LAYOUTS.MAIN:
    default:
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildContent(vm) +
            buildFooter(vm) +
          '</div>' +
        '</ha-card>'
      );
  }
};
