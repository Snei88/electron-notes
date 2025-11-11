// modulos/features/sync-manager.js
class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingChanges = [];
    this.init();
  }

  init() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Verificar estado cada 30 segundos
    setInterval(this.checkSyncStatus.bind(this), 30000);
  }

  async queueChange(change) {
    this.pendingChanges.push({
      ...change,
      timestamp: Date.now(),
      id: this.generateId()
    });

    if (this.isOnline) {
      await this.processPendingChanges();
    } else {
      this.showOfflineWarning();
    }
  }

  async processPendingChanges() {
    while (this.pendingChanges.length > 0) {
      const change = this.pendingChanges[0];
      try {
        await this.applyChange(change);
        this.pendingChanges.shift(); // Remover solo si fue exitoso
      } catch (error) {
        console.error('Error syncing change:', error);
        break; // Detener si hay error
      }
    }
  }

  async applyChange(change) {
    switch (change.type) {
      case 'saveNote':
        return await api.saveNote(change.data);
      case 'deleteNote':
        return await api.deleteNote(change.data);
      case 'saveReminder':
        return await api.saveReminder(change.data);
      // ... otros tipos de cambios
    }
  }

  handleOnline() {
    this.isOnline = true;
    this.processPendingChanges();
    this.showSyncNotification();
  }

  handleOffline() {
    this.isOnline = false;
    this.showOfflineWarning();
  }

  showOfflineWarning() {
    // Mostrar notificación de modo offline
    notificationManager.show(
      'Estás trabajando sin conexión. Los cambios se sincronizarán cuando recuperes la conexión.',
      'warning',
      5000
    );
  }

  showSyncNotification() {
    notificationManager.show(
      'Conexión restaurada. Sincronizando cambios...',
      'info',
      3000
    );
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = new SyncManager();