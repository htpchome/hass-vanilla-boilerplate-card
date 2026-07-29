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

// CSS class hooks + data attributes for the D-pad component.
// Buttons are identified by [data-dpad="<direction>"]; the
// card wires up pointer events on the host using delegation.
const DPAD_CLASS = 'dpad';
const DPAD_BTN_CLASS = 'dpad__btn';
const DPAD_BTN_UP = 'dpad__btn--up';
const DPAD_BTN_DOWN = 'dpad__btn--down';
const DPAD_BTN_LEFT = 'dpad__btn--left';
const DPAD_BTN_RIGHT = 'dpad__btn--right';
const DPAD_BTN_MIC = 'dpad__btn--mic';
const DPAD_DATA_ACTION = 'data-dpad';
const DPAD_ACTIONS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  MIC: 'mic',
});

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
 * Build an empty content area — used by views that intentionally
 * have no user content (e.g. a static landing page).
 *
 * @returns {string} raw HTML
 */
const buildEmptyContent = () =>
  '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--empty"></div>';

/**
 * Build a single D-pad button.
 *
 * @param {string} action     one of DPAD_ACTIONS.* (data-dpad value)
 * @param {string} extraClass BEM modifier (e.g. dpad__btn--up)
 * @param {string} iconKey    key into ICON_NAMES (e.g. 'DPAD_UP')
 * @param {string} label      human-readable label for aria-label
 * @param {string} [activeIconKey] optional alternative icon shown
 *                            when the button is in the "active"
 *                            state (used for the mic toggle).
 * @returns {string} raw HTML
 */
const buildDpadButton = (action, extraClass, iconKey, label, activeIconKey) => {
  // For toggle buttons (mic) we render BOTH icons in the DOM and
  // toggle visibility via CSS. The default icon is visible when
  // the button is in its rest state; the active icon is visible
  // when the parent button has the `is-active` class.
  let inner = renderIcon(iconKey, { className: DPAD_BTN_CLASS + '__icon dpad__icon--default' });
  if (activeIconKey) {
    inner += renderIcon(activeIconKey, { className: DPAD_BTN_CLASS + '__icon dpad__icon--active' });
  }
  return (
    '<button type="button" ' +
      'class="' + DPAD_BTN_CLASS + ' ' + extraClass + '" ' +
      DPAD_DATA_ACTION + '="' + escapeHtml(action) + '" ' +
      'aria-label="' + escapeHtml(label) + '" ' +
      'aria-pressed="false">' +
      inner +
    '</button>'
  );
};

/**
 * Build the full D-pad (4 arrows + center mic button).
 *
 * Layout (CSS grid 3x3):
 *
 *        [ up   ]
 *  [ left ][ mic ][ right ]
 *        [ down ]
 *
 * The arrows are momentary (highlight while pressed). The mic is
 * a toggle (stays on until pressed again; green when on).
 *
 * @returns {string} raw HTML
 */
const buildDpad = () => {
  const up = buildDpadButton(DPAD_ACTIONS.UP, DPAD_BTN_UP, 'DPAD_UP', 'Up');
  const down = buildDpadButton(DPAD_ACTIONS.DOWN, DPAD_BTN_DOWN, 'DPAD_DOWN', 'Down');
  const left = buildDpadButton(DPAD_ACTIONS.LEFT, DPAD_BTN_LEFT, 'DPAD_LEFT', 'Left');
  const right = buildDpadButton(DPAD_ACTIONS.RIGHT, DPAD_BTN_RIGHT, 'DPAD_RIGHT', 'Right');
  const mic = buildDpadButton(
    DPAD_ACTIONS.MIC,
    DPAD_BTN_MIC,
    'MICROPHONE',
    'Toggle microphone',
    'MICROPHONE_OFF', // shown when mic is ON (recording in progress)
  );
  return (
    '<div class="' + DPAD_CLASS + '" role="group" aria-label="D-pad control">' +
      '<div class="' + DPAD_CLASS + '__slot">' + up + '</div>' +
      '<div class="' + DPAD_CLASS + '__slot">' + left + mic + right + '</div>' +
      '<div class="' + DPAD_CLASS + '__slot">' + down + '</div>' +
    '</div>'
  );
};

/**
 * Build the D-pad container — used as the content body of the
 * detail view. Wraps `buildDpad()` in a card-content <div>.
 *
 * @returns {string} raw HTML
 */
const buildDpadContent = () =>
  '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--dpad">' +
    buildDpad() +
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
      // Static secondary page: same header + footer as the main
      // view, but the content <div> holds a D-pad touchpad.
      return (
        '<ha-card>' +
          '<div class="' + REGIONS.CARD_WRAPPER + '">' +
            buildHeader(vm) +
            buildDpadContent() +
            buildFooter(vm) +
          '</div>' +
        '</ha-card>'
      );
    case LAYOUTS.SETTINGS:
      // Reserved for a future settings view. For now, treat it
      // identically to the detail view (also shows the D-pad).
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
