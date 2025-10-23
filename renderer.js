document.addEventListener('DOMContentLoaded', async () => {
  // ------- Referencias DOM (con safeguards) -------

  const $ = (id) => document.getElementById(id);

  // --- Sistema de notificaciones flotantes ---
  function showToast(message, type = 'info', duration = 2500) {
    const toast = $('app-toast');
    const msgEl = $('app-toast-message');
    const iconEl = $('app-toast-icon');
    if (!toast || !msgEl || !iconEl) return;

    // Configura estilo según tipo
    const colors = {
      info:   ['#3b82f6', 'info'],
      success:['#10b981', 'check_circle'],
      warn:   ['#f59e0b', 'warning'],
      error:  ['#ef4444', 'error']
    };
    const [color, icon] = colors[type] || colors.info;
    iconEl.textContent = icon;
    iconEl.style.color = color;
    msgEl.textContent = message;

    toast.style.opacity = '1';
    toast.style.pointerEvents = 'auto';

    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.pointerEvents = 'none';
    }, duration);
  }

  const notesTbody = $('notes-tbody');
  const searchInput = $('search-input');

  const createNoteBtn = $('create-note-btn');
  const createReminderBtn = $('create-reminder-btn');
  const startRecordingBtn = $('start-recording-btn');
  const stopRecordingBtn = $('stop-recording-btn');
  const recordingStatus = $('recording-status');
  const contextMenu = $('context-menu');
  const ctxOpenFloat = $('ctx-open-float');
  const ctxDelete = $('ctx-delete');
  const allNotesNav = $('all-notes-nav');
  const trashNav = $('trash-nav');
  const remindersNav = $('reminders-nav');
  const drawingNav = $('drawing-nav');
  const mainTitle = $('main-title');
  const emptyTrashFloatingBtn = $('empty-trash-floating-btn');
  const themeToggleBtn = $('theme-toggle-btn');

  // Drawing modal elements
  const drawingModal = $('drawing-modal');
  const closeDrawingBtn = $('close-drawing-btn');
  const drawingCanvas = $('drawing-canvas');
  const drawingColorPicker = $('drawing-color-picker');
  const drawingBrushSize = $('drawing-brush-size');
  const drawingClearBtn = $('drawing-clear-btn');
  const drawingSaveBtn = $('drawing-save-btn');
  const createDrawingBtn = $('create-drawing-btn');

  // Toolbar elements
  const toolPencil = $('tool-pencil');
  const toolBrush = $('tool-brush');
  const toolEraser = $('tool-eraser');
  const toolFill = $('tool-fill');
  const toolLine = $('tool-line');
  const toolRectangle = $('tool-rectangle');
  const toolCircle = $('tool-circle');
  const toolText = $('tool-text');
  const brushSizeDisplay = $('brush-size-display');
  const drawingUndoBtn = $('drawing-undo-btn');
  const drawingRedoBtn = $('drawing-redo-btn');

  // Modal Recordatorios
  const reminderModal = $('reminder-modal');
  const reminderTitleInput = $('reminder-title');
  const reminderDescriptionInput = $('reminder-description');
  const reminderDatetimeInput = $('reminder-datetime');
  const reminderCancelBtn = $('reminder-cancel');
  const reminderSaveBtn = $('reminder-save');

  // Window controls
  const minimizeBtn = $('minimize-btn');
  const maximizeBtn = $('maximize-btn');
  const closeBtn = $('close-btn');

  // ------- Estados -------
  let notes = {};
  let trashNotes = {};
  let reminders = {};
  // 'all' | 'trash' | 'reminders' | 'drawing'
  let currentView = 'all';

  // Drawing state
  let isDrawing = false;
  let ctx = drawingCanvas ? drawingCanvas.getContext('2d') : null;
  let lastX = 0;
  let lastY = 0;
  let currentTool = 'pencil';
  let undoStack = [];
  let redoStack = [];
  let startX, startY;
  let isTextMode = false;
  let textInput = null;
  let currentDrawingNoteId = null;

  // Preview layer para formas
  let previewCanvas = null;
  let previewCtx = null;

  // Sistema figuras (placeholder para futuro)
  let shapes = [];
  let selectedShape = null;
  let isDragging = false;
  let isResizing = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let resizeHandle = null;
  let selectionMode = false;

  // Grabación audio
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  let audioInputDevices = [];
  let selectedAudioDeviceId = '';
  let currentStream = null;
  let audioContext = null;
  let analyserNode = null;
  let audioLevelInterval = null;
  
  // ===== SISTEMA DE MODALES PERSONALIZADOS =====

  class ModalSystem {
    constructor() {
      this.overlay = document.getElementById('custom-modal-overlay');
      this.modal = document.getElementById('custom-modal');
      this.toastContainer = document.getElementById('toast-container') || this._ensureToastContainer();
      this.setupEventListeners();
    }

    _ensureToastContainer() {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.style.position = 'fixed';
        el.style.bottom = '16px';
        el.style.right = '16px';
        el.style.zIndex = '99999';
        document.body.appendChild(el);
      }
      return el;
    }

    setupEventListeners() {
      if (this.overlay) {
        this.overlay.addEventListener('click', (e) => {
          if (e.target === this.overlay) this.closeModal();
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay && !this.overlay.classList.contains('hidden')) {
          this.closeModal();
        }
      });
    }

    async showConfirm(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Confirmar acción',
          message = '¿Estás seguro de que quieres realizar esta acción?',
          type = 'warning',
          confirmText = 'Confirmar',
          cancelText = 'Cancelar',
          danger = false
        } = options;

        const modalClass = danger ? 'modal-danger' :
                          type === 'warning' ? 'modal-warning' :
                          type === 'success' ? 'modal-success' : 'modal-info';

        const iconType = danger ? 'danger' : type;
        const iconMap = {
          danger: 'warning',
          warning: 'warning',
          success: 'check_circle',
          info: 'info'
        };

        if (!this.modal || !this.overlay) {
          // fallback to native confirm
          const confirmed = window.confirm(message);
          resolve(!!confirmed);
          return;
        }

        this.modal.innerHTML = `
          <div class="${modalClass}">
            <div class="modal-header">
              <div class="modal-icon ${iconType}">
                <span class="material-symbols-outlined">${iconMap[iconType]}</span>
              </div>
              <h2 class="modal-title">${title}</h2>
            </div>
            <div class="modal-content">
              <p>${message}</p>
            </div>
            <div class="modal-actions">
              <button class="modal-btn modal-btn-secondary" id="modal-cancel">${cancelText}</button>
              <button class="modal-btn ${danger ? 'modal-btn-danger' : 'modal-btn-primary'}" id="modal-confirm">${confirmText}</button>
            </div>
          </div>
        `;

        this.openModal();

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        const cleanup = () => {
          confirmBtn?.removeEventListener('click', confirmHandler);
          cancelBtn?.removeEventListener('click', cancelHandler);
          this.closeModal();
        };

        const confirmHandler = () => { cleanup(); resolve(true); };
        const cancelHandler = () => { cleanup(); resolve(false); };

        confirmBtn?.addEventListener('click', confirmHandler);
        cancelBtn?.addEventListener('click', cancelHandler);
        confirmBtn?.focus();
      });
    }

    showAlert(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Información',
          message = '',
          type = 'info',
          buttonText = 'Aceptar'
        } = options;

        const modalClass = type === 'warning' ? 'modal-warning' :
                          type === 'success' ? 'modal-success' : 'modal-info';

        const iconMap = { warning: 'warning', success: 'check_circle', info: 'info' };

        if (!this.modal || !this.overlay) {
          window.alert(message);
          resolve(true);
          return;
        }

        this.modal.innerHTML = `
          <div class="${modalClass}">
            <div class="modal-header">
              <div class="modal-icon ${type}">
                <span class="material-symbols-outlined">${iconMap[type]}</span>
              </div>
              <h2 class="modal-title">${title}</h2>
            </div>
            <div class="modal-content">
              <p>${message}</p>
            </div>
            <div class="modal-actions">
              <button class="modal-btn modal-btn-primary" id="modal-ok">${buttonText}</button>
            </div>
          </div>
        `;

        this.openModal();

        const okBtn = document.getElementById('modal-ok');
        const cleanup = () => { okBtn?.removeEventListener('click', okHandler); this.closeModal(); };
        const okHandler = () => { cleanup(); resolve(true); };
        okBtn?.addEventListener('click', okHandler);
        okBtn?.focus();
      });
    }

    openModal() {
      if (!this.overlay || !this.modal) return;
      this.overlay.classList.remove('hidden');
      this.modal.classList.remove('scale-95', 'opacity-0');
      this.modal.offsetHeight; // force reflow
      this.modal.classList.add('scale-100', 'opacity-100');
    }

    closeModal() {
      if (!this.overlay || !this.modal) return;
      this.modal.classList.add('scale-95', 'opacity-0');
      this.overlay.classList.add('fade-out');
      setTimeout(() => {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('fade-out');
        this.modal.classList.remove('scale-100', 'opacity-100');
      }, 200);
    }

    showToast(options = {}) {
      const { title = '', message = '', type = 'info', duration = 4000, action = null } = options;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.style.transform = 'translateX(20px)';
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.25s ease';
      toast.innerHTML = `
        <div class="toast-icon"><span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'}</span></div>
        <div class="toast-content">${title ? `<div class="toast-title">${title}</div>` : ''}<div class="toast-message">${message}</div></div>
        <button class="toast-close"><span class="material-symbols-outlined">close</span></button>
      `;
      this.toastContainer.appendChild(toast);
      // animate in
      requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; });

      const closeToast = () => {
        toast.style.transform = 'translateX(20px)';
        toast.style.opacity = '0';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
      };

      const closeBtn = toast.querySelector('.toast-close');
      closeBtn?.addEventListener('click', closeToast);

      if (duration > 0) setTimeout(closeToast, duration);
      if (action) {
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', () => { action(); closeToast(); });
      }

      return closeToast;
    }
  }

  // Instancia global del sistema de modales
  let modalSystem;

  function initModalSystem() {
    try {
      modalSystem = new ModalSystem();
    } catch (err) {
      console.warn('No se pudo inicializar ModalSystem, se usará fallback', err);
      modalSystem = null;
    }
  }

  // Wrappers
  async function showConfirm(options) {
    if (!modalSystem) initModalSystem();
    if (!modalSystem) return window.confirm(options?.message || '¿Continuar?');
    return await modalSystem.showConfirm(options);
  }

  async function showAlert(options) {
    if (!modalSystem) initModalSystem();
    if (!modalSystem) { window.alert(options?.message || ''); return true; }
    return await modalSystem.showAlert(options);
  }

  function showToast(options) {
    if (!modalSystem) initModalSystem();
    if (!modalSystem) { /* fallback simple */
      const msg = (options && (options.message || options.title)) || '...';
      const t = document.createElement('div'); t.textContent = msg; document.body.appendChild(t);
      setTimeout(() => t.remove(), 2000);
      return () => {};
    }
    return modalSystem.showToast(options);
  }
  
  // Presets de calidad de audio
  const audioQualityPresets = {
    standard: {
      sampleRate: 22050,
      channelCount: 1,
      audioBitsPerSecond: 64000, // 64 kbps
      label: 'Estándar (64 kbps)',
      description: 'Buena relación calidad/tamaño'
    },
    good: {
      sampleRate: 44100,
      channelCount: 1,
      audioBitsPerSecond: 96000, // 96 kbps
      label: 'Buena (96 kbps)',
      description: 'Calidad mejorada'
    },
    high: {
      sampleRate: 48000,
      channelCount: 1,
      audioBitsPerSecond: 128000, // 128 kbps
      label: 'Alta (128 kbps)',
      description: 'Calidad superior'
    },
    professional: {
      sampleRate: 48000,
      channelCount: 2, // Estéreo
      audioBitsPerSecond: 192000, // 192 kbps
      label: 'Profesional (192 kbps)',
      description: 'Máxima calidad - archivos más grandes'
    }
  };

  let currentAudioQuality = 'good';

  function setAudioQuality(quality) {
    if (audioQualityPresets[quality]) {
      currentAudioQuality = quality;
      const preset = audioQualityPresets[quality];
      showToast(`Calidad de audio: ${preset.label}`, 'success');
      console.log('Calidad de audio establecida:', preset);
    } else {
      showToast('Calidad de audio desconocida', 'warn');
      console.warn('Intento de establecer calidad desconocida:', quality);
    }
  }

  function createAudioQualitySelector() {
    const selector = document.createElement('div');
    selector.className = 'fixed bottom-32 right-6 bg-gray-800 p-4 rounded-lg shadow-lg z-50 min-w-72';
    selector.innerHTML = `
      <h4 class="text-white font-semibold mb-3">Calidad de Grabación</h4>
      <div class="space-y-2 mb-3">
        ${Object.entries(audioQualityPresets).map(([key, preset]) => `
          <label class="flex items-center p-2 rounded cursor-pointer hover:bg-gray-700 ${
            key === currentAudioQuality ? 'bg-primary-500/20 border border-primary-500/30' : ''
          }">
            <input type="radio" name="audio-quality" value="${key}" 
                   ${key === currentAudioQuality ? 'checked' : ''} 
                   class="mr-3 text-primary-500">
            <div>
              <div class="text-white font-medium">${preset.label}</div>
              <div class="text-gray-400 text-sm">${preset.description}</div>
            </div>
          </label>
        `).join('')}
      </div>
      <div class="flex gap-2">
        <button id="confirm-quality" class="flex-1 bg-primary-500 text-white rounded p-2 hover:bg-primary-600">Aplicar</button>
        <button id="cancel-quality" class="flex-1 bg-gray-600 text-white rounded p-2 hover:bg-gray-700">Cancelar</button>
      </div>
    `;
    document.body.appendChild(selector);
    const confirmBtn = selector.querySelector('#confirm-quality');
    const cancelBtn = selector.querySelector('#cancel-quality');
    confirmBtn.addEventListener('click', () => {
      const selected = selector.querySelector('input[name="audio-quality"]:checked');
      if (selected) setAudioQuality(selected.value);
      document.body.removeChild(selector);
    });
    cancelBtn.addEventListener('click', () => document.body.removeChild(selector));
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!selector.contains(e.target)) {
          if (document.body.contains(selector)) document.body.removeChild(selector);
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 100);
  }

  // Variable global para el botón de calidad de audio
  let audioQualityButton = null;

function addAudioQualityButton() {
    // Si el botón ya existe, no crear otro
    if (document.getElementById('audio-quality-btn')) {
        audioQualityButton = document.getElementById('audio-quality-btn');
        return;
    }
    
    const qualityBtn = document.createElement('button');
    qualityBtn.id = 'audio-quality-btn';
    qualityBtn.innerHTML = '<span class="material-symbols-outlined text-lg">settings</span>';
    qualityBtn.className = 'fixed bottom-32 right-6 inline-flex items-center justify-center gap-2 w-12 h-12 rounded-full bg-gray-600 text-white font-semibold shadow-lg transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 z-40';
    qualityBtn.title = 'Configurar calidad de audio';
    qualityBtn.addEventListener('click', createAudioQualitySelector);
    document.body.appendChild(qualityBtn);
    audioQualityButton = qualityBtn;
    
    // Ocultar por defecto - solo se mostrará en la vista de notas
    hideAudioQualityButton();
}

  function showAudioQualityButton() {
    if (audioQualityButton) {
      audioQualityButton.classList.remove('hidden');
    }
  }

  function hideAudioQualityButton() {
    if (audioQualityButton) {
      audioQualityButton.classList.add('hidden');
    }
  }

  // ------- Utilidades -------
  const fmtDate = (date) =>
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);

  const fmtTime = (date) =>
    new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    if (themeToggleBtn) themeToggleBtn.textContent = theme === 'light' ? 'light_mode' : 'dark_mode';
  }

  async function initTheme() {
    const s = await window.api.getSettings();
    applyTheme(s?.theme || 'dark');
  }

  function formatDateRelativeOrLocal(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.abs(now - date);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return fmtDate(date);
  }

  function formatReminderDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const ms = date - now;
    const diffDays = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Hoy, ${fmtTime(date)}`;
    if (diffDays === 1) return `Mañana, ${fmtTime(date)}`;
    if (diffDays > 1 && diffDays < 7) {
      const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      return `${days[date.getDay()]}, ${fmtTime(date)}`;
    }
    return `${fmtDate(date)} ${fmtTime(date)}`;
  }

  function ensureImprovedStylesOnce() {
    if (document.getElementById('improved-styles')) return;
    const styleSheet = document.createElement('style');
    styleSheet.id = 'improved-styles';
    styleSheet.textContent = `
      .note-item { transition: all .2s ease; }
      .note-item:hover { transform: translateX(4px); }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .max-w-xs { max-width: 20rem; }
    `;
    document.head.appendChild(styleSheet);
  }

  function updateCreateButtonsVisibility() {
    if (!createNoteBtn || !createReminderBtn || !createDrawingBtn) return;
    createNoteBtn.style.display = 'none';
    createReminderBtn.style.display = 'none';
    createDrawingBtn.style.display = 'none';
    if (currentView === 'all') createNoteBtn.style.display = 'flex';
    else if (currentView === 'reminders') createReminderBtn.style.display = 'flex';
    else if (currentView === 'drawing') createDrawingBtn.style.display = 'flex';
  }

  function toggleNavActive(activeEl, ...others) {
    if (!activeEl) return;
    activeEl.classList.add('bg-primary-500/10', 'text-primary-500');
    activeEl.classList.remove('text-gray-400', 'hover:bg-gray-800/40');
    others.forEach((el) => {
      if (!el) return;
      el.classList.remove('bg-primary-500/10', 'text-primary-500');
      el.classList.add('text-gray-400', 'hover:bg-gray-800/40');
    });
  }

  function getTheadRow() {
    const tr = document.querySelector('thead tr');
    return tr || null;
  }

  function ensureDrawingHeaderColumn(isDrawingView) {
    const tr = getTheadRow();
    if (!tr) return;
    const firstTh = tr.firstElementChild;
    const isPreviewThere = firstTh && firstTh.dataset?.col === 'preview';
    if (isDrawingView && !isPreviewThere) {
      const th = document.createElement('th');
      th.dataset.col = 'preview';
      th.className = 'p-4 text-left text-gray-300 font-medium';
      th.textContent = 'Vista Previa';
      tr.insertBefore(th, tr.firstChild);
    } else if (!isDrawingView && isPreviewThere) {
      tr.removeChild(firstTh);
    }
    // If smart-scroll is active, update indicators because the table header changed
    try { updateScrollState(); } catch (err) { /* noop */ }
  }

  // ------- Renderizado de filas -------
  function createActionButton(icon, title, colorClass, hoverClass, onClick) {
    const button = document.createElement('button');
    button.classList.add('p-2', 'rounded-full', 'transition-colors', 'duration-200', hoverClass);
    button.innerHTML = `<span class="material-symbols-outlined ${colorClass}">${icon}</span>`;
    button.title = title;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return button;
  }

  function createNoteRow(item) {
    const row = document.createElement('tr');
    row.classList.add('hover:bg-gray-800/40', 'group', 'note-item');
    row.dataset.id = item.id;

    // Título + icono
    const titleCell = document.createElement('td');
    titleCell.className = 'p-4 text-white flex items-center gap-2';
    if (item.drawingPath) {
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-blue-400 text-sm flex-shrink-0';
      icon.textContent = 'brush';
      titleCell.appendChild(icon);
    } else if (item.audioFiles && Array.isArray(item.audioFiles) && item.audioFiles.some(a => a.fileName && a.filePath)) {
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-green-400 text-sm flex-shrink-0';
      icon.textContent = 'mic';
      titleCell.appendChild(icon);
    }
    const titleText = document.createElement('span');
    titleText.textContent = item.title || 'Sin título';
    titleText.classList.add('truncate', 'max-w-xs');
    titleCell.appendChild(titleText);
    titleCell.title = item.title || 'Sin título';

    titleCell.addEventListener('click', () => {
      if (currentView === 'reminders') {
        if (item.noteId) window.api.openInFloatWindow(item.noteId);
        else {
          const rd = new Date(item.reminderTime);
          alert(`Recordatorio: ${item.title}\nDescripción: ${item.description || 'Sin descripción'}\nFecha: ${rd.toLocaleString('es-CO')}`);
        }
      } else {
        window.api.openInFloatWindow(item.id);
      }
    });

    // Fecha
    const dateCell = document.createElement('td');
    dateCell.className = 'p-4 text-gray-400 whitespace-nowrap';
    dateCell.textContent = currentView === 'reminders'
      ? formatReminderDate(item.reminderTime)
      : formatDateRelativeOrLocal(item.updatedAt);

    // Acciones
    const actionsCell = document.createElement('td');
    actionsCell.className = 'p-4 text-right';
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

    if (currentView === 'trash') {
      const recoverBtn = createActionButton('restore', 'Recuperar', 'text-green-400', 'hover:bg-green-500/10', () => recoverNote(item.id));
      const delForeverBtn = createActionButton('delete_forever', 'Eliminar Permanentemente', 'text-red-400', 'hover:bg-red-500/10', () => deleteNotePermanent(item.id));
      actionsDiv.append(recoverBtn, delForeverBtn);
    } else if (currentView === 'reminders') {
      const deleteBtn = createActionButton('delete', 'Eliminar Recordatorio', 'text-red-400', 'hover:bg-red-500/10', () => deleteReminder(item.id));
      actionsDiv.append(deleteBtn);
    } else {
      const viewBtn = createActionButton('visibility', 'Ver', 'text-gray-400', 'hover:bg-white/10', () => window.api.openInFloatWindow(item.id));
      const editBtn = createActionButton('edit', 'Editar', 'text-gray-400', 'hover:bg-white/10', () => window.api.openInFloatWindow(item.id));
      const deleteBtn = createActionButton('delete', 'Eliminar', 'text-red-400', 'hover:bg-red-500/10', () => deleteNote(item.id));
      actionsDiv.append(viewBtn, editBtn, deleteBtn);
    }

    actionsCell.appendChild(actionsDiv);

    // Ensamblar
    row.append(titleCell, dateCell, actionsCell);
    row.addEventListener('contextmenu', (e) => showContextMenu(e, item.id));
    return row;
  }

  function renderNotesList(filteredNotes = null) {
    if (!notesTbody) return;
    notesTbody.innerHTML = '';

    let notesToRender;
    if (currentView === 'trash') {
      notesToRender = filteredNotes || Object.values(trashNotes);
      ensureDrawingHeaderColumn(false);
    } else if (currentView === 'reminders') {
      notesToRender = filteredNotes || Object.values(reminders);
      ensureDrawingHeaderColumn(false);
    } else if (currentView === 'drawing') {
      // Esta vista usa su propia rutina: renderDrawingView()
      ensureDrawingHeaderColumn(true);
      renderDrawingView(filteredNotes);
      return;
    } else {
      notesToRender = filteredNotes || Object.values(notes).filter(n => !n.drawingPath);
      ensureDrawingHeaderColumn(false);
    }

    const sorted = notesToRender.slice().sort((a, b) => {
      if (currentView === 'reminders') {
        return new Date(a.reminderTime) - new Date(b.reminderTime);
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    const fragment = document.createDocumentFragment();

    if (sorted.length === 0) {
      const row = document.createElement('tr');
      const colspan = 3;
      row.innerHTML = `
        <td colspan="${colspan}" class="p-8 text-center text-gray-500">
          <div class="flex flex-col items-center justify-center">
            <span class="material-symbols-outlined text-5xl mb-4">
              ${currentView === 'trash' ? 'delete' : currentView === 'reminders' ? 'notifications' : 'note'}
            </span>
            <p class="text-lg font-medium mb-2">
              ${currentView === 'trash' ? 'La papelera está vacía' : currentView === 'reminders' ? 'No hay recordatorios' : 'No hay notas'}
            </p>
            <p class="text-sm">
              ${currentView === 'trash' ? 'Las notas eliminadas aparecerán aquí'
        : currentView === 'reminders' ? 'Crea recordatorios para verlos aquí'
          : 'Crea tu primera nota para comenzar'}
            </p>
          </div>
        </td>`;
      fragment.appendChild(row);
    } else {
      sorted.forEach((item) => fragment.appendChild(createNoteRow(item)));
    }

    notesTbody.appendChild(fragment);
  }

  // ------- Dibujo (canvas) -------
  function scaleCanvasForDPR(canvas, ctx) {
    const container = canvas.parentElement;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initDrawingCanvas() {
    if (!drawingCanvas || !ctx) return;

    scaleCanvasForDPR(drawingCanvas, ctx);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Number(drawingBrushSize?.value) || 4;
    ctx.strokeStyle = drawingColorPicker?.value || '#000000';

    // Fondo blanco inicial
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    ctx.restore();

    if (brushSizeDisplay && drawingBrushSize) {
      brushSizeDisplay.textContent = drawingBrushSize.value;
    }

    shapes = [];
    selectedShape = null;
    isDragging = false;
    isResizing = false;
    selectionMode = false;

    selectTool('pencil', toolPencil);

    undoStack = [];
    redoStack = [];
    saveState(); // estado base
    updateUndoRedoButtons();
  }

  function saveState() {
    if (!drawingCanvas) return;
    // Evitar saturar el stack mientras estás trazando
    if (isDrawing) return;
    if (undoStack.length >= 50) undoStack.shift();
    undoStack.push(drawingCanvas.toDataURL('image/png'));
    redoStack = [];
    updateUndoRedoButtons();
  }

  function restoreState(dataURL) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      ctx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
    };
    img.src = dataURL;
  }

  function updateUndoRedoButtons() {
    if (drawingUndoBtn) drawingUndoBtn.disabled = undoStack.length <= 1;
    if (drawingRedoBtn) drawingRedoBtn.disabled = redoStack.length === 0;
  }

  function undo() {
    if (undoStack.length > 1) {
      const last = undoStack.pop();
      redoStack.push(last);
      const prev = undoStack[undoStack.length - 1];
      restoreState(prev);
    }
    updateUndoRedoButtons();
  }

  function redo() {
    if (redoStack.length > 0) {
      const state = redoStack.pop();
      restoreState(state);
      undoStack.push(state);
    }
    updateUndoRedoButtons();
  }

  function createPreviewCanvas() {
    if (!drawingCanvas) return;
    if (!previewCanvas) {
      previewCanvas = document.createElement('canvas');
      previewCanvas.style.position = 'absolute';
      previewCanvas.style.pointerEvents = 'none';
      previewCanvas.style.left = '0';
      previewCanvas.style.top = '0';
      previewCtx = previewCanvas.getContext('2d');
    }
    // Sin DPR: el preview se dibuja en coordenadas CSS (suficiente para guías)
    const rect = drawingCanvas.getBoundingClientRect();
    previewCanvas.width = rect.width;
    previewCanvas.height = rect.height;
    previewCanvas.style.width = `${rect.width}px`;
    previewCanvas.style.height = `${rect.height}px`;
    if (!drawingCanvas.parentElement.contains(previewCanvas)) {
      drawingCanvas.parentElement.appendChild(previewCanvas);
    }
  }

  function clearPreview() {
    if (previewCtx && previewCanvas) {
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  }

  function removePreviewCanvas() {
    if (previewCanvas && previewCanvas.parentElement) {
      previewCanvas.parentElement.removeChild(previewCanvas);
    }
    previewCanvas = null;
    previewCtx = null;
  }

  function drawShapePreview(x1, y1, x2, y2, shape) {
    if (!previewCtx) return;
    const w = x2 - x1;
    const h = y2 - y1;
    previewCtx.beginPath();
    if (shape === 'rectangle') {
      previewCtx.rect(x1, y1, w, h);
    } else if (shape === 'circle') {
      const r = Math.sqrt(w * w + h * h) / 2;
      previewCtx.arc(x1 + w / 2, y1 + h / 2, r, 0, 2 * Math.PI);
    } else if (shape === 'line') {
      previewCtx.moveTo(x1, y1);
      previewCtx.lineTo(x2, y2);
    }
    previewCtx.strokeStyle = drawingColorPicker?.value || '#000000';
    previewCtx.lineWidth = Number(drawingBrushSize?.value) || 4;
    previewCtx.stroke();
  }

  function draw(e) {
    if (!isDrawing || !ctx) return;
    const { offsetX, offsetY } = e;
    if (currentTool === 'pencil' || currentTool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawingColorPicker?.value || '#000';
      ctx.lineWidth = Number(drawingBrushSize?.value) || 4;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      [lastX, lastY] = [offsetX, offsetY];
    } else if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = Number(drawingBrushSize?.value) || 12;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      [lastX, lastY] = [offsetX, offsetY];
    } else if (['line','rectangle','circle'].includes(currentTool)) {
      createPreviewCanvas();
      clearPreview();
      drawShapePreview(startX, startY, offsetX, offsetY, currentTool);
      [lastX, lastY] = [offsetX, offsetY];
    }
  }

  function startDrawing(e) {
    if (!ctx) return;
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];

    if (currentTool === 'fill') {
      const fillColor = hexToRgbaArray(drawingColorPicker?.value || '#000000');
      floodFill(e.offsetX, e.offsetY, fillColor);
      isDrawing = false;
      saveState();
    } else if (currentTool === 'text') {
      addText(e.offsetX, e.offsetY);
      isDrawing = false;
    } else {
      startX = e.offsetX;
      startY = e.offsetY;
    }
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (['line','rectangle','circle'].includes(currentTool)) {
      drawShape(startX, startY, lastX, lastY, currentTool);
      clearPreview();
      removePreviewCanvas();
      saveState();
    } else if (['pencil','brush','eraser'].includes(currentTool)) {
      saveState();
    }
  }

  function hexToRgbaArray(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16), 255] : [0,0,0,255];
  }

  function clearDrawing() {
    if (!ctx || !drawingCanvas) return;
    // No empujamos estado si ya estamos en el base
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    ctx.restore();
    redoStack = [];
    updateUndoRedoButtons();
    saveState();
  }

  async function saveDrawing() {
    if (!drawingCanvas) return;
    const dataURL = drawingCanvas.toDataURL('image/png');
    const title = 'Dibujo';
    if (currentDrawingNoteId) {
      window.api.saveDrawing({ dataURL, noteId: currentDrawingNoteId, title });
    } else {
      window.api.saveDrawing({ dataURL, noteId: null, title });
    }
    if (drawingModal) drawingModal.classList.add('hidden');
    currentDrawingNoteId = null;
  }

  function selectTool(tool, button) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('bg-gray-600'));
    if (button) button.classList.add('bg-gray-600');
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    else ctx.globalCompositeOperation = 'source-over';
    if (tool === 'text') {
      isTextMode = true;
      if (drawingCanvas) drawingCanvas.style.cursor = 'text';
    } else {
      isTextMode = false;
      if (drawingCanvas) drawingCanvas.style.cursor = 'crosshair';
    }
  }

  function floodFill(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    const data = imageData.data;
    const target = getPixelColor(x, y, data);
    if (colorsMatch(target, fillColor)) return;
    const queue = [[x, y]];
    while (queue.length) {
      const [cx, cy] = queue.shift();
      if (cx < 0 || cx >= drawingCanvas.width || cy < 0 || cy >= drawingCanvas.height) continue;
      const cur = getPixelColor(cx, cy, data);
      if (!colorsMatch(cur, target)) continue;
      setPixelColor(cx, cy, fillColor, data);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function getPixelColor(x, y, data) {
    const i = (y * drawingCanvas.width + x) * 4;
    return [data[i], data[i+1], data[i+2], data[i+3]];
  }

  function setPixelColor(x, y, color, data) {
    const i = (y * drawingCanvas.width + x) * 4;
    data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = color[3];
  }

  function colorsMatch(a, b) {
    return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3];
  }

  function drawShape(x1, y1, x2, y2, shape) {
    const w = x2 - x1;
    const h = y2 - y1;
    ctx.beginPath();
    if (shape === 'rectangle') {
      ctx.rect(x1, y1, w, h);
      ctx.stroke();
    } else if (shape === 'circle') {
      const r = Math.sqrt(w*w + h*h) / 2;
      ctx.arc(x1 + w/2, y1 + h/2, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function addText(x, y) {
    if (!drawingCanvas) return;
    if (textInput) textInput.remove();
    const input = document.createElement('input');
    textInput = input;
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.fontSize = (Number(drawingBrushSize?.value) || 16) + 'px';
    input.style.color = drawingColorPicker?.value || '#000';
    input.style.background = 'rgba(255,255,255,.85)';
    input.style.border = '1px solid #000';
    input.style.outline = 'none';
    input.style.padding = '2px';
    input.style.zIndex = '1000';
    const container = drawingCanvas.parentElement;
    container.appendChild(input);
    input.focus();

    input.addEventListener('blur', () => {
      if (input && input.value.trim()) {
        ctx.fillStyle = drawingColorPicker?.value || '#000';
        ctx.font = `${Number(drawingBrushSize?.value) || 16}px Arial`;
        ctx.fillText(input.value.trim(), x, y + parseInt(drawingBrushSize?.value || '16', 10));
        saveState();
      }
      input.remove();
      textInput = null;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { input.value = ''; input.blur(); }
    });
  }

  // ------- Dibujo: edición -------
  // Función mejorada para abrir dibujo para edición
  async function openDrawingForEdit(noteId) {
    if (drawingSaveInProgress) {
      console.log(' Operación de dibujo en progreso, ignorando apertura');
      return;
    }
    
    const note = notes[noteId];
    if (!note || !note.drawingPath) return;
    
    currentDrawingNoteId = noteId;
    drawingModal?.classList.remove('hidden');
    
    // Pequeño delay para asegurar que el modal esté visible
    setTimeout(() => {
      initDrawingCanvas();
      
      // Cargar el dibujo existente
      if (note.drawingPath) {
        loadExistingDrawing(note.drawingPath);
      }
    }, 50);
  }

  // Función para cargar dibujo existente
  async function loadExistingDrawing(drawingPath) {
    try {
      const dataURL = await window.api.getDrawingData(drawingPath);
      const img = new Image();
      
      img.onload = () => {
        if (ctx && drawingCanvas) {
          // Limpiar el canvas y dibujar la imagen
          ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
          ctx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
          
          // Guardar el estado inicial en el undo stack
          saveState();
          
          console.log(' Dibujo existente cargado correctamente');
        }
      };
      
      img.onerror = (error) => {
        console.error(' Error al cargar la imagen del dibujo:', error);
        showToast('Error al cargar el dibujo existente', 'error');
      };
      
      img.src = dataURL;
      
    } catch (err) {
      console.error(' Error en loadExistingDrawing:', err);
      showToast('Error al cargar el dibujo: ' + (err?.message || err), 'error');
    }
  }

  function renderDrawingView(filtered = null) {
    if (!notesTbody) return;
    console.log(' Renderizando vista de dibujos...');

    // Limpiar completamente
    notesTbody.innerHTML = '';

    ensureDrawingHeaderColumn(true);

    const allDrawing = Object.values(notes).filter(n => n.drawingPath);
    console.log(`Dibujos encontrados: ${allDrawing.length}`);
    
    const list = filtered
      ? allDrawing.filter(n => filtered.some(f => f.id === n.id))
      : allDrawing;

    if (list.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.className = 'p-4 text-center text-gray-400';
      cell.innerHTML = 'No hay dibujos<br><button id="open-drawing-modal-btn" class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Crear Nuevo Dibujo</button>';
      row.appendChild(cell);
      notesTbody.appendChild(row);
      const btn = document.getElementById('open-drawing-modal-btn');
      btn?.addEventListener('click', () => {
        drawingModal?.classList.remove('hidden');
        initDrawingCanvas();
      });
      return;
    }

    // Eliminar duplicados por ID antes de renderizar
    const uniqueDrawings = [];
    const seenIds = new Set();
    
    list.forEach(note => {
      if (!seenIds.has(note.id)) {
        seenIds.add(note.id);
        uniqueDrawings.push(note);
      }
    });
    
    console.log(` Dibujos únicos a renderizar: ${uniqueDrawings.length}`);
    
    uniqueDrawings.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    const fragment = document.createDocumentFragment();
    
    uniqueDrawings.forEach(async (note) => {
      const row = createDrawingRow(note);
      fragment.appendChild(row);
    });
    
    notesTbody.appendChild(fragment);
    
    updateScrollState();
  }

  // Función auxiliar para crear filas de dibujo
  function createDrawingRow(note) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-800/40 group note-item';
    row.dataset.id = note.id;

    // Preview
    const previewCell = document.createElement('td');
    previewCell.className = 'p-4';
    const imgEl = document.createElement('img');
    imgEl.className = 'w-16 h-16 object-cover rounded border border-gray-600';
    imgEl.alt = 'Vista previa del dibujo';
    imgEl.loading = 'lazy';
    previewCell.appendChild(imgEl);

    // Cargar preview de forma asíncrona
    loadDrawingPreview(note.drawingPath, imgEl);

    // Título
    const titleCell = document.createElement('td');
    titleCell.className = 'p-4 text-white flex items-center gap-2';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-blue-400 text-sm flex-shrink-0';
    icon.textContent = 'brush';
    const titleText = document.createElement('span');
    titleText.textContent = note.title || 'Dibujo sin título';
    titleText.classList.add('truncate', 'max-w-xs');
    titleCell.title = note.title || 'Dibujo sin título';
    titleCell.append(icon, titleText);
    titleCell.addEventListener('click', () => openDrawingForEdit(note.id));

    // Fecha
    const dateCell = document.createElement('td');
    dateCell.className = 'p-4 text-gray-400 whitespace-nowrap';
    dateCell.textContent = formatDateRelativeOrLocal(note.updatedAt);

    // Acciones
    const actionsCell = document.createElement('td');
    actionsCell.className = 'p-4 text-right';
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

    const editBtn = createActionButton('edit', 'Editar', 'text-gray-400', 'hover:bg-white/10', () => openDrawingForEdit(note.id));
    const deleteBtn = createActionButton('delete', 'Eliminar', 'text-red-400', 'hover:bg-red-500/10', () => deleteNote(note.id));
    actionsDiv.append(editBtn, deleteBtn);
    actionsCell.appendChild(actionsDiv);

    row.append(previewCell, titleCell, dateCell, actionsCell);
    return row;
  }

  // Función para cargar previews de forma optimizada
  async function loadDrawingPreview(drawingPath, imgElement) {
    try {
      const dataURL = await window.api.getDrawingData(drawingPath);
      imgElement.src = dataURL;
    } catch (err) {
      console.error('Error cargando preview:', err);
      // Usar placeholder en caso de error
      imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjM0Y0QTU3Ii8+CjxwYXRoIGQ9Ik0zMiAyMEMyOC42ODYzIDIwIDI2IDIyLjY4NjMgMjYgMjZDMjYgMjkuMzEzNyAyOC42ODYzIDMyIDMyIDMyQzM1LjMxMzcgMzIgMzggMjkuMzEzNyAzOCAyNkMzOCAyMi42ODYzIDM1LjMxMzcgMjAgMzIgMjBaTTMyIDM2QzI1LjM3MyAzNiAyMCA0MS4zNzMgMjAgNDhINDRDMjQgNDggMjAgNDEuMzczIDIwIDQ4QzIwIDQxLjM3MyAyNS4zNzMgMzYgMzIgMzZaIiBmaWxsPSIjN0Y4QzlCIi8+Cjwvc3ZnPgo=';
    }
  }

  // ------- Notas CRUD -------
  async function loadInitialNotes() {
    notes = await window.api.getNotes();
    trashNotes = await window.api.getTrashNotes();
    reminders = await window.api.getReminders();
    renderNotesList();
  }

  function createNewNote() {
    const untitledCount = Object.values(notes).filter(n => (n.title || '').startsWith('Nueva Nota')).length;
    if (untitledCount > 10) {
      alert('Tienes muchas notas sin título. Por favor, edita algunas antes de crear nuevas.');
      return;
    }
    const now = new Date().toISOString();
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Nueva Nota',
      content: '',
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      reminder: null,
      audioFiles: [],
      drawingPath: null,
      styles: {
        isBold: false,
        isItalic: false,
        isUnderline: false,
        fontFamily: `'Arial', sans-serif`,
        fontSize: 16,
        backgroundColor: '#2c2c2c',
      },
    };
    notes[newNote.id] = newNote;
    window.api.saveNote(newNote);
    renderNotesList();
    window.api.openInFloatWindow(newNote.id);
  }

  function deleteNote(noteId) {
    if (!noteId) return;
    showConfirm({
      title: 'Eliminar Nota',
      message: '¿Estás seguro de que quieres eliminar esta nota? Se moverá a la papelera.',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    }).then(confirmed => {
      if (!confirmed) return;
      if (notes[noteId]) {
        trashNotes[noteId] = notes[noteId];
        delete notes[noteId];
      }
      window.api.deleteNote(noteId);
      renderNotesList();
      showToast({ title: 'Nota eliminada', message: 'La nota se ha movido a la papelera', type: 'success' });
    });
  }

  function recoverNote(noteId) {
    if (!noteId) return;
    if (trashNotes[noteId]) {
      notes[noteId] = trashNotes[noteId];
      delete trashNotes[noteId];
    }
    window.api.recoverNote(noteId);
    renderNotesList();
  }

  function deleteNotePermanent(noteId) {
    if (!noteId) return;
    if (trashNotes[noteId]) delete trashNotes[noteId];
    window.api.deleteNotePermanent(noteId);
    renderNotesList();
  }

  function deleteReminder(reminderId) {
    if (!reminderId) return;
    showConfirm({
      title: 'Eliminar Recordatorio',
      message: '¿Estás seguro de que quieres eliminar este recordatorio?',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    }).then(confirmed => {
      if (!confirmed) return;
      delete reminders[reminderId];
      window.api.deleteReminder(reminderId);
      renderNotesList();
      showToast({ title: 'Recordatorio eliminado', type: 'success' });
    });
  }

  // ------- Menú contextual -------
  let contextMenuNoteId = null;

  function showContextMenu(event, noteId) {
    if (!contextMenu) return;
    event.preventDefault();
    contextMenuNoteId = noteId;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = 'block';
  }

  window.addEventListener('click', () => {
    if (contextMenu) contextMenu.style.display = 'none';
  });

  ctxOpenFloat?.addEventListener('click', () => {
    if (contextMenu) contextMenu.style.display = 'none';
    if (contextMenuNoteId) window.api.openInFloatWindow(contextMenuNoteId);
  });

  ctxDelete?.addEventListener('click', () => {
    if (contextMenu) contextMenu.style.display = 'none';
    if (contextMenuNoteId) deleteNote(contextMenuNoteId);
  });

  // ------- Eventos UI superiores -------
  createNoteBtn?.addEventListener('click', createNewNote);

  createReminderBtn?.addEventListener('click', () => {
    if (!reminderModal) return;
    reminderModal.style.display = 'block';
    if (reminderTitleInput) reminderTitleInput.value = '';
    if (reminderDescriptionInput) reminderDescriptionInput.value = '';
    if (reminderDatetimeInput) reminderDatetimeInput.value = '';
    reminderTitleInput?.focus();
  });

  reminderCancelBtn?.addEventListener('click', () => {
    if (reminderModal) reminderModal.style.display = 'none';
  });

  reminderModal?.addEventListener('click', (e) => {
    if (e.target === reminderModal) reminderModal.style.display = 'none';
  });

  reminderSaveBtn?.addEventListener('click', () => {
    const title = (reminderTitleInput?.value || '').trim();
    const description = (reminderDescriptionInput?.value || '').trim();
    const datetime = reminderDatetimeInput?.value || '';
    if (!title) { showAlert({ title: 'Campo requerido', message: 'El título es obligatorio', type: 'warning' }); reminderTitleInput?.focus(); return; }
    if (!datetime) { showAlert({ title: 'Campo requerido', message: 'La fecha y hora son obligatorias', type: 'warning' }); reminderDatetimeInput?.focus(); return; }

    const reminderDate = new Date(datetime);
    if (isNaN(reminderDate.getTime())) { showAlert({ title: 'Fecha inválida', message: 'La fecha y hora no son válidas', type: 'error' }); reminderDatetimeInput?.focus(); return; }
    if (reminderDate <= new Date()) { showAlert({ title: 'Fecha inválida', message: 'La fecha del recordatorio debe ser en el futuro', type: 'warning' }); reminderDatetimeInput?.focus(); return; }

    const newReminder = {
      id: `reminder-${Date.now()}`,
      title,
      description,
      reminderTime: reminderDate.toISOString(),
      createdAt: new Date().toISOString(),
      noteId: null,
    };
    reminders[newReminder.id] = newReminder;
    window.api.saveReminder(newReminder);
    renderNotesList();
    if (reminderModal) reminderModal.style.display = 'none';
    showToast({ title: 'Recordatorio creado', message: `"${title}" para ${reminderDate.toLocaleString('es-CO')}`, type: 'success', duration: 5000 });
  });

  // ------- Eventos Dibujo -------
  createDrawingBtn?.addEventListener('click', () => {
    drawingModal?.classList.remove('hidden');
    initDrawingCanvas();
  });

  closeDrawingBtn?.addEventListener('click', () => {
    drawingModal?.classList.add('hidden');
    currentDrawingNoteId = null;
    removePreviewCanvas();
  });

  drawingModal?.addEventListener('click', (e) => {
    if (e.target === drawingModal) {
      drawingModal.classList.add('hidden');
      currentDrawingNoteId = null;
      removePreviewCanvas();
    }
  });

  if (drawingCanvas) {
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseout', stopDrawing);
    window.addEventListener('resize', () => {
      if (!drawingModal || drawingModal.classList.contains('hidden')) return;
      // Reescalar sin perder el último estado visible
      const last = undoStack[undoStack.length - 1];
      scaleCanvasForDPR(drawingCanvas, ctx);
      if (last) restoreState(last);
    });
  }

  drawingColorPicker?.addEventListener('change', () => {
    if (ctx && drawingColorPicker) ctx.strokeStyle = drawingColorPicker.value;
  });

  drawingBrushSize?.addEventListener('input', () => {
    if (!ctx || !drawingBrushSize) return;
    ctx.lineWidth = Number(drawingBrushSize.value);
    if (brushSizeDisplay) brushSizeDisplay.textContent = drawingBrushSize.value;
  });

  drawingClearBtn?.addEventListener('click', clearDrawing);
  drawingSaveBtn?.addEventListener('click', saveDrawing);

  toolPencil?.addEventListener('click', (e) => selectTool('pencil', e.target));
  toolBrush?.addEventListener('click', (e) => selectTool('brush', e.target));
  toolEraser?.addEventListener('click', (e) => selectTool('eraser', e.target));
  toolFill?.addEventListener('click', (e) => selectTool('fill', e.target));
  toolLine?.addEventListener('click', (e) => selectTool('line', e.target));
  toolRectangle?.addEventListener('click', (e) => selectTool('rectangle', e.target));
  toolCircle?.addEventListener('click', (e) => selectTool('circle', e.target));
  toolText?.addEventListener('click', (e) => selectTool('text', e.target));

  drawingUndoBtn?.addEventListener('click', undo);
  drawingRedoBtn?.addEventListener('click', redo);





  // ------- Audio -------
  // Funciones de control de visibilidad para botones de audio
  function showAudioRecordingButtons() {
    if (startRecordingBtn) startRecordingBtn.classList.remove('hidden');
    if (stopRecordingBtn) stopRecordingBtn.classList.add('hidden');
  }

  function hideAudioRecordingButtons() {
    if (startRecordingBtn) startRecordingBtn.classList.add('hidden');
    if (stopRecordingBtn) stopRecordingBtn.classList.add('hidden');
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia no soportado.');
      }
      // Usar preset seleccionado
      const preset = audioQualityPresets[currentAudioQuality] || audioQualityPresets.good;
      const audioConstraints = {
        audio: {
          channelCount: preset.channelCount || 1,
          sampleRate: preset.sampleRate || 48000,
          sampleSize: preset.sampleSize || 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          advanced: [
            { channelCount: preset.channelCount || 1 },
            { sampleRate: preset.sampleRate || 48000 }
          ]
        },
        video: false
      };

      // Si hay un dispositivo seleccionado, pedir ese deviceId
      if (selectedAudioDeviceId) {
        audioConstraints.audio.deviceId = { exact: selectedAudioDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      currentStream = stream;
      
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder no soportado por este navegador.');
      }

      // Opciones mejoradas para el MediaRecorder, respetando el preset si aplica
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: preset.audioBitsPerSecond || 128000
      };

      // Verificar si el mimeType es soportado
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('Opus no soportado, probando otros códecs...');
        
        // Probar diferentes códecs en orden de preferencia
        const codecs = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ];
        
        for (const codec of codecs) {
          if (MediaRecorder.isTypeSupported(codec)) {
            options.mimeType = codec;
            console.log('Usando códec:', codec);
            break;
          }
        }
      }

      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log('Chunk de audio recibido:', e.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        
        // Mostrar información de calidad
        const duration = (Date.now() - recordingStartTime) / 1000;
        const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
        console.log(`Grabación completada: ${duration}s, ${sizeMB}MB, tipo: ${audioBlob.type}`);
        
        const arrayBuffer = await audioBlob.arrayBuffer();
        window.api.saveAudio(arrayBuffer);
        
        // Detener todos los tracks del stream
        if (currentStream) {
          currentStream.getTracks().forEach(track => {
            track.stop();
            console.log('Track detenido:', track.kind, track.label);
          });
          currentStream = null;
        }

        // Detener analizador y contexto de audio
        try {
          if (audioLevelInterval) clearInterval(audioLevelInterval);
          if (analyserNode) analyserNode.disconnect();
          if (audioContext) {
            await audioContext.close();
            audioContext = null;
          }
          analyserNode = null;
        } catch (err) {
          console.warn('Error cerrando audioContext:', err);
        }
      };

      // Iniciar grabación con chunks más pequeños para mejor rendimiento
      mediaRecorder.start(1000); // Emitir datos cada segundo
      isRecording = true;
      recordingStartTime = Date.now();
      
      startRecordingBtn?.classList.add('hidden');
      stopRecordingBtn?.classList.remove('hidden');
      recordingStatus?.classList.remove('hidden');

      // Actualizar estado con información de calidad
      // Inicializar analizador de nivel de audio
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        source.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        audioLevelInterval = setInterval(() => {
          analyserNode.getByteTimeDomainData(dataArray);
          // calcular RMS
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const level = Math.min(100, Math.round(rms * 200));
          const levelEl = document.getElementById('audio-level');
          if (levelEl) levelEl.textContent = `${level}%`;
        }, 200);
      } catch (err) {
        console.warn('No se pudo inicializar analizador de audio:', err);
      }

      updateRecordingStatus();

    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      
      // Error específico por permisos
      if (err.name === 'NotAllowedError') {
        alert('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en la configuración de tu navegador.');
      } else if (err.name === 'NotFoundError') {
        alert('No se encontró ningún micrófono. Conecta un micrófono e intenta nuevamente.');
      } else if (err.name === 'NotSupportedError') {
        alert('La configuración de audio solicitada no es compatible con tu dispositivo.');
      } else {
        alert('Error al acceder al micrófono: ' + err.message);
      }
    }
  }

  // Variable para tracking del tiempo de grabación
  let recordingStartTime = 0;

  function updateRecordingStatus() {
    if (!isRecording) return;
    
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timerEl = document.getElementById('recording-timer');
    const qualityEl = document.getElementById('recording-quality');
    const statusEl = document.getElementById('recording-status');

    if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const preset = audioQualityPresets[currentAudioQuality] || audioQualityPresets.good;
    const kbps = Math.round((preset.audioBitsPerSecond || 0) / 1000);
    if (qualityEl) qualityEl.textContent = `Calidad: ${preset.sampleRate / 1000}kHz, ${kbps}kbps (${preset.label})`;
    if (statusEl && !statusEl.classList.contains('visible')) {
      statusEl.classList.remove('hidden');
    }

    setTimeout(updateRecordingStatus, 1000);
  }


  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      startRecordingBtn?.classList.remove('hidden');
      stopRecordingBtn?.classList.add('hidden');
      recordingStatus?.classList.add('hidden');
    }
  }

  startRecordingBtn?.addEventListener('click', startRecordingWithDevice);
  stopRecordingBtn?.addEventListener('click', stopRecording);

  //escoger microfoono

  async function loadAudioDevices() {
    try {
      // Primero necesitamos permisos temporales
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      audioInputDevices = devices.filter(device => 
        device.kind === 'audioinput'
      );
      
      console.log('Dispositivos de audio encontrados:', audioInputDevices);
      
      // Si hay múltiples dispositivos, mostrar selector
      if (audioInputDevices.length > 1) {
        createAudioDeviceSelector();
      }
    } catch (err) {
      console.error('Error al cargar dispositivos de audio:', err);
    }
  }

  function createAudioDeviceSelector() {
    // Crear un selector de dispositivos flotante
    const selector = document.createElement('div');
    selector.className = 'fixed bottom-24 right-6 bg-gray-800 p-4 rounded-lg shadow-lg z-50 min-w-64';
    selector.innerHTML = `
      <h4 class="text-white font-semibold mb-2">Seleccionar micrófono</h4>
      <select id="audio-device-select" class="w-full bg-gray-700 text-white rounded p-2 mb-3">
        ${audioInputDevices.map(device => 
          `<option value="${device.deviceId}">${device.label || 'Micrófono ' + (audioInputDevices.indexOf(device) + 1)}</option>`
        ).join('')}
      </select>
      <div class="flex gap-2">
        <button id="confirm-device" class="flex-1 bg-primary-500 text-white rounded p-2 hover:bg-primary-600">Confirmar</button>
        <button id="cancel-device" class="flex-1 bg-gray-600 text-white rounded p-2 hover:bg-gray-700">Cancelar</button>
      </div>
    `;
    
    document.body.appendChild(selector);
    
    const selectEl = selector.querySelector('#audio-device-select');
    const confirmBtn = selector.querySelector('#confirm-device');
    const cancelBtn = selector.querySelector('#cancel-device');
    
    confirmBtn.addEventListener('click', () => {
      selectedAudioDeviceId = selectEl.value;
      const selectedDevice = audioInputDevices.find(d => d.deviceId === selectedAudioDeviceId);
      document.body.removeChild(selector);
      showToast(`Micrófono seleccionado: ${selectedDevice?.label || 'Dispositivo por defecto'}`, 'success');
    });
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(selector);
    });
    
    // Cerrar selector al hacer clic fuera
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!selector.contains(e.target) && e.target !== startRecordingBtn) {
          document.body.removeChild(selector);
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 100);
  }

  //mejora de audio
  async function startRecordingWithDevice() {
    // Si tenemos dispositivos y no hay uno seleccionado, mostrar selector
    if (audioInputDevices.length > 1 && !selectedAudioDeviceId) {
      await loadAudioDevices();
      createAudioDeviceSelector();
      return;
    }
    
    await startRecording();
  }


  // ------- Navegación (vistas) -------
  allNotesNav?.addEventListener('click', () => {
    currentView = 'all';
    if (mainTitle) mainTitle.textContent = 'Notas';
    toggleNavActive(allNotesNav, trashNav, remindersNav, drawingNav);
    emptyTrashFloatingBtn?.classList.add('hidden');
    startRecordingBtn?.classList.remove('hidden');
    showAudioRecordingButtons(); // Mostrar botones de grabación
    showAudioQualityButton(); // Mostrar el botón en la vista de notas
    updateCreateButtonsVisibility();
    renderNotesList();
  });

  trashNav?.addEventListener('click', () => {
    currentView = 'trash';
    if (mainTitle) mainTitle.textContent = 'Papelera';
    toggleNavActive(trashNav, allNotesNav, remindersNav, drawingNav);
    emptyTrashFloatingBtn?.classList.remove('hidden');
    startRecordingBtn?.classList.add('hidden');
    updateCreateButtonsVisibility();
    renderNotesList();
  });

  remindersNav?.addEventListener('click', () => {
    currentView = 'reminders';
    if (mainTitle) mainTitle.textContent = 'Recordatorios';
    toggleNavActive(remindersNav, allNotesNav, trashNav, drawingNav);
    emptyTrashFloatingBtn?.classList.add('hidden');
    startRecordingBtn?.classList.add('hidden');
    updateCreateButtonsVisibility();
    renderNotesList();
  });

  drawingNav?.addEventListener('click', () => {
    currentView = 'drawing';
    if (mainTitle) mainTitle.textContent = 'Dibujo';
    toggleNavActive(drawingNav, allNotesNav, trashNav, remindersNav);
    emptyTrashFloatingBtn?.classList.add('hidden');
    startRecordingBtn?.classList.add('hidden');
    updateCreateButtonsVisibility();
    renderNotesList(); // delega en renderDrawingView
  });

  // ------- Smart scroll (notes table) -------
  let notesTableContainer = null;
  let scrollObserver = null;

  function updateScrollState() {
    try {
      if (!notesTableContainer) notesTableContainer = document.getElementById('notes-table-container');
      if (!notesTableContainer) return;
      const topIndicator = document.getElementById('scroll-top-indicator');
      const bottomIndicator = document.getElementById('scroll-bottom-indicator');
      const { scrollTop, scrollHeight, clientHeight } = notesTableContainer;
      if (topIndicator) topIndicator.style.display = scrollTop > 10 ? 'block' : 'none';
      if (bottomIndicator) bottomIndicator.style.display = (scrollTop + clientHeight) < (scrollHeight - 10) ? 'block' : 'none';
    } catch (err) {
      console.warn('updateScrollState error:', err);
    }
  }

  function setupSmartScroll() {
    notesTableContainer = document.getElementById('notes-table-container');
    if (!notesTableContainer) return;
    // Observe scroll and resize events
    notesTableContainer.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    // Also use a MutationObserver to detect content changes that affect scrollHeight
    try {
      scrollObserver = new MutationObserver(() => updateScrollState());
      scrollObserver.observe(notesTableContainer, { childList: true, subtree: true });
    } catch (err) {
      // MutationObserver not available? fallback to periodic update
      notesTableContainer._smartScrollInterval = setInterval(updateScrollState, 500);
    }

    // Initial update
    setTimeout(updateScrollState, 50);
  }

  function cleanupScrollObserver() {
    if (notesTableContainer) {
      notesTableContainer.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      if (notesTableContainer._smartScrollInterval) {
        clearInterval(notesTableContainer._smartScrollInterval);
        notesTableContainer._smartScrollInterval = null;
      }
    }
    if (scrollObserver) {
      try { scrollObserver.disconnect(); } catch (e) { }
      scrollObserver = null;
    }
  }

  emptyTrashFloatingBtn?.addEventListener('click', () => {
    showConfirm({
      title: 'Vaciar Papelera',
      message: '¿Estás seguro de que quieres vaciar la papelera? Esta acción es irreversible y no se puede deshacer.',
      type: 'danger',
      confirmText: 'Vaciar Todo',
      cancelText: 'Cancelar',
      danger: true
    }).then(confirmed => {
      if (confirmed) {
        window.api.emptyTrash();
        showToast({ title: 'Papelera vaciada', message: 'Todas las notas han sido eliminadas permanentemente', type: 'success' });
      }
    });
  });

  // ------- Búsqueda -------
  searchInput?.addEventListener('input', () => {
    const q = (searchInput.value || '').toLowerCase();
    if (!q) { renderNotesList(); return; }
    let filtered;
    if (currentView === 'trash') {
      filtered = Object.values(trashNotes).filter(n =>
        (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
      );
    } else if (currentView === 'reminders') {
      filtered = Object.values(reminders).filter(r =>
        (r.title || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
      );
    } else if (currentView === 'drawing') {
      filtered = Object.values(notes).filter(n =>
        n.drawingPath && (n.title || '').toLowerCase().includes(q)
      );
    } else {
      filtered = Object.values(notes).filter(n =>
        !n.drawingPath && ((n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
      );
    }
    renderNotesList(filtered);
  });

  // ------- IPC (Main -> Renderer) -------
  window.api.onNoteUpdated((note) => {
    notes[note.id] = note;
    renderNotesList();
  });

  window.api.onNoteDeleted((noteId) => {
    if (notes[noteId]) {
      trashNotes[noteId] = notes[noteId];
      delete notes[noteId];
    }
    renderNotesList();
  });

  window.api.onNoteRecovered((noteId) => {
    if (trashNotes[noteId]) {
      notes[noteId] = trashNotes[noteId];
      delete trashNotes[noteId];
    }
    renderNotesList();
  });

  window.api.onNoteDeletedPermanent((noteId) => {
    if (trashNotes[noteId]) delete trashNotes[noteId];
    renderNotesList();
  });

  window.api.onTrashEmptied(() => {
    trashNotes = {};
    renderNotesList();
  });

  window.api.onReminderUpdated((reminder) => {
    reminders[reminder.id] = reminder;
    renderNotesList();
  });

  window.api.onReminderDeleted((reminderId) => {
    delete reminders[reminderId];
    renderNotesList();
  });

  // Audio IPC
  window.api.onAudioNoteCreated((note) => {
    notes[note.id] = note;
    renderNotesList();
    showToast(`Nota de audio creada: "${note.title}"`, 'success');
  });

  window.api.onAudioSaveError((error) => {
    showToast(`Error al guardar la nota de audio: ${error}`, 'error');
  });

  // ===== DRAWING IPC - VERSIÓN CORREGIDA =====

  // Variable para controlar duplicados
  let drawingSaveInProgress = false;

  window.api.onDrawingSaved((note) => {
    if (drawingSaveInProgress) {
      console.log(' Intento de guardado duplicado ignorado');
      return;
    }
    
    drawingSaveInProgress = true;
    
    console.log(' Dibujo guardado:', note.id, note.title);
    
    // Actualizar el estado de notas
    notes[note.id] = note;
    
    // Forzar una sola actualización de la lista
    renderNotesList();
    
    showToast({
      title: 'Dibujo guardado',
      message: `"${note.title}"`,
      type: 'success',
      duration: 3000
    });
    
    // Resetear el flag después de un delay
    setTimeout(() => {
      drawingSaveInProgress = false;
    }, 1000);
  });

  window.api.onDrawingSaveError((error) => {
    drawingSaveInProgress = false;
    showAlert({
      title: 'Error al guardar',
      message: `No se pudo guardar el dibujo:\n${error}`,
      type: 'error'
    });
  });

  // ------- Theme Listeners -------
  themeToggleBtn?.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    window.api.setSettings({ theme: next });
  });

  window.api.onSettingsChanged((s) => applyTheme(s?.theme || 'dark'));

  // ------- Atajos de teclado -------
  // Busca la sección de atajos de teclado existente y reemplázala o amplíala:

  function setupGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignorar si estamos en un input de búsqueda u otros campos
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'INPUT' || 
                            activeElement.tagName === 'TEXTAREA' ||
                            activeElement.isContentEditable;
      
      if (isInputFocused && !activeElement.id?.includes('search')) {
        return; // No procesar atajos globales cuando se está editando texto
      }

      // Ctrl/Cmd + N - Nueva nota
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        createNewNote();
        return;
      }

      // Ctrl/Cmd + Shift + N - Nueva nota rápida (sin abrir ventana flotante)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && e.shiftKey) {
        e.preventDefault();
        createQuickNote();
        return;
      }

      // Ctrl/Cmd + T - Nueva nota de audio
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        startRecording();
        return;
      }

      // Ctrl/Cmd + R - Nuevo recordatorio
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        createReminderBtn?.click();
        return;
      }

      // Ctrl/Cmd + D - Nuevo dibujo
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        createDrawingBtn?.click();
        return;
      }

      // Ctrl/Cmd + F - Buscar (focus en search)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput?.focus();
        searchInput?.select();
        return;
      }

      // Ctrl/Cmd + L - Limpiar búsqueda
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        if (searchInput) {
          searchInput.value = '';
          renderNotesList();
        }
        return;
      }

      // Ctrl/Cmd + , - Configuración (podrías implementar esto después)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
        return;
      }

      // Ctrl/Cmd + 1 - Vista de notas
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        allNotesNav?.click();
        return;
      }

      // Ctrl/Cmd + 2 - Vista de papelera
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        trashNav?.click();
        return;
      }

      // Ctrl/Cmd + 3 - Vista de recordatorios
      if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        remindersNav?.click();
        return;
      }

      // Ctrl/Cmd + 4 - Vista de dibujos
      if ((e.ctrlKey || e.metaKey) && e.key === '4') {
        e.preventDefault();
        drawingNav?.click();
        return;
      }

      // Escape - Cerrar modales o limpiar búsqueda
      if (e.key === 'Escape') {
        // Cerrar modales abiertos
        if (reminderModal && reminderModal.style.display === 'block') {
          reminderModal.style.display = 'none';
          e.preventDefault();
          return;
        }
        
        if (drawingModal && !drawingModal.classList.contains('hidden')) {
          drawingModal.classList.add('hidden');
          e.preventDefault();
          return;
        }
        
        // Limpiar búsqueda
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          renderNotesList();
          e.preventDefault();
          return;
        }
        
        // Quitar focus de search
        if (document.activeElement === searchInput) {
          searchInput.blur();
          e.preventDefault();
          return;
        }
      }

      // F2 - Renombrar nota seleccionada (si implementas selección)
      if (e.key === 'F2') {
        e.preventDefault();
        renameSelectedNote();
        return;
      }

      // Delete - Eliminar nota seleccionada
      if (e.key === 'Delete' && currentView !== 'trash') {
        e.preventDefault();
        deleteSelectedNote();
        return;
      }
    });
  }

  // Funciones auxiliares para los atajos
  function createQuickNote() {
    const now = new Date().toISOString();
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Nota Rápida',
      content: `Creada el ${new Date().toLocaleString()}`,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      reminder: null,
      audioFiles: [],
      drawingPath: null,
    };
    
    notes[newNote.id] = newNote;
    window.api.saveNote(newNote);
    renderNotesList();
    showToast('Nota rápida creada', 'success');
  }

  function openSettings() {
    // Implementar un modal de configuración
    showToast('Configuración - Próximamente', 'info');
  }

  function renameSelectedNote() {
    // Implementar lógica para renombrar nota seleccionada
    // Por ahora, mostramos un mensaje
    showToast('Selecciona una nota y presiona F2 para renombrar', 'info');
  }

  function deleteSelectedNote() {
    // Implementar lógica para eliminar nota seleccionada
    showToast('Selecciona una nota y presiona Delete para eliminar', 'info');
  }
  

  // ------- Window Controls -------
  minimizeBtn?.addEventListener('click', () => window.api.minimizeWindow());
  maximizeBtn?.addEventListener('click', () => window.api.maximizeWindow());
  closeBtn?.addEventListener('click', () => window.api.closeWindow());

  // ------- Init -------
  await initTheme();
  ensureImprovedStylesOnce();
  loadInitialNotes();
  updateCreateButtonsVisibility();
  setupGlobalKeyboardShortcuts();
  await loadAudioDevices();
  // UI helpers
  try { addAudioQualityButton(); hideAudioQualityButton(); } catch (e) { /* optional */ }
  

  // Smart scroll setup for notes list
  try { setupSmartScroll(); } catch (e) { console.warn('Smart scroll init failed', e); }

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    try { cleanupScrollObserver(); } catch (e) { }
  });
});
