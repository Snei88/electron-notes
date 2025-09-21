'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/** Helper para crear suscripción con devolución de unsubscribe */
function makeOn(channel, mapArgs = (args) => args.length <= 1 ? args[0] : args) {
  return (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, ...args) => {
      try { callback(mapArgs(args)); } catch (e) { console.error(`Listener error (${channel})`, e); }
    };
    ipcRenderer.on(channel, listener);
    // Permite limpiar el listener cuando quieras
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

/** Helper para "once" */
function makeOnce(channel, mapArgs = (args) => args.length <= 1 ? args[0] : args) {
  return (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.once(channel, (_event, ...args) => {
      try { callback(mapArgs(args)); } catch (e) { console.error(`Once listener error (${channel})`, e); }
    });
  };
}

/** No exponemos removeAllListeners genérico para no abrir superficie de ataque;
 *  damos off* específicos por canal cuando sea útil. */
const api = {
  // --- Invocaciones (Renderer -> Main -> Renderer) ---
  getNotes:        () => ipcRenderer.invoke('get-notes'),
  getNoteData:     (noteId) => ipcRenderer.invoke('get-note-data', noteId),
  getTrashNotes:   () => ipcRenderer.invoke('get-trash-notes'),
  getReminders:    () => ipcRenderer.invoke('get-reminders'),

  // --- Eventos (Renderer -> Main) ---
  saveNote:            (note)   => ipcRenderer.send('save-note', note),
  deleteNote:          (noteId) => ipcRenderer.send('delete-note', noteId),
  recoverNote:         (noteId) => ipcRenderer.send('recover-note', noteId),
  deleteNotePermanent: (noteId) => ipcRenderer.send('delete-note-permanent', noteId),
  emptyTrash:          ()       => ipcRenderer.send('empty-trash'),
  openInFloatWindow:   (noteId) => ipcRenderer.send('open-in-float-window', noteId),
  floatWindowAction:   (action, noteId) => ipcRenderer.send('float-window-action', { action, noteId }),
  preventClose:        ()       => ipcRenderer.send('prevent-close'),
  saveReminder:        (reminder) => ipcRenderer.send('save-reminder', reminder),
  deleteReminder:      (reminderId) => ipcRenderer.send('delete-reminder', reminderId),

  // --- Audio Notes ---
  // Si quisieras esperar confirmación, podrías migrar a invoke('save-audio', buf) en el main.
  saveAudio:            (audioBuffer) => ipcRenderer.send('save-audio', audioBuffer),
  onAudioNoteCreated:   makeOn('audio-note-created'),
  onceAudioNoteCreated: makeOnce('audio-note-created'),
  offAudioNoteCreated:  () => ipcRenderer.removeAllListeners('audio-note-created'),

  onAudioSaveError:     makeOn('audio-save-error'),
  onceAudioSaveError:   makeOnce('audio-save-error'),
  offAudioSaveError:    () => ipcRenderer.removeAllListeners('audio-save-error'),

  // --- Drawing ---
  saveDrawing:    (data)    => ipcRenderer.send('save-drawing', data),
  getDrawingData: (filePath)=> ipcRenderer.invoke('get-drawing-data', filePath),

  onDrawingSaved:        makeOn('drawing-saved'),
  onceDrawingSaved:      makeOnce('drawing-saved'),
  offDrawingSaved:       () => ipcRenderer.removeAllListeners('drawing-saved'),

  onDrawingSaveError:    makeOn('drawing-save-error'),
  onceDrawingSaveError:  makeOnce('drawing-save-error'),
  offDrawingSaveError:   () => ipcRenderer.removeAllListeners('drawing-save-error'),

  // --- Eventos (Main -> Renderer) ---
  onNoteUpdated:         makeOn('note-updated'),
  onceNoteUpdated:       makeOnce('note-updated'),
  offNoteUpdated:        () => ipcRenderer.removeAllListeners('note-updated'),

  onNoteDeleted:         makeOn('note-deleted'),
  onceNoteDeleted:       makeOnce('note-deleted'),
  offNoteDeleted:        () => ipcRenderer.removeAllListeners('note-deleted'),

  onNoteRecovered:       makeOn('note-recovered'),
  onceNoteRecovered:     makeOnce('note-recovered'),
  offNoteRecovered:      () => ipcRenderer.removeAllListeners('note-recovered'),

  onNoteDeletedPermanent:  makeOn('note-deleted-permanent'),
  onceNoteDeletedPermanent:makeOnce('note-deleted-permanent'),
  offNoteDeletedPermanent: () => ipcRenderer.removeAllListeners('note-deleted-permanent'),

  onTrashEmptied:        makeOn('trash-emptied'),
  onceTrashEmptied:      makeOnce('trash-emptied'),
  offTrashEmptied:       () => ipcRenderer.removeAllListeners('trash-emptied'),

  onReminderUpdated:     makeOn('reminder-updated'),
  onceReminderUpdated:   makeOnce('reminder-updated'),
  offReminderUpdated:    () => ipcRenderer.removeAllListeners('reminder-updated'),

  onReminderDeleted:     makeOn('reminder-deleted'),
  onceReminderDeleted:   makeOnce('reminder-deleted'),
  offReminderDeleted:    () => ipcRenderer.removeAllListeners('reminder-deleted'),

  // --- API de Notificaciones ---
  scheduleNotification:  (payload) => ipcRenderer.invoke('notify:schedule', payload),
  cancelNotification:    (id)      => ipcRenderer.invoke('notify:cancel', id),
  onNotificationClicked: makeOn('notification:clicked'),
  offNotificationClicked:() => ipcRenderer.removeAllListeners('notification:clicked'),
  onNotificationFallback:makeOn('notification:fallback'),
  offNotificationFallback:() => ipcRenderer.removeAllListeners('notification:fallback'),

  // --- Controles de Ventana ---
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow:    () => ipcRenderer.send('close-window'),
};

contextBridge.exposeInMainWorld('api', Object.freeze(api));
