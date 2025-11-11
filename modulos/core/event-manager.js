// modulos/core/event-manager.js
class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  addListener(element, event, handler, options = {}) {
    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }
    
    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(event)) {
      elementListeners.set(event, new Set());
    }
    
    elementListeners.get(event).add(handler);
    element.addEventListener(event, handler, options);
  }

  removeAllListeners(element = null) {
    if (element) {
      const elementListeners = this.listeners.get(element);
      if (elementListeners) {
        elementListeners.forEach((handlers, event) => {
          handlers.forEach(handler => {
            element.removeEventListener(event, handler);
          });
        });
        this.listeners.delete(element);
      }
    } else {
      this.listeners.forEach((elementListeners, el) => {
        elementListeners.forEach((handlers, event) => {
          handlers.forEach(handler => {
            el.removeEventListener(event, handler);
          });
        });
      });
      this.listeners.clear();
    }
  }
}

module.exports = new EventManager();