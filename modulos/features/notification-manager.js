// modulos/features/notification-manager.js
class NotificationManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.createContainer();
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    notification.innerHTML = `
      <div class="notification-icon">
        <span class="material-symbols-outlined">${icons[type]}</span>
      </div>
      <div class="notification-content">
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    // Estilos dinámicos basados en el tipo
    const typeStyles = {
      success: 'background: #10b981; color: white;',
      error: 'background: #ef4444; color: white;',
      warning: 'background: #f59e0b; color: white;',
      info: 'background: #3b82f6; color: white;'
    };

    notification.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideInRight 0.3s ease-out;
      ${typeStyles[type]}
    `;

    // Agregar estilos para elementos internos
    notification.querySelector('.notification-close').style.cssText = `
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;

    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.removeNotification(notification);
    });

    this.container.appendChild(notification);

    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, duration);
    }

    return notification;
  }

  removeNotification(notification) {
    notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

module.exports = new NotificationManager();