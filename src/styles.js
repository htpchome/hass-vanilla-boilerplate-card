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

// Header nav arrow button — used to switch between internal views.
export const navStyles = `
  .card-nav-arrow {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--secondary-text-color);
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .card-nav-arrow:hover,
  .card-nav-arrow:focus-visible {
    background: var(--divider-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    outline: none;
  }

  .card-nav-arrow:active {
    background: var(--divider-color, rgba(127, 127, 127, 0.2));
  }

  .card-nav-arrow__icon {
    --mdc-icon-size: 24px;
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
export const allStyles = [
  baseStyles,
  cardStyles,
  navStyles,
  statusStyles,
].join('\n');
