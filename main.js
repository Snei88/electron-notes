const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// --- Variables Globales ---
let mainWindow;
const floatingWindows = new Map();
let dataPath;

let notes = {};
let trashNotes = {};
let reminders = {};
let notificationTimeouts = new Map();

// --- Funciones de Persistencia ---
// Función para cargar las notas desde el archivo JSON
function loadNotes() {
    try {
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf-8');
            const parsed = JSON.parse(data);
            notes = parsed.notes || {};
            trashNotes = parsed.trashNotes || {};
            reminders = parsed.reminders || {};

            // Asegurar que las propiedades reminder y audioFiles existan en las notas
            for (const noteId in notes) {
                const note = notes[noteId];
                if (!('reminder' in note)) {
                    note.reminder = null;
                }
                if (!('audioFiles' in note) || !Array.isArray(note.audioFiles)) {
                    note.audioFiles = [];
                }
                if (!('drawingPath' in note)) {
                    note.drawingPath = null;
                }
                // Asegurar que otras propiedades requeridas existan
                if (!('isPinned' in note)) {
                    note.isPinned = false;
                }
                if (!('createdAt' in note)) {
                    note.createdAt = new Date().toISOString();
                }
                if (!('updatedAt' in note)) {
                    note.updatedAt = new Date().toISOString();
                }
            }
            // Asegurar que las propiedades existan en las notas de la papelera
            for (const noteId in trashNotes) {
                const note = trashNotes[noteId];
                if (!('reminder' in note)) {
                    note.reminder = null;
                }
                if (!('audioFiles' in note) || !Array.isArray(note.audioFiles)) {
                    note.audioFiles = [];
                }
                if (!('drawingPath' in note)) {
                    note.drawingPath = null;
                }
                // Asegurar que otras propiedades requeridas existan
                if (!('isPinned' in note)) {
                    note.isPinned = false;
                }
                if (!('createdAt' in note)) {
                    note.createdAt = new Date().toISOString();
                }
                if (!('updatedAt' in note)) {
                    note.updatedAt = new Date().toISOString();
                }
            }
        } else {
            notes = {};
            trashNotes = {};
            reminders = {};
        }
    } catch (error) {
        console.error('Error al cargar las notas:', error);
        notes = {};
        trashNotes = {};
        reminders = {};
    }
}

// Función para guardar las notas en el archivo JSON
function saveNotes() {
    try {
        if (dataPath) {
            const data = { notes, trashNotes, reminders };
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('Error al guardar las notas:', error);
    }
}

// --- Funciones de Notificaciones ---
// Función para programar una notificación en el sistema operativo
function scheduleNotification({ id, when, title, body, icon }) {
    console.log('Main: Programando notificacion:', { id, when, title, body });

    const now = Date.now();
    const due = new Date(when).getTime();

    if (isNaN(due)) {
        console.error('Main: Fecha invalida para notificacion:', when);
        throw new Error('Fecha invalida');
    }

    const delay = Math.max(0, due - now); // Si la fecha ya pasó, dispara inmediatamente
    console.log('Main: Delay calculado:', delay, 'ms');

    const t = setTimeout(() => {
        console.log('Main: Disparando notificacion:', title);

        // Crear la notificación nativa del sistema
        const notification = new Notification({
            title,
            body,
            icon, // Opcional: ruta a archivo PNG/ICO
            silent: false, // Cambiar a true si no quieres sonido
            urgency: 'normal' // En Linux: 'low' | 'normal' | 'critical'
        });

        // Manejar clic en la notificación
        notification.on('click', () => {
            console.log('Main: Notificación clickeada:', id);
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                // Enviar evento al renderer para manejar el clic
                mainWindow.webContents.send('notification:clicked', { id });
            }
        });

        // Manejar evento de mostrar
        notification.on('show', () => {
            console.log('Main: Notificación mostrada exitosamente:', title);
        });

        // Manejar errores
        notification.on('error', (error) => {
            console.error('Main: Error al mostrar notificacion:', error);
        });

        try {
            notification.show();
            notificationTimeouts.delete(id);
            console.log('Main: Notificación mostrada y timeout removido');
        } catch (error) {
            console.error('Main: Error al mostrar notificación:', error);
            // Si falla la notificación nativa, enviar al renderer para mostrar fallback
            if (mainWindow) {
                mainWindow.webContents.send('notification:fallback', { id, title, body });
            }
        }
    }, delay);

    // Si ya había una notificación programada con este id, cancelarla
    if (notificationTimeouts.has(id)) {
        clearTimeout(notificationTimeouts.get(id));
        console.log('Main: Timeout anterior cancelado para id:', id);
    }
    notificationTimeouts.set(id, t);
    console.log('Main: Notificación programada para id:', id);
}

function cancelNotification(id) {
    console.log('Main: Cancelando notificación:', id);
    const t = notificationTimeouts.get(id);
    if (t) {
        clearTimeout(t);
        notificationTimeouts.delete(id);
        console.log('Main: Notificación cancelada exitosamente');
    } else {
        console.log('Main: No se encontró timeout para id:', id);
    }
}

// --- Funciones de Creación de Ventanas ---

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Remove default title bar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'Centro de Notas',
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
                    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self'; " +
                    "object-src 'none'; " +
                    "base-uri 'self'; " +
                    "form-action 'self';"
                ]
            }
        });
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();
    mainWindow.on('closed', () => { mainWindow = null; });
}


function createFloatingNoteWindow(note) {
    if (floatingWindows.has(note.id)) {
        floatingWindows.get(note.id).focus();
        return;
    }
    const noteWindow = new BrowserWindow({
        width: 350, height: 350, frame: false, transparent: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js') },
        skipTaskbar: true, show: false,
    });
    noteWindow.loadFile('note.html', { hash: note.id });
    noteWindow.once('ready-to-show', () => {
        noteWindow.show();
        if (note.isPinned) noteWindow.setAlwaysOnTop(true, 'screen-saver');
    });
    noteWindow.on('closed', () => { floatingWindows.delete(note.id); });
    floatingWindows.set(note.id, noteWindow);
}

// --- Lógica Principal de la Aplicación ---

function main() {
    dataPath = path.join(app.getPath('userData'), 'notes.json');
    loadNotes();

    // Programar notificaciones para recordatorios existentes
    Object.values(reminders).forEach(reminder => {
        const reminderTime = new Date(reminder.reminderTime);
        if (reminderTime > new Date()) {
            console.log('Main: Programando notificación existente:', reminder.title);
            scheduleNotification({
                id: reminder.id,
                when: reminder.reminderTime,
                title: `Recordatorio: ${reminder.title}`,
                body: reminder.description || 'Sin descripción',
                icon: undefined
            });
        }
    });

    ipcMain.handle('get-notes', () => notes);
    ipcMain.handle('get-note-data', (event, noteId) => notes[noteId]);
    ipcMain.handle('get-trash-notes', () => trashNotes);
    ipcMain.handle('get-reminders', () => reminders);
    ipcMain.on('save-note', (event, note) => {
        notes[note.id] = note;
        saveNotes();
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('note-updated', note));
    });
    ipcMain.on('delete-note', (event, noteId) => {
        if (notes[noteId]) {
            trashNotes[noteId] = notes[noteId];
            delete notes[noteId];
            saveNotes();
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('note-deleted', noteId));
            if (floatingWindows.has(noteId)) floatingWindows.get(noteId).close();
        }
    });
    ipcMain.on('recover-note', (event, noteId) => {
        if (trashNotes[noteId]) {
            notes[noteId] = trashNotes[noteId];
            delete trashNotes[noteId];
            saveNotes();
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('note-recovered', noteId));
        }
    });
    ipcMain.on('delete-note-permanent', (event, noteId) => {
        if (trashNotes[noteId]) {
            delete trashNotes[noteId];
            saveNotes();
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('note-deleted-permanent', noteId));
        }
    });
    ipcMain.on('empty-trash', () => {
        trashNotes = {};
        saveNotes();
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('trash-emptied'));
    });
    ipcMain.on('open-in-float-window', (event, noteId) => {
        if (notes[noteId]) createFloatingNoteWindow(notes[noteId]);
    });
    ipcMain.on('float-window-action', (event, { action, noteId }) => {
        const window = floatingWindows.get(noteId);
        if (!window) return;
        switch (action) {
            case 'minimize': window.minimize(); break;
            case 'close': window.close(); break;
            case 'toggle-pin':
                const note = notes[noteId];
                note.isPinned = !note.isPinned;
                window.setAlwaysOnTop(note.isPinned, 'screen-saver');
                event.sender.send('note-updated', note);
                if(mainWindow) mainWindow.webContents.send('note-updated', note);
                saveNotes();
                break;
        }
    });
    ipcMain.on('save-reminder', (event, reminder) => {
        console.log('Main: Guardando recordatorio:', reminder);
        reminders[reminder.id] = reminder;
        console.log('Main: Recordatorios actuales:', Object.keys(reminders).length);
        saveNotes();
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('reminder-updated', reminder));
        console.log('Main: Recordatorio guardado y notificado a todas las ventanas');
    });
    ipcMain.on('delete-reminder', (event, reminderId) => {
        if (reminders[reminderId]) {
            cancelNotification(reminderId); // Cancelar notificación si existe
            delete reminders[reminderId];
            saveNotes();
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('reminder-deleted', reminderId));
        }
    });

    // --- Audio Notes ---
    ipcMain.on('save-audio', async (event, audioArrayBuffer) => {
        try {
            const fs = require('fs');
            const path = require('path');

            // Crear directorio para audios si no existe
            const userDataPath = app.getPath('userData');
            const audioDir = path.join(userDataPath, 'audio');

            console.log('Directorio de usuario:', userDataPath);
            console.log('Directorio de audio:', audioDir);

            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
                console.log('Directorio de audio creado:', audioDir);
            }

            // Generar nombre único para el archivo
            const fileName = `audio-${Date.now()}.webm`;
            const filePath = path.join(audioDir, fileName);

            console.log('Ruta completa del archivo:', filePath);

            // Convertir ArrayBuffer a Buffer de Node.js
            const buffer = Buffer.from(audioArrayBuffer);

            fs.writeFile(filePath, buffer, (err) => {
                if (err) {
                    console.error('Error al guardar el archivo de audio:', err);
                    event.sender.send('audio-save-error', err.message);
                } else {
                    console.log('Audio guardado exitosamente en:', filePath);

                    // Crear una nueva nota con el audio
                    const newNote = {
                        id: `note-${Date.now()}`,
                        title: 'Nota de Audio',
                        content: `Audio grabado el ${new Date().toLocaleString()}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isPinned: false,
                        reminder: null,
                        audioFiles: [{
                            fileName: fileName,
                            filePath: filePath,
                            recordedAt: new Date().toISOString(),
                            duration: null // Podríamos calcular la duración más tarde
                        }]
                    };

                    notes[newNote.id] = newNote;
                    saveNotes();

                    // Notificar a todas las ventanas
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('note-updated', newNote);
                    });

                    event.sender.send('audio-note-created', newNote);
                }
            });
        } catch (error) {
            console.error('Error en save-audio:', error);
            event.sender.send('audio-save-error', error.message);
        }
    });

    // --- Drawing Save ---
    ipcMain.handle('get-drawing-data', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('Archivo de dibujo no encontrado');
            }
            const buffer = fs.readFileSync(filePath);
            const dataURL = `data:image/png;base64,${buffer.toString('base64')}`;
            return dataURL;
        } catch (error) {
            console.error('Error al cargar dibujo:', error);
            throw error;
        }
    });

    ipcMain.on('save-drawing', async (event, { dataURL, noteId, title }) => {
        try {
            const fs = require('fs');
            const path = require('path');

            // Crear directorio para dibujos si no existe
            const userDataPath = app.getPath('userData');
            const drawingDir = path.join(userDataPath, 'drawings');

            console.log('Directorio de usuario:', userDataPath);
            console.log('Directorio de dibujos:', drawingDir);

            if (!fs.existsSync(drawingDir)) {
                fs.mkdirSync(drawingDir, { recursive: true });
                console.log('Directorio de dibujos creado:', drawingDir);
            }

            // Generar nombre único para el archivo
            const fileName = `drawing-${Date.now()}.png`;
            const filePath = path.join(drawingDir, fileName);

            console.log('Ruta completa del archivo:', filePath);

            // Convertir dataURL a Buffer
            const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            fs.writeFile(filePath, buffer, (err) => {
                if (err) {
                    console.error('Error al guardar el archivo de dibujo:', err);
                    event.sender.send('drawing-save-error', err.message);
                } else {
                    console.log('Dibujo guardado exitosamente en:', filePath);

                    let note;
                    if (noteId && notes[noteId]) {
                        // Update existing note
                        note = notes[noteId];
                        note.drawingPath = filePath;
                        note.updatedAt = new Date().toISOString();
                    } else {
                        // Create new drawing note
                        note = {
                            id: `note-${Date.now()}`,
                            title: title || 'Dibujo',
                            content: '',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            isPinned: false,
                            reminder: null,
                            audioFiles: [],
                            drawingPath: filePath,
                        };
                        notes[note.id] = note;
                    }

                    saveNotes();

                    // Notificar a todas las ventanas
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('note-updated', note);
                    });

                    event.sender.send('drawing-saved', note);
                }
            });
        } catch (error) {
            console.error('Error en save-drawing:', error);
            event.sender.send('drawing-save-error', error.message);
        }
    });

    // --- IPC Handlers para Notificaciones ---
    ipcMain.handle('notify:schedule', (event, payload) => {
        try {
            scheduleNotification(payload);
            return { ok: true };
        } catch (error) {
            console.error('Main: Error al programar notificación:', error);
            return { ok: false, error: error.message };
        }
    });

    ipcMain.handle('notify:cancel', (event, id) => {
        cancelNotification(id);
        return { ok: true };
    });

    // --- IPC Handlers para controles de ventana ---
    ipcMain.on('minimize-window', () => {
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) {
            mainWindow.close();
        }
    });

    createMainWindow();
}

// --- Ciclo de Vida de Electron ---
app.whenReady().then(() => {
    // Nota: Los permisos de notificación se solicitan desde el renderer process
    // donde está disponible la API de Notification
    main();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    saveNotes();
});
