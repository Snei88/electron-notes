// modulos/features/theme-manager.js
class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.themes = {
      dark: {
        '--bg-dark': '#0b0f17',
        '--bg-medium': '#111827',
        '--primary-color': '#38e07b',
        '--text-light': '#f9fafb'
      },
      light: {
        '--bg-dark': '#f8fafc',
        '--bg-medium': '#f1f5f9', 
        '--primary-color': '#2563eb',
        '--text-light': '#334155'
      },
      // Nuevo tema azul
      blue: {
        '--bg-dark': '#0f172a',
        '--bg-medium': '#1e293b',
        '--primary-color': '#3b82f6',
        '--text-light': '#f1f5f9'
      }
    };
  }

  setTheme(themeName) {
    if (!this.themes[themeName]) return;
    
    this.currentTheme = themeName;
    const theme = this.themes[themeName];
    
    Object.entries(theme).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });
    
    document.documentElement.setAttribute('data-theme', themeName);
    this.saveTheme(themeName);
  }

  async saveTheme(themeName) {
    try {
      await safeIPCCall(api.setSettings, { theme: themeName });
    } catch (error) {
      console.warn('No se pudo guardar el tema:', error);
    }
  }
}

module.exports = new ThemeManager();