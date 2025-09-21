document.addEventListener('DOMContentLoaded', () => {
  // ------- Referencias DOM (con safeguards) -------
  const $ = (id) => document.getElementById(id);

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

  // ------- Utilidades -------
  const fmtDate = (date) =>
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);

  const fmtTime = (date) =>
    new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);

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
  async function openDrawingForEdit(noteId) {
    const note = notes[noteId];
    if (!note || !note.drawingPath) return;
    currentDrawingNoteId = noteId;
    drawingModal?.classList.remove('hidden');
    initDrawingCanvas();
    try {
      const dataURL = await window.api.getDrawingData(note.drawingPath);
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        ctx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
        saveState();
      };
      img.src = dataURL;
    } catch (err) {
      console.error('Error al cargar dibujo:', err);
      alert('Error al cargar el dibujo: ' + (err?.message || err));
    }
  }

  function renderDrawingView(filtered = null) {
    if (!notesTbody) return;
    notesTbody.innerHTML = '';

    ensureDrawingHeaderColumn(true);

    const allDrawing = Object.values(notes).filter(n => n.drawingPath);
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

    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    list.forEach(async (note) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-800/40 group note-item';
      row.dataset.id = note.id;

      // Preview
      const previewCell = document.createElement('td');
      previewCell.className = 'p-4';
      const imgEl = document.createElement('img');
      imgEl.className = 'w-16 h-16 object-cover rounded border border-gray-600';
      imgEl.alt = 'Vista previa del dibujo';
      previewCell.appendChild(imgEl);

      try {
        const dataURL = await window.api.getDrawingData(note.drawingPath);
        imgEl.src = dataURL;
      } catch (err) {
        console.error('Error preview:', err);
      }

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
      notesTbody.appendChild(row);
    });
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
    if (notes[noteId]) {
      trashNotes[noteId] = notes[noteId];
      delete notes[noteId];
    }
    window.api.deleteNote(noteId);
    renderNotesList();
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
    delete reminders[reminderId];
    window.api.deleteReminder(reminderId);
    renderNotesList();
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

    if (!title) { alert('El título es obligatorio'); reminderTitleInput?.focus(); return; }
    if (!datetime) { alert('La fecha y hora son obligatorias'); reminderDatetimeInput?.focus(); return; }

    const reminderDate = new Date(datetime);
    if (isNaN(reminderDate.getTime())) { alert('La fecha y hora no son válidas'); reminderDatetimeInput?.focus(); return; }
    if (reminderDate <= new Date()) { alert('La fecha del recordatorio debe ser en el futuro'); reminderDatetimeInput?.focus(); return; }

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
    alert(`Recordatorio "${title}" creado para ${reminderDate.toLocaleString('es-CO')}`);
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
  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia no soportado.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder no soportado por este navegador.');
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        window.api.saveAudio(arrayBuffer);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      startRecordingBtn?.classList.add('hidden');
      stopRecordingBtn?.classList.remove('hidden');
      recordingStatus?.classList.remove('hidden');
    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      alert('Error al acceder al micrófono. Revisa permisos o compatibilidad.');
    }
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

  startRecordingBtn?.addEventListener('click', startRecording);
  stopRecordingBtn?.addEventListener('click', stopRecording);

  // ------- Navegación (vistas) -------
  allNotesNav?.addEventListener('click', () => {
    currentView = 'all';
    if (mainTitle) mainTitle.textContent = 'Notas';
    toggleNavActive(allNotesNav, trashNav, remindersNav, drawingNav);
    emptyTrashFloatingBtn?.classList.add('hidden');
    startRecordingBtn?.classList.remove('hidden');
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

  emptyTrashFloatingBtn?.addEventListener('click', () => {
    if (confirm('¿Vaciar la papelera? Esta acción no se puede deshacer.')) {
      window.api.emptyTrash();
    }
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
    alert(`Nota de audio creada: "${note.title}"`);
  });

  window.api.onAudioSaveError((error) => {
    alert(`Error al guardar la nota de audio:\n${error}`);
  });

  // Drawing IPC
  window.api.onDrawingSaved((note) => {
    notes[note.id] = note;
    renderNotesList();
    alert(`Dibujo guardado: "${note.title}"`);
  });

  window.api.onDrawingSaveError((error) => {
    alert(`Error al guardar el dibujo:\n${error}`);
  });

  // ------- Atajos de teclado -------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          createNewNote();
          break;
        case 'r': // usar Ctrl+Shift+R para no chocar con recarga
          if (e.shiftKey) {
            e.preventDefault();
            createReminderBtn?.click();
          }
          break;
        case 'd':
          e.preventDefault();
          createDrawingBtn?.click();
          break;
        case 's':
          if (currentView === 'drawing' && !drawingModal?.classList.contains('hidden')) {
            e.preventDefault();
            saveDrawing();
          }
          break;
      }
    }
  });

  // ------- Window Controls -------
  minimizeBtn?.addEventListener('click', () => window.api.minimizeWindow());
  maximizeBtn?.addEventListener('click', () => window.api.maximizeWindow());
  closeBtn?.addEventListener('click', () => window.api.closeWindow());

  // ------- Init -------
  ensureImprovedStylesOnce();
  loadInitialNotes();
  updateCreateButtonsVisibility();
});
