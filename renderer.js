document.addEventListener('DOMContentLoaded', () => {
    const notesTbody = document.getElementById('notes-tbody');
    const searchInput = document.getElementById('search-input');

    const createNoteBtn = document.getElementById('create-note-btn');
    const createReminderBtn = document.getElementById('create-reminder-btn');
    const startRecordingBtn = document.getElementById('start-recording-btn');
    const stopRecordingBtn = document.getElementById('stop-recording-btn');
    const recordingStatus = document.getElementById('recording-status');
    const contextMenu = document.getElementById('context-menu');
    const ctxOpenFloat = document.getElementById('ctx-open-float');
    const ctxDelete = document.getElementById('ctx-delete');
    const allNotesNav = document.getElementById('all-notes-nav');
    const trashNav = document.getElementById('trash-nav');
    const remindersNav = document.getElementById('reminders-nav');
    const drawingNav = document.getElementById('drawing-nav');
    const mainTitle = document.getElementById('main-title');
    const emptyTrashFloatingBtn = document.getElementById('empty-trash-floating-btn');

    // Drawing modal elements
    const drawingModal = document.getElementById('drawing-modal');
    const closeDrawingBtn = document.getElementById('close-drawing-btn');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const drawingColorPicker = document.getElementById('drawing-color-picker');
    const drawingBrushSize = document.getElementById('drawing-brush-size');
    const drawingClearBtn = document.getElementById('drawing-clear-btn');
    const drawingSaveBtn = document.getElementById('drawing-save-btn');
    const createDrawingBtn = document.getElementById('create-drawing-btn');

    // Toolbar elements
    const toolPencil = document.getElementById('tool-pencil');
    const toolBrush = document.getElementById('tool-brush');
    const toolEraser = document.getElementById('tool-eraser');
    const toolFill = document.getElementById('tool-fill');
    const toolLine = document.getElementById('tool-line');
    const toolRectangle = document.getElementById('tool-rectangle');
    const toolCircle = document.getElementById('tool-circle');
    const toolText = document.getElementById('tool-text');
    const brushSizeDisplay = document.getElementById('brush-size-display');
    const drawingUndoBtn = document.getElementById('drawing-undo-btn');
    const drawingRedoBtn = document.getElementById('drawing-redo-btn');

    let notes = {};
    let trashNotes = {};
    let reminders = {};

    // Current view: 'all', 'trash', 'reminders', or 'drawing'
    let currentView = 'all';

    // Drawing variables
    let isDrawing = false;
    let ctx = drawingCanvas.getContext('2d');
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pencil';
    let undoStack = [];
    let redoStack = [];
    let startX, startY;
    let isTextMode = false;
    let textInput = null;
    let currentDrawingNoteId = null; // Para editar dibujos existentes

    // Variables para el preview de formas
    let previewCanvas = null;
    let previewCtx = null;

    // Variables para el sistema de figuras movibles
    let shapes = []; // Array para almacenar figuras
    let selectedShape = null; // Figura seleccionada actualmente
    let isDragging = false; // Si se está arrastrando una figura
    let isResizing = false; // Si se está redimensionando una figura
    let dragOffsetX = 0; // Offset para el arrastre
    let dragOffsetY = 0;
    let resizeHandle = null; // Handle de redimensionamiento activo
    let selectionMode = false; // Modo selección vs modo dibujo

    // --- Variables para grabación de audio ---
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // --- Funciones de Renderizado y UI ---

    function updateCreateButtonsVisibility() {
        // Ocultar todos los botones primero
        createNoteBtn.style.display = 'none';
        createReminderBtn.style.display = 'none';
        createDrawingBtn.style.display = 'none';

        // Mostrar el botón correspondiente a la vista actual
        if (currentView === 'all') {
            createNoteBtn.style.display = 'flex';
        } else if (currentView === 'reminders') {
            createReminderBtn.style.display = 'flex';
        } else if (currentView === 'drawing') {
            createDrawingBtn.style.display = 'flex';
        }
        // Para 'trash', todos los botones permanecen ocultos
    }

    function getContrastColor(hexColor) {
        if (hexColor.startsWith('#')) {
            hexColor = hexColor.slice(1);
        }
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    function renderNotesList(filteredNotes = null) {
        notesTbody.innerHTML = '';
        
        let notesToRender;
        if (currentView === 'trash') {
            notesToRender = filteredNotes || Object.values(trashNotes);
        } else if (currentView === 'reminders') {
            notesToRender = filteredNotes || Object.values(reminders);
        } else if (currentView === 'drawing') {
            notesToRender = filteredNotes || Object.values(notes).filter(note => note.drawingPath);
        } else {
            // For 'all' view, exclude drawing notes
            notesToRender = filteredNotes || Object.values(notes).filter(note => !note.drawingPath);
        }
        
        // Ordenar notas
        const sortedNotes = notesToRender.sort((a, b) => {
            if (currentView === 'reminders') {
                return new Date(a.reminderTime) - new Date(b.reminderTime);
            }
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        // Crear fragmento para mejor rendimiento
        const fragment = document.createDocumentFragment();

        if (sortedNotes.length === 0) {
            // Mostrar estado vacío
            const emptyRow = document.createElement('tr');
            const colspan = currentView === 'drawing' ? '4' : '3';
            emptyRow.innerHTML = `
                <td colspan="${colspan}" class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center justify-center">
                        <span class="material-symbols-outlined text-5xl mb-4">
                            ${currentView === 'trash' ? 'delete' : 
                              currentView === 'reminders' ? 'notifications' : 
                              currentView === 'drawing' ? 'brush' : 'note'}
                        </span>
                        <p class="text-lg font-medium mb-2">
                            ${currentView === 'trash' ? 'La papelera está vacía' : 
                              currentView === 'reminders' ? 'No hay recordatorios' : 
                              currentView === 'drawing' ? 'No hay dibujos' : 'No hay notas'}
                        </p>
                        <p class="text-sm">
                            ${currentView === 'trash' ? 'Las notas eliminadas aparecerán aquí' : 
                              currentView === 'reminders' ? 'Crea recordatorios para verlos aquí' : 
                              currentView === 'drawing' ? 'Crea tu primer dibujo para comenzar' : 
                              'Crea tu primera nota para comenzar'}
                        </p>
                    </div>
                </td>
            `;
            fragment.appendChild(emptyRow);
        } else {
            // Renderizar notas
            sortedNotes.forEach(item => {
                const row = createNoteRow(item);
                fragment.appendChild(row);
            });
        }

        notesTbody.appendChild(fragment);
    }

    function createNoteRow(item) {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-800/40', 'group', 'note-item');
        row.dataset.id = item.id;

        // Celda de título con icono
        const titleCell = document.createElement('td');
        titleCell.classList.add('p-4', 'text-white', 'flex', 'items-center', 'gap-2');

        // Icono según tipo de contenido
        if (item.drawingPath) {
            const drawingIcon = document.createElement('span');
            drawingIcon.classList.add('material-symbols-outlined', 'text-blue-400', 'text-sm', 'flex-shrink-0');
            drawingIcon.textContent = 'brush';
            titleCell.appendChild(drawingIcon);
        } else if (item.audioFiles && Array.isArray(item.audioFiles) && item.audioFiles.length > 0 && item.audioFiles.some(audio => audio.fileName && audio.filePath)) {
            const audioIcon = document.createElement('span');
            audioIcon.classList.add('material-symbols-outlined', 'text-green-400', 'text-sm', 'flex-shrink-0');
            audioIcon.textContent = 'mic';
            titleCell.appendChild(audioIcon);
        }
        
        const titleText = document.createElement('span');
        titleText.textContent = item.title || 'Sin título';
        titleText.classList.add('truncate', 'max-w-xs');
        titleCell.appendChild(titleText);

        // Añadir tooltip con título completo
        titleCell.title = item.title || 'Sin título';
        
        titleCell.addEventListener('click', () => {
            if (currentView === 'reminders') {
                if (item.noteId) {
                    window.api.openInFloatWindow(item.noteId);
                } else {
                    const reminderDate = new Date(item.reminderTime);
                    alert(`Recordatorio: ${item.title}\nDescripción: ${item.description || 'Sin descripción'}\nFecha: ${reminderDate.toLocaleString()}`);
                }
            } else {
                window.api.openInFloatWindow(item.id);
            }
        });

        // Celda de fecha
        const dateCell = document.createElement('td');
        dateCell.classList.add('p-4', 'text-gray-400', 'whitespace-nowrap');
        if (currentView === 'reminders') {
            dateCell.textContent = formatReminderDate(item.reminderTime);
        } else {
            dateCell.textContent = formatDate(item.updatedAt);
        }

        // Celda de acciones
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('p-4', 'text-right');
        
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('flex', 'items-center', 'justify-end', 'gap-2', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity', 'duration-200');

        // Botones según la vista
        if (currentView === 'trash') {
            const recoverBtn = createActionButton('restore', 'Recuperar', 'text-green-400', 'hover:bg-green-500/10', () => recoverNote(item.id));
            const deletePermanentBtn = createActionButton('delete_forever', 'Eliminar Permanentemente', 'text-red-400', 'hover:bg-red-500/10', () => deleteNotePermanent(item.id));
            
            actionsDiv.appendChild(recoverBtn);
            actionsDiv.appendChild(deletePermanentBtn);
        } else if (currentView === 'reminders') {
            const deleteBtn = createActionButton('delete', 'Eliminar Recordatorio', 'text-red-400', 'hover:bg-red-500/10', () => deleteReminder(item.id));
            actionsDiv.appendChild(deleteBtn);
        } else {
            const viewBtn = createActionButton('visibility', 'Ver', 'text-gray-400', 'hover:bg-white/10', () => window.api.openInFloatWindow(item.id));
            const editBtn = createActionButton('edit', 'Editar', 'text-gray-400', 'hover:bg-white/10', () => window.api.openInFloatWindow(item.id));
            const deleteBtn = createActionButton('delete', 'Eliminar', 'text-red-400', 'hover:bg-red-500/10', () => deleteNote(item.id));
            
            actionsDiv.appendChild(viewBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
        }
        
        actionsCell.appendChild(actionsDiv);
        
        // Añadir celdas a la fila
        row.appendChild(titleCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);
        
        // Menú contextual
        row.addEventListener('contextmenu', (e) => showContextMenu(e, item.id));
        
        return row;
    }

    function createActionButton(icon, title, colorClass, hoverClass, onClick) {
        const button = document.createElement('button');
        button.classList.add('p-2', 'rounded-full', 'transition-colors', 'duration-200', hoverClass);
        button.innerHTML = `<span class="material-symbols-outlined ${colorClass}">${icon}</span>`;
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Hoy';
        } else if (diffDays === 1) {
            return 'Ayer';
        } else if (diffDays < 7) {
            return `Hace ${diffDays} días`;
        } else {
            return date.toLocaleDateString();
        }
    }

    function formatReminderDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return `Hoy, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (diffDays === 1) {
            return `Mañana, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (diffDays > 1 && diffDays < 7) {
            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            return `${days[date.getDay()]}, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            return date.toLocaleString();
        }
    }

    // Insertar estilos CSS para mejorar la interfaz
    const improvedStyles = `
        .note-item {
            transition: all 0.2s ease;
        }
        
        .note-item:hover {
            transform: translateX(4px);
        }
        
        .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .max-w-xs {
            max-width: 20rem;
        }
    `;

    // Añadir estilos al documento
    const styleSheet = document.createElement('style');
    styleSheet.textContent = improvedStyles;
    document.head.appendChild(styleSheet);

    // --- Lógica de Notas ---

    async function loadInitialNotes() {
        notes = await window.api.getNotes();
        trashNotes = await window.api.getTrashNotes();
        reminders = await window.api.getReminders();
        renderNotesList();
    }

    function createNewNote() {
        // Validar que no haya demasiadas notas sin título
        const untitledCount = Object.values(notes).filter(note => note.title.startsWith('Nueva Nota')).length;
        if (untitledCount > 10) {
            alert('Tienes muchas notas sin título. Por favor, edita algunas antes de crear nuevas.');
            return;
        }

        const newNote = {
            id: `note-${Date.now()}`,
            title: 'Nueva Nota',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPinned: false,
            reminder: null,
            audioFiles: [],
            drawingPath: null,
            styles: {
                isBold: false,
                isItalic: false,
                isUnderline: false,
                fontFamily: '\'Arial\', sans-serif',
                fontSize: 16,
                backgroundColor: '#2c2c2c'
            }
        };
        notes[newNote.id] = newNote;
        window.api.saveNote(newNote);
        renderNotesList();
        window.api.openInFloatWindow(newNote.id);
    }

    function deleteNote(noteId) {
        if (!noteId) return;
        // Move note to trashNotes
        if (notes[noteId]) {
            trashNotes[noteId] = notes[noteId];
            delete notes[noteId];
        }
        window.api.deleteNote(noteId);
        renderNotesList();
    }

    function recoverNote(noteId) {
        if (!noteId) return;
        // Move note from trashNotes to notes locally
        if (trashNotes[noteId]) {
            notes[noteId] = trashNotes[noteId];
            delete trashNotes[noteId];
        }
        window.api.recoverNote(noteId);
        renderNotesList();
    }

    function deleteNotePermanent(noteId) {
        if (!noteId) return;
        // Remove note from trashNotes locally
        if (trashNotes[noteId]) {
            delete trashNotes[noteId];
        }
        window.api.deleteNotePermanent(noteId);
        renderNotesList();
    }

    function deleteReminder(reminderId) {
        if (!reminderId) return;
        delete reminders[reminderId];
        window.api.deleteReminder(reminderId);
        renderNotesList();
    }

    // --- Funciones de Dibujo ---

    function initDrawingCanvas() {
        // Set canvas size to match container
        const container = drawingCanvas.parentElement;
        const containerRect = container.getBoundingClientRect();

        // Set canvas internal size to match display size
        drawingCanvas.width = containerRect.width;
        drawingCanvas.height = containerRect.height;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = drawingBrushSize.value;
        ctx.strokeStyle = drawingColorPicker.value;

        // Fondo blanco inicial
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);

        brushSizeDisplay.textContent = drawingBrushSize.value;

        // Inicializar sistema de figuras
        shapes = [];
        selectedShape = null;
        isDragging = false;
        isResizing = false;
        selectionMode = false;

        // Set default tool
        selectTool('pencil', toolPencil);

        // Guardar estado inicial
        undoStack = [];
        redoStack = [];
        saveState();
    }

    function saveState() {
        // Solo guardar si no estamos dibujando
        if (!isDrawing) {
            if (undoStack.length >= 50) {
                undoStack.shift();
            }
            undoStack.push(drawingCanvas.toDataURL());
            redoStack = [];
            updateUndoRedoButtons();
        }
    }

    function restoreState(dataURL) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = dataURL;
    }

    // Función para actualizar el estado de los botones de deshacer y rehacer
    function updateUndoRedoButtons() {
        // Habilitar botón deshacer incluso si undoStack está vacío para permitir limpiar el dibujo
        drawingUndoBtn.disabled = false;
        drawingRedoBtn.disabled = redoStack.length === 0;
    }

    // Función para deshacer el último cambio en el dibujo
    function undo() {
        if (undoStack.length > 1) {
            const lastState = undoStack.pop();
            redoStack.push(lastState);
            const previousState = undoStack[undoStack.length - 1];
            restoreState(previousState);
        } else if (undoStack.length === 1) {
            // Permitir deshacer hasta el estado inicial (limpiar dibujo)
            const lastState = undoStack.pop();
            redoStack.push(lastState);
            clearDrawing();
        }
        updateUndoRedoButtons();
    }

    function redo() {
        if (redoStack.length > 0) {
            const state = redoStack.pop();
            restoreState(state);
            undoStack.push(state);
            updateUndoRedoButtons();
        }
    }

    function createPreviewCanvas() {
        if (!previewCanvas) {
            previewCanvas = document.createElement('canvas');
            previewCanvas.style.position = 'absolute';
            previewCanvas.style.pointerEvents = 'none';
            previewCanvas.style.left = '0';
            previewCanvas.style.top = '0';
            previewCtx = previewCanvas.getContext('2d');
        }

        previewCanvas.width = drawingCanvas.width;
        previewCanvas.height = drawingCanvas.height;

        if (!drawingCanvas.parentElement.contains(previewCanvas)) {
            drawingCanvas.parentElement.appendChild(previewCanvas);
        }
    }

    function clearPreview() {
        if (previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
    }

    function drawShapePreview(x1, y1, x2, y2, shape) {
        const width = x2 - x1;
        const height = y2 - y1;

        previewCtx.beginPath();
        if (shape === 'rectangle') {
            previewCtx.rect(x1, y1, width, height);
        } else if (shape === 'circle') {
            const radius = Math.sqrt(width * width + height * height) / 2;
            const centerX = x1 + width / 2;
            const centerY = y1 + height / 2;
            previewCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        } else if (shape === 'line') {
            previewCtx.moveTo(x1, y1);
            previewCtx.lineTo(x2, y2);
        }
        previewCtx.stroke();
    }

    function draw(e) {
        if (!isDrawing) return;
        if (currentTool === 'pencil' || currentTool === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawingColorPicker.value;
            ctx.lineWidth = drawingBrushSize.value;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            [lastX, lastY] = [e.offsetX, e.offsetY];
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = drawingBrushSize.value;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            [lastX, lastY] = [e.offsetX, e.offsetY];
        } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
            // Preview de formas
            createPreviewCanvas();
            clearPreview();
            previewCtx.strokeStyle = drawingColorPicker.value;
            previewCtx.lineWidth = drawingBrushSize.value;
            drawShapePreview(startX, startY, e.offsetX, e.offsetY, currentTool);
            [lastX, lastY] = [e.offsetX, e.offsetY];
        }
    }

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
        if (currentTool === 'fill') {
            const fillColor = hexToRgb(drawingColorPicker.value);
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
        if (isDrawing) {
            isDrawing = false;
            if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
                // Draw the final shape
                drawShape(startX, startY, lastX, lastY, currentTool);
                saveState();
            } else if (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser') {
                // Save state for freehand drawing tools
                saveState();
            }
        }
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), 255] : null;
    }

    // Función para limpiar el dibujo y guardar el estado correctamente
    function clearDrawing() {
        // Guardar el estado actual antes de limpiar solo si hay algo en el undoStack
        if (undoStack.length === 0) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            redoStack = [];
            updateUndoRedoButtons();
            return;
        }
        saveState();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        redoStack = [];
        updateUndoRedoButtons();
    }

    async function saveDrawing() {
        const dataURL = drawingCanvas.toDataURL('image/png');
        const title = 'Dibujo';
        if (currentDrawingNoteId) {
            // Edit existing drawing note
            window.api.saveDrawing({ dataURL, noteId: currentDrawingNoteId, title });
        } else {
            // Create new drawing note
            window.api.saveDrawing({ dataURL, noteId: null, title });
        }
        drawingModal.classList.add('hidden');
        currentDrawingNoteId = null;
        // renderNotesList will be called on note-updated event
    }

    function selectTool(tool, button) {
        currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('bg-gray-600'));
        if (button) button.classList.add('bg-gray-600');
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
        if (tool === 'text') {
            isTextMode = true;
            drawingCanvas.style.cursor = 'text';
        } else {
            isTextMode = false;
            drawingCanvas.style.cursor = 'crosshair';
        }
    }

    function floodFill(x, y, fillColor) {
        const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
        const data = imageData.data;
        const targetColor = getPixelColor(x, y, data);
        if (colorsMatch(targetColor, fillColor)) return;

        const queue = [[x, y]];
        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            if (cx < 0 || cx >= drawingCanvas.width || cy < 0 || cy >= drawingCanvas.height) continue;
            const currentColor = getPixelColor(cx, cy, data);
            if (!colorsMatch(currentColor, targetColor)) continue;

            setPixelColor(cx, cy, fillColor, data);
            queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function getPixelColor(x, y, data) {
        const index = (y * drawingCanvas.width + x) * 4;
        return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    }

    function setPixelColor(x, y, color, data) {
        const index = (y * drawingCanvas.width + x) * 4;
        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = color[3];
    }

    function colorsMatch(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3];
    }

    function drawShape(startX, startY, endX, endY, shape) {
        const width = endX - startX;
        const height = endY - startY;
        ctx.beginPath();
        if (shape === 'rectangle') {
            ctx.rect(startX, startY, width, height);
            ctx.stroke();
        } else if (shape === 'circle') {
            const radius = Math.sqrt(width * width + height * height) / 2;
            ctx.arc(startX + width / 2, startY + height / 2, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (shape === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    function addText(x, y) {
        if (textInput) textInput.remove();

        // Position the input at the clicked coordinates
        textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.style.position = 'absolute';
        textInput.style.left = x + 'px';
        textInput.style.top = y + 'px';
        textInput.style.fontSize = drawingBrushSize.value + 'px';
        textInput.style.color = drawingColorPicker.value;
        textInput.style.background = 'rgba(255, 255, 255, 0.8)';
        textInput.style.border = '1px solid #000';
        textInput.style.outline = 'none';
        textInput.style.padding = '2px';
        textInput.style.zIndex = '1000';

        // Position relative to the canvas container
        const canvasContainer = drawingCanvas.parentElement;
        canvasContainer.appendChild(textInput);

        textInput.focus();

        textInput.addEventListener('blur', () => {
            if (textInput && textInput.value.trim()) {
                ctx.fillStyle = drawingColorPicker.value;
                ctx.font = drawingBrushSize.value + 'px Arial';
                ctx.fillText(textInput.value.trim(), x, y + parseInt(drawingBrushSize.value));
                saveState();
            }
            if (textInput) {
                textInput.remove();
                textInput = null;
            }
        });

        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                textInput.blur();
            } else if (e.key === 'Escape') {
                textInput.value = '';
                textInput.blur();
            }
        });
    }

    // --- Funciones de Grabación de Audio ---

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const arrayBuffer = await audioBlob.arrayBuffer();

                // Enviar el ArrayBuffer directamente al proceso principal
                window.api.saveAudio(arrayBuffer);

                // Detener el stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;

            // Actualizar UI
            startRecordingBtn.classList.add('hidden');
            stopRecordingBtn.classList.remove('hidden');
            recordingStatus.classList.remove('hidden');

        } catch (error) {
            console.error('Error al iniciar la grabación:', error);
            alert('Error al acceder al micrófono. Asegúrate de tener permisos.');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;

            // Actualizar UI
            startRecordingBtn.classList.remove('hidden');
            stopRecordingBtn.classList.add('hidden');
            recordingStatus.classList.add('hidden');
        }
    }

    // --- Manejadores de Eventos ---

    createNoteBtn.addEventListener('click', () => {
        createNewNote();
    });

    // Modal elements
    const reminderModal = document.getElementById('reminder-modal');
    const reminderTitleInput = document.getElementById('reminder-title');
    const reminderDescriptionInput = document.getElementById('reminder-description');
    const reminderDatetimeInput = document.getElementById('reminder-datetime');
    const reminderCancelBtn = document.getElementById('reminder-cancel');
    const reminderSaveBtn = document.getElementById('reminder-save');

    createReminderBtn.addEventListener('click', () => {
        // Mostrar modal
        reminderModal.style.display = 'block';
        reminderTitleInput.value = '';
        reminderDescriptionInput.value = '';
        reminderDatetimeInput.value = '';
        reminderTitleInput.focus();
    });

    reminderCancelBtn.addEventListener('click', () => {
        reminderModal.style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera
    reminderModal.addEventListener('click', (e) => {
        if (e.target === reminderModal) {
            reminderModal.style.display = 'none';
        }
    });

    reminderSaveBtn.addEventListener('click', () => {
        const title = reminderTitleInput.value.trim();
        const description = reminderDescriptionInput.value.trim();
        const datetime = reminderDatetimeInput.value;

        if (!title) {
            alert('El título es obligatorio');
            reminderTitleInput.focus();
            return;
        }

        if (!datetime) {
            alert('La fecha y hora son obligatorias');
            reminderDatetimeInput.focus();
            return;
        }

        const reminderDate = new Date(datetime);

        if (isNaN(reminderDate.getTime())) {
            alert('La fecha y hora no son válidas');
            reminderDatetimeInput.focus();
            return;
        }

        if (reminderDate <= new Date()) {
            alert('La fecha del recordatorio debe ser en el futuro');
            reminderDatetimeInput.focus();
            return;
        }

        const newReminder = {
            id: `reminder-${Date.now()}`,
            title: title,
            description: description,
            reminderTime: reminderDate.toISOString(),
            createdAt: new Date().toISOString(),
            noteId: null
        };

        reminders[newReminder.id] = newReminder;
        window.api.saveReminder(newReminder);
        renderNotesList();
        reminderModal.style.display = 'none';

        alert(`Recordatorio "${title}" creado exitosamente para ${reminderDate.toLocaleString()}`);
    });

    // --- Event Listeners para Dibujo ---
    createDrawingBtn.addEventListener('click', () => {
        drawingModal.classList.remove('hidden');
        initDrawingCanvas();
    });

    closeDrawingBtn.addEventListener('click', () => {
        drawingModal.classList.add('hidden');
        currentDrawingNoteId = null;
    });

    // Close modal when clicking outside
    drawingModal.addEventListener('click', (e) => {
        if (e.target === drawingModal) {
            drawingModal.classList.add('hidden');
            currentDrawingNoteId = null;
        }
    });

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseout', stopDrawing);

    drawingColorPicker.addEventListener('change', () => {
        ctx.strokeStyle = drawingColorPicker.value;
    });

    drawingBrushSize.addEventListener('input', () => {
        ctx.lineWidth = drawingBrushSize.value;
        brushSizeDisplay.textContent = drawingBrushSize.value;
    });

    drawingClearBtn.addEventListener('click', clearDrawing);
    drawingSaveBtn.addEventListener('click', saveDrawing);

    // Tool selection
    toolPencil.addEventListener('click', (e) => selectTool('pencil', e.target));
    toolBrush.addEventListener('click', (e) => selectTool('brush', e.target));
    toolEraser.addEventListener('click', (e) => selectTool('eraser', e.target));
    toolFill.addEventListener('click', (e) => selectTool('fill', e.target));
    toolLine.addEventListener('click', (e) => selectTool('line', e.target));
    toolRectangle.addEventListener('click', (e) => selectTool('rectangle', e.target));
    toolCircle.addEventListener('click', (e) => selectTool('circle', e.target));
    toolText.addEventListener('click', (e) => selectTool('text', e.target));

    drawingUndoBtn.addEventListener('click', undo);
    drawingRedoBtn.addEventListener('click', redo);

    // --- Event Listeners para Grabación de Audio ---
    startRecordingBtn.addEventListener('click', startRecording);
    stopRecordingBtn.addEventListener('click', stopRecording);

    allNotesNav.addEventListener('click', () => {
        currentView = 'all';
        mainTitle.textContent = 'Notas';

        // Reset table header
        const thead = document.querySelector('thead tr');
        if (thead.children.length === 4) {
            thead.removeChild(thead.firstChild);
        }

        // Set active styles for notes nav
        allNotesNav.classList.add('bg-primary-500/10', 'text-primary-500');
        allNotesNav.classList.remove('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for trash nav
        trashNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        trashNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for reminders nav
        remindersNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        remindersNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for drawing nav
        drawingNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        drawingNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        emptyTrashFloatingBtn.classList.add('hidden');
        startRecordingBtn.classList.remove('hidden');
        updateCreateButtonsVisibility();
        renderNotesList();
    });

    trashNav.addEventListener('click', () => {
        currentView = 'trash';
        mainTitle.textContent = 'Papelera';

        // Reset table header
        const thead = document.querySelector('thead tr');
        if (thead.children.length === 4) {
            thead.removeChild(thead.firstChild);
        }

        // Set active styles for trash nav
        trashNav.classList.add('bg-primary-500/10', 'text-primary-500');
        trashNav.classList.remove('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for notes nav
        allNotesNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        allNotesNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for reminders nav
        remindersNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        remindersNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for drawing nav
        drawingNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        drawingNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        emptyTrashFloatingBtn.classList.remove('hidden');
        startRecordingBtn.classList.add('hidden');
        updateCreateButtonsVisibility();
        renderNotesList();
    });

    remindersNav.addEventListener('click', () => {
        currentView = 'reminders';
        mainTitle.textContent = 'Recordatorios';

        // Reset table header
        const thead = document.querySelector('thead tr');
        if (thead.children.length === 4) {
            thead.removeChild(thead.firstChild);
        }

        // Set active styles for reminders nav
        remindersNav.classList.add('bg-primary-500/10', 'text-primary-500');
        remindersNav.classList.remove('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for notes nav
        allNotesNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        allNotesNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for trash nav
        trashNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        trashNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for drawing nav
        drawingNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        drawingNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        emptyTrashFloatingBtn.classList.add('hidden');
        startRecordingBtn.classList.add('hidden');
        updateCreateButtonsVisibility();
        renderNotesList();
    });

    drawingNav.addEventListener('click', () => {
        currentView = 'drawing';
        mainTitle.textContent = 'Dibujo';

        // Set active styles for drawing nav
        drawingNav.classList.add('bg-primary-500/10', 'text-primary-500');
        drawingNav.classList.remove('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for notes nav
        allNotesNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        allNotesNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for trash nav
        trashNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        trashNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        // Set inactive styles for reminders nav
        remindersNav.classList.remove('bg-primary-500/10', 'text-primary-500');
        remindersNav.classList.add('text-gray-400', 'hover:bg-gray-800/40');

        emptyTrashFloatingBtn.classList.add('hidden');
        startRecordingBtn.classList.add('hidden');
        updateCreateButtonsVisibility();
        renderDrawingView();
    });

    emptyTrashFloatingBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres vaciar la papelera? Esta acción no se puede deshacer.')) {
            window.api.emptyTrash();
        }
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        if (query) {
            let filtered;
            if (currentView === 'trash') {
                filtered = Object.values(trashNotes).filter(note =>
                    (note.title || '').toLowerCase().includes(query) ||
                    note.content.toLowerCase().includes(query)
                );
            } else if (currentView === 'reminders') {
                filtered = Object.values(reminders).filter(reminder =>
                    (reminder.title || '').toLowerCase().includes(query) ||
                    (reminder.description || '').toLowerCase().includes(query)
                );
            } else if (currentView === 'drawing') {
                filtered = Object.values(notes).filter(note => note.drawingPath && (note.title || '').toLowerCase().includes(query));
            } else {
                filtered = Object.values(notes).filter(note =>
                    (note.title || '').toLowerCase().includes(query) ||
                    note.content.toLowerCase().includes(query)
                );
            }
            if (currentView === 'drawing') {
                renderDrawingView();
            } else {
                renderNotesList(filtered);
            }
        } else {
            if (currentView === 'drawing') {
                renderDrawingView();
            } else {
                renderNotesList();
            }
        }
    });

    async function openDrawingForEdit(noteId) {
        const note = notes[noteId];
        if (!note || !note.drawingPath) return;

        currentDrawingNoteId = noteId;
        drawingModal.classList.remove('hidden');
        initDrawingCanvas();

        // Load the drawing into the canvas
        try {
            const dataURL = await window.api.getDrawingData(note.drawingPath);
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                ctx.drawImage(img, 0, 0);
                saveState();
            };
            img.src = dataURL;
        } catch (error) {
            console.error('Error al cargar dibujo:', error);
            alert('Error al cargar el dibujo: ' + error.message);
        }
    }

    function renderDrawingView() {
        const notesTbody = document.getElementById('notes-tbody');
        notesTbody.innerHTML = '';

        // Update table header for drawing view
        const thead = document.querySelector('thead tr');
        if (thead.children.length === 3) {
            const previewTh = document.createElement('th');
            previewTh.classList.add('p-4', 'text-left', 'text-gray-300', 'font-medium');
            previewTh.textContent = 'Vista Previa';
            thead.insertBefore(previewTh, thead.firstChild);
        }

        // Get drawing notes
        const drawingNotes = Object.values(notes).filter(note => note.drawingPath);

        if (drawingNotes.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.classList.add('p-4', 'text-center', 'text-gray-400');
            cell.innerHTML = 'No hay dibujos<br><button id="open-drawing-modal-btn" class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Crear Nuevo Dibujo</button>';
            row.appendChild(cell);
            notesTbody.appendChild(row);

            // Add event listener for the button
            document.getElementById('open-drawing-modal-btn').addEventListener('click', () => {
                drawingModal.classList.remove('hidden');
                initDrawingCanvas();
            });
        } else {
            // Render drawing notes
            drawingNotes.forEach(async (note) => {
                const row = document.createElement('tr');
                row.classList.add('hover:bg-gray-800/40', 'group', 'note-item');
                row.dataset.id = note.id;

                // Preview cell
                const previewCell = document.createElement('td');
                previewCell.classList.add('p-4');
                const previewImg = document.createElement('img');
                previewImg.classList.add('w-16', 'h-16', 'object-cover', 'rounded', 'border', 'border-gray-600');
                previewImg.alt = 'Vista previa del dibujo';
                previewCell.appendChild(previewImg);

                // Load preview
                try {
                    const dataURL = await window.api.getDrawingData(note.drawingPath);
                    previewImg.src = dataURL;
                } catch (error) {
                    console.error('Error al cargar vista previa:', error);
                    previewImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzNCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjZmZmZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FcnJvcjwvdGV4dD4KPHN2Zz4='; // Placeholder
                }

                // Title cell with drawing icon
                const titleCell = document.createElement('td');
                titleCell.classList.add('p-4', 'text-white', 'flex', 'items-center', 'gap-2');

                const drawingIcon = document.createElement('span');
                drawingIcon.classList.add('material-symbols-outlined', 'text-blue-400', 'text-sm', 'flex-shrink-0');
                drawingIcon.textContent = 'brush';
                titleCell.appendChild(drawingIcon);

                const titleText = document.createElement('span');
                titleText.textContent = note.title || 'Dibujo sin título';
                titleText.classList.add('truncate', 'max-w-xs');
                titleCell.appendChild(titleText);

                titleCell.title = note.title || 'Dibujo sin título';
                titleCell.addEventListener('click', () => openDrawingForEdit(note.id));

                // Date cell
                const dateCell = document.createElement('td');
                dateCell.classList.add('p-4', 'text-gray-400', 'whitespace-nowrap');
                dateCell.textContent = formatDate(note.updatedAt);

                // Actions cell
                const actionsCell = document.createElement('td');
                actionsCell.classList.add('p-4', 'text-right');

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('flex', 'items-center', 'justify-end', 'gap-2', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity', 'duration-200');

                const editBtn = createActionButton('edit', 'Editar', 'text-gray-400', 'hover:bg-white/10', () => openDrawingForEdit(note.id));
                const deleteBtn = createActionButton('delete', 'Eliminar', 'text-red-400', 'hover:bg-red-500/10', () => deleteNote(note.id));

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);
                actionsCell.appendChild(actionsDiv);

                row.appendChild(previewCell);
                row.appendChild(titleCell);
                row.appendChild(dateCell);
                row.appendChild(actionsCell);

                notesTbody.appendChild(row);
            });
        }
    }

    // --- Context Menu Logic ---
    let contextMenuNoteId = null;

    function showContextMenu(event, noteId) {
        event.preventDefault();
        contextMenuNoteId = noteId;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.display = 'block';
    }

    window.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    ctxOpenFloat.addEventListener('click', () => {
        if (contextMenuNoteId) {
            window.api.openInFloatWindow(contextMenuNoteId);
        }
    });

    ctxDelete.addEventListener('click', () => {
        if (contextMenuNoteId) {
            deleteNote(contextMenuNoteId);
        }
    });

    // --- IPC Listeners (Main -> Renderer) ---

    window.api.onNoteUpdated(note => {
        notes[note.id] = note;
        renderNotesList();
    });

    window.api.onNoteDeleted(noteId => {
        // Move note to trashNotes if it exists in notes
        if (notes[noteId]) {
            trashNotes[noteId] = notes[noteId];
            delete notes[noteId];
        }
        renderNotesList();
    });

    window.api.onNoteRecovered(noteId => {
        // Move note from trashNotes to notes if it exists
        if (trashNotes[noteId]) {
            notes[noteId] = trashNotes[noteId];
            delete trashNotes[noteId];
        }
        renderNotesList();
    });

    window.api.onNoteDeletedPermanent(noteId => {
        // Remove note from trashNotes if it exists
        if (trashNotes[noteId]) {
            delete trashNotes[noteId];
        }
        renderNotesList();
    });

    window.api.onTrashEmptied(() => {
        trashNotes = {};
        renderNotesList();
    });

    window.api.onReminderUpdated(reminder => {
        reminders[reminder.id] = reminder;
        renderNotesList();
    });

    window.api.onReminderDeleted(reminderId => {
        delete reminders[reminderId];
        renderNotesList();
    });

    // --- Audio IPC Listeners ---
    window.api.onAudioNoteCreated(note => {
        notes[note.id] = note;
        renderNotesList();
        alert(`Nota de audio creada exitosamente: "${note.title}"`);
    });

    window.api.onAudioSaveError(error => {
        alert(`Error al guardar la nota de audio:\n${error}`);
    });

    // --- Drawing IPC Listeners ---
    window.api.onDrawingSaved(note => {
        notes[note.id] = note;
        renderNotesList();
        alert(`Dibujo guardado exitosamente: "${note.title}"`);
    });

    window.api.onDrawingSaveError(error => {
        alert(`Error al guardar el dibujo:\n${error}`);
    });

    // --- Atajos de Teclado ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    createNewNote();
                    break;
                case 'r':
                    e.preventDefault();
                    createReminderBtn.click();
                    break;
                case 'd':
                    e.preventDefault();
                    createDrawingBtn.click();
                    break;
                case 's':
                    e.preventDefault();
                    if (currentView === 'drawing' && drawingModal.classList.contains('hidden') === false) {
                        saveDrawing();
                    }
                    break;
            }
        }
    });

    // --- Window Controls ---
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.api.minimizeWindow();
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            window.api.maximizeWindow();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.api.closeWindow();
        });
    }

    // --- Inicialización ---
    loadInitialNotes();
    updateCreateButtonsVisibility();
});
