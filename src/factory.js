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
 *   - styles.js  indirectly — the card injects styles itself;
 *                the factory only emits *class* hooks
 *
 * The factory never touches `hass` or `this`. It is a pure
 * function of its input — easy to test and easy to reason about.
 *
 * Note: the D-pad touchpad is a separate self-contained custom
 * element. The 4-way <dpad-control> is defined in dpad.js; the
 * 8-way <dpad-8way-control> is defined in dpad-8way.js. The
 * factory just drops one of those elements into the relevant
 * view's content area; it has no knowledge of the dpad internals.
 * ---------------------------------------------------------------
 */

import { LAYOUTS, REGIONS } from './constants.js';
import { escapeHtml } from './helpers.js';

// Numeric page navigation rendered in the top-left of every
// card header. Three buttons labeled (1) (2) (3). The button
// for the current view is marked .is-active and is not clickable
// — you can't navigate to the page you're already on. The card
// wires up click handlers via event delegation on the host,
// using [data-page-nav="<view-id>"].
const PAGE_NAV_CLASS = 'card-page-nav';
const PAGE_NAV_ITEM_CLASS = 'card-page-nav__item';
const PAGE_NAV_DATA = 'data-page-nav';
// Index of each page in the 1-based nav. Used as the label.
const PAGE_NAV_INDEX = Object.freeze({
  [LAYOUTS.MAIN]: 1,
  [LAYOUTS.DETAIL]: 2,
  [LAYOUTS.DETAIL_8WAY]: 3,
});
// Ordered list of view ids in the nav, for rendering left-to-right.
const PAGE_NAV_ORDER = [
  LAYOUTS.MAIN,
  LAYOUTS.DETAIL,
  LAYOUTS.DETAIL_8WAY,
];

// ----------------------------------------------------------------
// Section builders
// ----------------------------------------------------------------

/**
 * Build the numeric page-nav strip (1) (2) (3). Always rendered
 * regardless of whether the current view has a title/subtitle, so
 * the user always has a way to navigate between pages.
 *
 * The button for the current view is marked .is-active and is not
 * clickable (you can't navigate to the page you're on). The other
 * two are real buttons; the card catches clicks via event
 * delegation using [data-page-nav="<view-id>"].
 *
 * @param {string} currentView  one of LAYOUTS.MAIN | LAYOUTS.DETAIL | LAYOUTS.DETAIL_8WAY
 * @returns {string} raw HTML
 */
const buildPageNav = (currentView) => {
  const items = PAGE_NAV_ORDER.map((view) => {
    const isActive = view === currentView;
    const index = PAGE_NAV_INDEX[view];
    // Active page is a non-interactive label, not a button.
    if (isActive) {
      return (
        '<span class="' + PAGE_NAV_ITEM_CLASS + ' ' + PAGE_NAV_ITEM_CLASS + '--active" ' +
          'aria-current="page" aria-label="Current page (' + index + ')">' +
          '(' + index + ')' +
        '</span>'
      );
    }
    return (
      '<button type="button" class="' + PAGE_NAV_ITEM_CLASS + '" ' +
        PAGE_NAV_DATA + '="' + escapeHtml(view) + '" ' +
        'aria-label="Go to page ' + index + '">' +
        '(' + index + ')' +
      '</button>'
    );
  });
  return (
    '<div class="' + PAGE_NAV_CLASS + '" role="navigation" ' +
      'aria-label="Card pages">' +
      items.join('') +
    '</div>'
  );
};

/**
 * Build the card header (page nav + title + subtitle).
 *
 * The page nav is always rendered (top-left) so the user always
 * has a way to switch between pages. The title/subtitle block is
 * only rendered when at least one of them has content.
 *
 * @param {{title:string, subtitle:string, view:string}} vm
 * @returns {string} raw HTML
 */
const buildHeader = (vm) => {
  const hasTitle = Boolean(vm.title);
  const hasSubtitle = Boolean(vm.subtitle);
  return (
    '<div class="' + REGIONS.HEADER + '">' +
      '<div class="' + REGIONS.HEADER + '__row">' +
        buildPageNav(vm.view) +
        (hasTitle || hasSubtitle
          ? '<div class="' + REGIONS.HEADER + '__text">' +
              (hasTitle ? '<h2 class="' + REGIONS.TITLE + '">' + escapeHtml(vm.title) + '</h2>' : '') +
              (hasSubtitle ? '<p class="' + REGIONS.SUBTITLE + '">' + escapeHtml(vm.subtitle) + '</p>' : '') +
            '</div>'
          : '') +
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
 * Build the 4-way D-pad + readout content area. Both the D-pad and
 * the readout are self-contained custom elements (defined in
 * dpad.js and readout.js respectively). The factory just drops
 * both elements into the content area and lets the consumer wire
 * them up via:
 *
 *   const dpad  = card.querySelector('dpad-control');
 *   const read  = card.querySelector('dpad-readout');
 *   read.subscribe(dpad);
 *
 * @returns {string} raw HTML
 */
const buildDpadContent = () =>
  '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--dpad">' +
    '<dpad-control></dpad-control>' +
    '<dpad-readout></dpad-readout>' +
  '</div>';

/**
 * Build the 8-way D-pad + readout content area. Same shape as
 * buildDpadContent but uses the 8-way custom element. The 8-way
 * dpad is the next iteration; for now it renders the same 5
 * buttons (it is a 1:1 clone of dpad.js with renamed internals).
 *
 * @returns {string} raw HTML
 */
const buildDpad8wayContent = () =>
  '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--dpad">' +
    '<dpad-8way-control></dpad-8way-control>' +
    '<dpad-readout></dpad-readout>' +
  '</div>';

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
      // Second page: 4-way D-pad view.
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildDpadContent() +
            buildFooter(vm) +
          '</div>' +
        '</ha-card>'
      );
    case LAYOUTS.DETAIL_8WAY:
      // Third page: 8-way D-pad view.
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildDpad8wayContent() +
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
            buildDpadContent() +
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
