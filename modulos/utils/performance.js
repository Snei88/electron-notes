// modulos/utils/performance.js
function advancedDebounce(func, wait, immediate = false) {
  let timeout;
  let result;
  let lastArgs;
  let lastThis;
  let lastCallTime;

  function later() {
    const remaining = wait - (Date.now() - lastCallTime);
    if (remaining <= 0 || remaining > wait) {
      const args = lastArgs;
      const context = lastThis;
      lastArgs = lastThis = undefined;
      result = func.apply(context, args);
    } else {
      timeout = setTimeout(later, remaining);
    }
  }

  return function(...args) {
    lastCallTime = Date.now();
    lastArgs = args;
    lastThis = this;

    if (!timeout) {
      timeout = setTimeout(later, wait);
      if (immediate) {
        result = func.apply(this, args);
      }
    }

    return result;
  };
}

// Debounce para diferentes tipos de operaciones
const debounceConfig = {
  save: 400,      // Guardado rápido
  uiUpdate: 100,  // Actualización de UI
  search: 300,    // Búsqueda
  resize: 250     // Redimensionamiento
};

module.exports = { advancedDebounce, debounceConfig };