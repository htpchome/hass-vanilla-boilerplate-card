/**
 * styles.js
 * ---------------------------------------------------------------
 * Native CSS template literals for component styling.
 *
 * MANDATORY:
 *   All values must come from Home Assistant's own CSS custom
 *   properties / design tokens. This guarantees automatic theme
 *   synchronization (light, dark, and any user-defined theme).
 *
 *   Tokens used:
 *     - --primary-text-color
 *     - --secondary-text-color
 *     - --card-background-color
 *     - --ha-card-background
 *     - --ha-card-border-radius
 *     - --ha-card-border-width
 *     - --primary-color
 *     - --divider-color (supplementary)
 *     - --error-color   (supplementary)
 * ---------------------------------------------------------------
 */

// Card root — wraps everything and inherits HA surface colors.
export const baseStyles = `
  :host {
    display: block;
    /* Inherit HA font stack + sizing */
    font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
    font-size: 14px;
    line-height: 1.4;
    color: var(--primary-text-color);
    box-sizing: border-box;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  ha-card {
    display: block;
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 12px);
    border-width: var(--ha-card-border-width, 1px);
    border-style: solid;
    border-color: var(--divider-color, transparent);
    padding: 0;
    overflow: hidden;
  }
`;

// Card wrapper — the grid that holds header / content / footer.
export const cardStyles = `
  .card-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .card-header {
    display: block;
    padding: 16px 16px 8px 16px;
    border-bottom: 1px solid var(--divider-color, transparent);
  }

  .card-header__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .card-header__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .card-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--primary-text-color);
    line-height: 1.2;
  }

  .card-subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: var(--secondary-text-color);
    line-height: 1.3;
  }

  .card-content {
    padding: 16px;
    color: var(--primary-text-color);
    /* Allow user-supplied HTML to be styled by its own CSS */
  }

  .card-content--dpad {
    display: flex;
    flex-direction: column;   /* stack dpad on top, readout below */
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  /* Keep circle-pad.js portable: size it from the card layout,
     not from the component's internal :host defaults. */
  .card-content--dpad > circle-pad-control {
    width: 100%;
    align-self: stretch;
  }

  .card-content p:first-child { margin-top: 0; }
  .card-content p:last-child  { margin-bottom: 0; }

  .card-footer {
    padding: 8px 16px 12px 16px;
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    text-align: right;
    border-top: 1px solid var(--divider-color, transparent);
  }
`;

// Header page-nav strip — three numeric buttons (1) (2) (3) in
// the top-left of the card header, used to switch between
// internal views. The active page is rendered as a non-button
// <span> with a distinct background; the other two are real
// buttons that fire dpad-press-like events handled by card.js.
export const navStyles = `
  .card-page-nav {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 6px;
  }

  .card-page-nav__item {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    margin: 0;
    padding: 0;
    background: transparent;
    border: 1px solid var(--divider-color, transparent);
    border-radius: 4px;
    color: var(--secondary-text-color);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease,
      border-color 120ms ease;
  }

  .card-page-nav__item:hover,
  .card-page-nav__item:focus-visible {
    background: var(--divider-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    outline: none;
  }

  .card-page-nav__item:active {
    background: var(--divider-color, rgba(127, 127, 127, 0.2));
  }

  .card-page-nav__item--active {
    /* The current page is rendered as a <span> with this class.
       Visually mark it as the selected item: filled background,
       accent border, bold weight. Cursor is default (not a
       button) since clicking it would be a no-op. */
    background: var(--primary-color, #03a9f4);
    border-color: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    font-weight: 600;
    cursor: default;
  }
`;

// Error / status messaging.
export const statusStyles = `
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    color: var(--error-color, #b71c1c);
    background: var(--ha-card-background, var(--card-background-color));
    border: 1px solid var(--error-color, #b71c1c);
    border-radius: var(--ha-card-border-radius, 12px);
    font-size: 0.875rem;
  }

  .error-message ha-icon {
    --mdc-icon-size: 20px;
    color: var(--error-color, #b71c1c);
  }
`;

/**
 * Master style block injected into every card shadow root.
 * Exported as a single tagged-template-friendly array of strings so
 * downstream code can `join('')` or stream into a <style> tag.
 */
export const allStyles = [baseStyles, cardStyles, navStyles, statusStyles].join(
  "\n",
);
