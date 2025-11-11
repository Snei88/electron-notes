// modulos/core/plugin-system.js
class PluginSystem {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin);
    
    // Registrar hooks del plugin
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hookName, handler]) => {
        this.registerHook(hookName, handler);
      });
    }
    
    // Inicializar plugin si tiene método init
    if (typeof plugin.init === 'function') {
      plugin.init();
    }
  }

  registerHook(hookName, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push(handler);
  }

  executeHook(hookName, ...args) {
    if (this.hooks.has(hookName)) {
      return Promise.all(
        this.hooks.get(hookName).map(handler => handler(...args))
      );
    }
    return Promise.resolve();
  }
}

// Ejemplo de plugin
const markdownPlugin = {
  hooks: {
    'note:beforeSave': (note) => {
      // Convertir markdown a HTML si es necesario
      if (note.content && note.content.includes('```')) {
        note.content = this.convertMarkdown(note.content);
      }
      return note;
    }
  },
  
  init() {
    console.log('Markdown plugin initialized');
  },
  
  convertMarkdown(content) {
    // Implementar conversión básica de markdown
    return content
      .replace(/```([^```]+)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
};

module.exports = new PluginSystem();