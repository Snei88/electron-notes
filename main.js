const { app, BrowserWindow, ipcMain, Notification, session } = require('electron');
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
let settings = { theme: 'dark' };


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
            settings = parsed.settings || { theme: 'dark' };

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
            const data = { notes, trashNotes, reminders, settings };
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

ipcMain.handle('settings:get', () => settings);
ipcMain.on('settings:set', (_e, patch) => {
  settings = { ...settings, ...patch };
  saveNotes();
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('settings:changed', settings));
});


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
                    "connect-src 'self' http://127.0.0.1:5000; " + // <--- ¡ESTA ES LA LÍNEA QUE HACE EL API!
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
        width: 400,
        height: 450,
        minWidth: 300,
        minHeight: 200,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: { 
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: false
        },
        skipTaskbar: true,
        show: false,
    });
    noteWindow.loadFile('note.html', { hash: note.id });
    noteWindow.once('ready-to-show', () => {
        noteWindow.setSize(400, 450);
        noteWindow.show();
        // Forzar redibujado después de mostrar
        setTimeout(() => {
            noteWindow.setSize(400, 450);
        }, 100);
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

    // Agregar estos nuevos handlers en main.js, en la sección de IPC handlers
    ipcMain.on('float-window-action', (event, { action, noteId }) => {
        const window = floatingWindows.get(noteId);
        if (!window) return;
        
        switch (action) {
            case 'minimize': 
                window.minimize(); 
                break;
            case 'close': 
                window.close(); 
                break;
            case 'toggle-pin':
                const note = notes[noteId];
                note.isPinned = !note.isPinned;
                window.setAlwaysOnTop(note.isPinned, 'screen-saver');
                event.sender.send('note-updated', note);
                if(mainWindow) mainWindow.webContents.send('note-updated', note);
                saveNotes();
                break;
            case 'expand-word':
                // Handler específico para modo Word
                expandToWordMode(window, noteId);
                break;
            case 'restore':
                // Handler específico para restaurar
                restoreToFloatingMode(window, noteId);
                break;
        }
    });

    // Función auxiliar para expandir a modo Word
    function expandToWordMode(window, noteId) {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        
        const newWidth = Math.floor(width * 0.92);
        const newHeight = Math.floor(height * 0.92);
        
        window.setBounds({
            width: newWidth,
            height: newHeight,
            x: Math.floor((width - newWidth) / 2),
            y: Math.floor((height - newHeight) / 2)
        });
        
        window.setResizable(true);
        window.setMaximizable(true);
        window.setMinimumSize(800, 600);
        
        console.log(`📝 Ventana ${noteId} en modo Word: ${newWidth}x${newHeight}`);
    }

    // Función auxiliar para restaurar modo flotante
    function restoreToFloatingMode(window, noteId) {
        window.setBounds({
            width: 400,
            height: 450
        });
        
        window.center();
        window.setResizable(true);
        window.setMinimumSize(300, 200);
        
        console.log(`📝 Ventana ${noteId} restaurada a modo flotante: 400x450`);
    }
    
    // Handlers para modo Word
    ipcMain.on('expand-note-window', (event, noteId) => {
        const window = floatingWindows.get(noteId);
        if (!window) return;

        // Obtener el tamaño de la pantalla
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        // Configurar ventana para modo Word (80% del área de trabajo)
        const newWidth = Math.floor(width * 0.8);
        const newHeight = Math.floor(height * 0.8);

        window.setBounds({
            width: newWidth,
            height: newHeight,
            x: Math.floor((width - newWidth) / 2),
            y: Math.floor((height - newHeight) / 2)
        });

        // Permitir redimensionamiento y maximización
        window.setResizable(true);
        window.setMaximizable(true);
        window.setMinimumSize(600, 400);

        console.log(`✅ Ventana ${noteId} expandida a: ${newWidth}x${newHeight}`);
    });

    
    ipcMain.on('restore-note-window', (event, noteId) => {
        const window = floatingWindows.get(noteId);
        if (!window) return;

    // Restaurar tamaño original de nota flotante
    window.setBounds({
        width: 350,
        height: 350
    });

        // Centrar en la pantalla
        window.center();
        
        console.log(`✅ Ventana ${noteId} restaurada a tamaño flotante`);
    });


    ipcMain.on('save-reminder', (event, reminder) => {
        console.log('Main: Guardando recordatorio:', reminder);
        reminders[reminder.id] = reminder;
        console.log('Main: Recordatorios actuales:', Object.keys(reminders).length);
        saveNotes();
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('reminder-updated', reminder));
        console.log('Main: Recordatorio guardado y notificado a todas las ventanas');
        
        // Schedule the notification for the reminder
        const reminderTime = new Date(reminder.reminderTime);
        if (reminderTime > new Date()) {
            scheduleNotification({
                id: reminder.id,
                when: reminder.reminderTime,
                title: `Recordatorio: ${reminder.title}`,
                body: reminder.description || 'Sin descripción',
                icon: undefined
            });
        }
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

                    // Generar nombre único para el archivo (intentamos inferir extensión)
                    let mimeType = 'audio/webm';
                    let fileExtension = '.webm';

                    // Intentar detectar tipo por contenido mínimo (fallback básico)
                    try {
                        const header = Buffer.from(audioArrayBuffer).slice(0, 12).toString('hex');
                        // webm/ogg/mp4 detection is complex; fallback to webm
                        if (header.includes('1a45dfa3')) { // EBML => likely webm/mkv
                            mimeType = 'audio/webm';
                            fileExtension = '.webm';
                        }
                    } catch (e) {
                        // ignore detection errors
                    }

                    const fileName = `audio-${Date.now()}${fileExtension}`;
                    const filePath = path.join(audioDir, fileName);

                    // Convertir ArrayBuffer a Buffer de Node.js
                    const buffer = Buffer.from(audioArrayBuffer);

                    fs.writeFile(filePath, buffer, (err) => {
                        if (err) {
                            console.error('Error al guardar el archivo de audio:', err);
                            event.sender.send('audio-save-error', err.message);
                        } else {
                            console.log('Audio guardado exitosamente en:', filePath);

                            // Calcular estadísticas del archivo
                            const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
                            // Estimación aproximada de duración basada en bitrate (si disponible)
                            let duration = null;
                            const assumedKbps = 128; // fallback
                            try {
                                duration = Math.round((buffer.length * 8) / (assumedKbps * 1000));
                                duration = '~' + duration + 's';
                            } catch (e) {
                                duration = null;
                            }

                            const newNote = {
                                id: `note-${Date.now()}`,
                                title: `Nota de Audio ${new Date().toLocaleString()}`,
                                content: '', // Mantener el contenido vacío para que no muestre metadata en el cuerpo
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                isPinned: false,
                                reminder: null,
                                audioFiles: [{
                                    fileName: fileName,
                                    filePath: filePath,
                                    recordedAt: new Date().toISOString(),
                                    duration: duration,
                                    fileSize: fileSizeMB + ' MB',
                                    mimeType: mimeType
                                }]
                            };

                            notes[newNote.id] = newNote;
                            saveNotes();

                            // Notificar a todas las ventanas
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('note-updated', newNote);
                            });

                            event.sender.send('audio-note-created', newNote);

                            // Mostrar notificación de éxito
                            try {
                                if (Notification) {
                                    new Notification({
                                        title: 'Grabación Guardada',
                                        body: `Audio guardado: ${fileSizeMB} MB`,
                                        silent: true
                                    }).show();
                                }
                            } catch (nerr) {
                                console.warn('No se pudo mostrar notificación nativa:', nerr);
                            }
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
                // Log para debugging
                console.log(' Main: Iniciando guardado de dibujo...');
                console.log('   - noteId:', noteId);
                console.log('   - title:', title);
                console.log('   - dataURL length:', dataURL?.length);
        
                // Verificar si ya hay un guardado en progreso para esta nota
                if (noteId && notes[noteId]?.drawingPath) {
                    console.log('ℹ  Actualizando dibujo existente:', noteId);
                }
        
                try {
                    const fs = require('fs');
                    const path = require('path');

                    // Crear directorio para dibujos si no existe
                    const userDataPath = app.getPath('userData');
                    const drawingDir = path.join(userDataPath, 'drawings');

                    if (!fs.existsSync(drawingDir)) {
                        fs.mkdirSync(drawingDir, { recursive: true });
                        console.log('Directorio de dibujos creado:', drawingDir);
                    }

                    // Generar nombre único para el archivo
                    const timestamp = Date.now();
                    const fileName = `drawing-${timestamp}.png`;
                    const filePath = path.join(drawingDir, fileName);

                    console.log('Guardando archivo en:', filePath);

                    // Convertir dataURL a Buffer
                    const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Guardar el archivo
                    await fs.promises.writeFile(filePath, buffer);
                    console.log(' Archivo de dibujo guardado exitosamente');

                    let note;
                    if (noteId && notes[noteId]) {
                        // ACTUALIZAR nota existente - eliminar duplicados
                        note = notes[noteId];
                        note.drawingPath = filePath;
                        note.updatedAt = new Date().toISOString();
                        note.title = title || note.title || 'Dibujo actualizado';
            
                        console.log('Dibujo actualizado en nota existente:', noteId);
                    } else {
                        // CREAR nueva nota - asegurar ID único
                        const newNoteId = `note-${timestamp}`;
                        note = {
                            id: newNoteId,
                            title: title || 'Dibujo',
                            content: '',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            isPinned: false,
                            reminder: null,
                            audioFiles: [],
                            drawingPath: filePath,
                        };
                        notes[newNoteId] = note;
            
                        console.log(' Nueva nota de dibujo creada:', newNoteId);
                    }

                    // Guardar una sola vez
                    saveNotes();
                    console.log(' Notas guardadas en disco');

                    // Enviar evento UNA sola vez a todas las ventanas
                    const windows = BrowserWindow.getAllWindows();
                    console.log(`Enviando evento a ${windows.length} ventanas`);
          
                    windows.forEach(win => {
                        win.webContents.send('note-updated', note);
                    });

                    // Enviar evento de dibujo guardado SOLO al remitente original
                    event.sender.send('drawing-saved', note);
          
                    console.log(' Proceso de guardado de dibujo completado');

                } catch (error) {
                    console.error(' Error en save-drawing:', error);
          
                    // Enviar error solo al remitente original
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
