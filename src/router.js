/**
 * router.js
 * ---------------------------------------------------------------
 * Lightweight internal router / state machine.
 *
 * The card currently has a single "main" view, but the router
 * abstraction is in place so that additional tabs (detail,
 * settings, etc.) can be added without touching the card element.
 *
 * The router is intentionally framework-free:
 *   - it holds a `current` view identifier
 *   - it exposes `navigate(id)` to switch views
 *   - it notifies subscribers via a tiny pub/sub
 * ---------------------------------------------------------------
 */

import { LAYOUTS } from './constants.js';

/**
 * Thin pub/sub used by the card to re-render on view change.
 * Returns an `unsubscribe()` function.
 *
 * @param {string} event
 * @param {(payload:any) => void} fn
 */
const subscribe = (event, fn) => {
  document.addEventListener(event, (e) => fn(e.detail));
  return () => document.removeEventListener(event, fn);
};

const emit = (event, detail) => {
  document.dispatchEvent(new CustomEvent(event, { detail }));
};

export class Router {
  constructor(initial = LAYOUTS.MAIN) {
    this._current = initial;
    this._history = [initial];
  }

  /** Current view identifier. */
  get current() {
    return this._current;
  }

  /** Read-only view history (most recent last). */
  get history() {
    return this._history.slice();
  }

  /**
   * Navigate to a new view. No-op if the id is unknown.
   *
   * @param {string} id
   * @param {object} [payload] arbitrary data passed to subscribers
   * @returns {boolean} true if the view changed
   */
  navigate(id, payload = null) {
    if (!Object.values(LAYOUTS).includes(id)) {
      // Unknown view — log but don't throw.
      // eslint-disable-next-line no-console
      console.warn(`[router] navigate() ignored unknown view: ${id}`);
      return false;
    }
    if (id === this._current) return false;

    this._current = id;
    this._history.push(id);
    if (this._history.length > 20) this._history.shift();
    emit('card-view-changed', { view: id, payload });
    return true;
  }

  /**
   * Return to the previous view if one exists.
   * @returns {boolean} true if the view changed
   */
  back() {
    if (this._history.length <= 1) return false;
    this._history.pop(); // remove current
    const previous = this._history[this._history.length - 1];
    this._current = previous;
    emit('card-view-changed', { view: previous, payload: null });
    return true;
  }

  /**
   * Subscribe to view-change events.
   * @param {(payload:any) => void} fn
   * @returns {() => void} unsubscribe
   */
  onViewChange(fn) {
    return subscribe('card-view-changed', fn);
  }
}

// Singleton — the card and controller share one router instance.
export const router = new Router(LAYOUTS.MAIN);
