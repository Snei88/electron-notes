const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // --- Invocaciones (Renderer -> Main -> Renderer) ---
    getNotes: () => ipcRenderer.invoke('get-notes'),
    getNoteData: (noteId) => ipcRenderer.invoke('get-note-data', noteId),
    getTrashNotes: () => ipcRenderer.invoke('get-trash-notes'),
    getReminders: () => ipcRenderer.invoke('get-reminders'),

    // --- Eventos (Renderer -> Main) ---
    saveNote: (note) => ipcRenderer.send('save-note', note),
    deleteNote: (noteId) => ipcRenderer.send('delete-note', noteId),
    recoverNote: (noteId) => ipcRenderer.send('recover-note', noteId),
    deleteNotePermanent: (noteId) => ipcRenderer.send('delete-note-permanent', noteId),
    emptyTrash: () => ipcRenderer.send('empty-trash'),
    openInFloatWindow: (noteId) => ipcRenderer.send('open-in-float-window', noteId),
    floatWindowAction: (action, noteId) => ipcRenderer.send('float-window-action', { action, noteId }),
    preventClose: () => ipcRenderer.send('prevent-close'),
    saveReminder: (reminder) => ipcRenderer.send('save-reminder', reminder),
    deleteReminder: (reminderId) => ipcRenderer.send('delete-reminder', reminderId),

    // --- Audio Notes ---
    saveAudio: (audioBuffer) => ipcRenderer.send('save-audio', audioBuffer),
    onAudioNoteCreated: (callback) => ipcRenderer.on('audio-note-created', (event, note) => callback(note)),
    onAudioSaveError: (callback) => ipcRenderer.on('audio-save-error', (event, error) => callback(error)),

    // --- Drawing ---
    saveDrawing: (data) => ipcRenderer.send('save-drawing', data),
    getDrawingData: (filePath) => ipcRenderer.invoke('get-drawing-data', filePath),
    onDrawingSaved: (callback) => ipcRenderer.on('drawing-saved', (event, note) => callback(note)),
    onDrawingSaveError: (callback) => ipcRenderer.on('drawing-save-error', (event, error) => callback(error)),

    // --- Eventos (Main -> Renderer) ---
    onNoteUpdated: (callback) => ipcRenderer.on('note-updated', (event, note) => callback(note)),
    onNoteDeleted: (callback) => ipcRenderer.on('note-deleted', (event, noteId) => callback(noteId)),
    onNoteRecovered: (callback) => ipcRenderer.on('note-recovered', (event, noteId) => callback(noteId)),
    onNoteDeletedPermanent: (callback) => ipcRenderer.on('note-deleted-permanent', (event, noteId) => callback(noteId)),
    onTrashEmptied: (callback) => ipcRenderer.on('trash-emptied', () => callback()),
    onReminderUpdated: (callback) => ipcRenderer.on('reminder-updated', (event, reminder) => callback(reminder)),
    onReminderDeleted: (callback) => ipcRenderer.on('reminder-deleted', (event, reminderId) => callback(reminderId)),

    // --- API de Notificaciones ---
    scheduleNotification: (payload) => ipcRenderer.invoke('notify:schedule', payload),
    cancelNotification: (id) => ipcRenderer.invoke('notify:cancel', id),
    onNotificationClicked: (callback) => ipcRenderer.on('notification:clicked', (event, data) => callback(data)),
    onNotificationFallback: (callback) => ipcRenderer.on('notification:fallback', (event, data) => callback(data)),

    // --- Controles de Ventana ---
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
});
