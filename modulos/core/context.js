// modulos/core/context.js - Módulo central sin dependencias
const elements = {};
const state = {};
const api = {};

function initializeContext() {
  // Inicialización segura
  if (typeof window !== 'undefined' && window.api) {
    Object.assign(api, window.api);
  }
}

module.exports = {
  elements,
  state,
  api,
  initializeContext
};