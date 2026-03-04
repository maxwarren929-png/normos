/**
 * NormOS — eventmanager.js
 * Simple pub/sub event bus for decoupled OS communication.
 * All OS modules subscribe to and emit events through this.
 */

class EventManager {
  constructor() {
    this._listeners = {};
  }

  /**
   * Subscribe to an event.
   * @param {string} event  - Event name
   * @param {Function} fn   - Callback(payload)
   * @returns {Function}    - Unsubscribe function
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  /** One-time subscription */
  once(event, fn) {
    const wrapper = (payload) => {
      fn(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /** Unsubscribe */
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  /** Emit event with optional payload */
  emit(event, payload) {
    if (!this._listeners[event]) return;
    // Slice to avoid mutation issues if a handler unsubscribes during dispatch
    [...this._listeners[event]].forEach(fn => {
      try { fn(payload); }
      catch (err) { console.error(`[EventManager] Error in handler for "${event}":`, err); }
    });
  }

  /** Remove all listeners for an event (or all events) */
  clear(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
  }
}

// Standard OS events emitted / listened to:
//   'os:ready'              - Desktop is shown
//   'window:opened'         - { id, appId }
//   'window:closed'         - { id, appId }
//   'window:focused'        - { id }
//   'window:minimized'      - { id }
//   'window:restored'       - { id }
//   'theme:changed'         - { theme }
//   'fs:changed'            - { path }
//   'notify'                - { icon, title, body }
//   'terminal:command'      - { cmd, args, cwd }
//   'user:login'            - { username }
//   'user:logout'           - {}

const EventBus = new EventManager();
