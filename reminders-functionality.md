# Reminders Functionality Documentation

This document duplicates all the code and functionality related to reminders in the Electron Notes app, including design, forms, and functionality. The original code remains intact in the main files.

## Overview
The reminders feature allows users to create, view, and manage reminders with system notifications. It includes:
- A modal form for creating reminders
- Display in a dedicated "Recordatorios" view
- Backend scheduling of system notifications
- Frontend management and UI interactions

## HTML Structure (from index.html)

```html
<!-- Reminder Modal -->
<div id="reminder-modal" class="modal">
  <div class="modal-content">
    <span class="close-btn" id="reminder-cancel">&times;</span>
    <h2>Crear Recordatorio</h2>
    <form id="reminder-form">
      <div class="form-group">
        <label for="reminder-title">Título:</label>
        <input type="text" id="reminder-title" required>
      </div>
      <div class="form-group">
        <label for="reminder-description">Descripción:</label>
        <textarea id="reminder-description"></textarea>
      </div>
      <div class="form-group">
        <label for="reminder-datetime">Fecha y Hora:</label>
        <input type="datetime-local" id="reminder-datetime" required>
      </div>
      <button type="button" id="reminder-save" class="btn-primary">Guardar Recordatorio</button>
    </form>
  </div>
</div>

<!-- Navigation Button -->
<button id="reminders-nav" class="nav-btn">
  <span class="material-symbols-outlined">notifications</span>
  <span>Recordatorios</span>
</button>

<!-- Create Reminder Button (shown in reminders view) -->
<button id="create-reminder-btn" class="floating-btn">
  <span class="material-symbols-outlined">add</span>
</button>
```

## CSS Styles (from styles.css)

```css
/* Reminder Modal Styles */
#reminder-modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

#reminder-modal .modal-content {
  background-color: var(--bg-dark);
  margin: 15% auto;
  padding: 20px;
  border: 1px solid var(--border-color);
  width: 80%;
  max-width: 500px;
  border-radius: 8px;
  color: var(--text-color);
}

#reminder-modal .close-btn {
  color: var(--text-secondary);
  float: right;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
}

#reminder-modal .close-btn:hover {
  color: var(--text-color);
}

#reminder-modal .form-group {
  margin-bottom: 15px;
}

#reminder-modal label {
  display: block;
  margin-bottom: 5px;
  color: var(--text-color);
}

#reminder-modal input,
#reminder-modal textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-light);
  color: var(--text-color);
}

#reminder-modal textarea {
  height: 100px;
  resize: vertical;
}

#reminder-modal .btn-primary {
  background-color: var(--primary-color);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

#reminder-modal .btn-primary:hover {
  background-color: var(--primary-hover);
}

/* Floating Reminder Button */
#create-reminder-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

#create-reminder-btn:hover {
  background-color: var(--primary-hover);
}

#create-reminder-btn .material-symbols-outlined {
  font-size: 24px;
}

/* Reminder-specific styles */
.float-reminder {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
  background-color: var(--bg-light);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.float-reminder input[type="datetime-local"] {
  background: var(--bg-light);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 8px;
  border-radius: 4px;
}

.float-reminder button {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
}

.float-reminder button:hover {
  opacity: 1;
  background-color: var(--primary-hover);
}
```

## Backend Logic (from main.js)

```javascript
// --- Variables Globales ---
let reminders = {};
let notificationTimeouts = new Map();

// --- Funciones de Persistencia ---
function loadNotes() {
    // ... (existing code)
    reminders = parsed.reminders || {};
    // ... (rest of function)
}

function saveNotes() {
    // ... (existing code)
    const data = { notes, trashNotes, reminders };
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    // ... (rest of function)
}

// --- Funciones de Notificaciones ---
function scheduleNotification({ id, when, title, body, icon }) {
    console.log('Main: Programando notificacion:', { id, when, title, body });

    const now = Date.now();
    const due = new Date(when).getTime();

    if (isNaN(due)) {
        console.error('Main: Fecha invalida para notificacion:', when);
        throw new Error('Fecha invalida');
    }

    const delay = Math.max(0, due - now);
    console.log('Main: Delay calculado:', delay, 'ms');

    const t = setTimeout(() => {
        console.log('Main: Disparando notificacion:', title);

        const notification = new Notification({
            title,
            body,
            icon,
            silent: false,
            urgency: 'normal'
        });

        notification.on('click', () => {
            console.log('Main: Notificación clickeada:', id);
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                mainWindow.webContents.send('notification:clicked', { id });
            }
        });

        notification.on('show', () => {
            console.log('Main: Notificación mostrada exitosamente:', title);
        });

        notification.on('error', (error) => {
            console.error('Main: Error al mostrar notificacion:', error);
        });

        try {
            notification.show();
            notificationTimeouts.delete(id);
            console.log('Main: Notificación mostrada y timeout removido');
        } catch (error) {
            console.error('Main: Error al mostrar notificación:', error);
            if (mainWindow) {
                mainWindow.webContents.send('notification:fallback', { id, title, body });
            }
        }
    }, delay);

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

// --- Lógica Principal ---
function main() {
    // ... (existing code)
    
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

    // IPC Handlers
    ipcMain.handle('get-reminders', () => reminders);
    
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
            cancelNotification(reminderId);
            delete reminders[reminderId];
            saveNotes();
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('reminder-deleted', reminderId));
        }
    });
    
    // ... (rest of main function)
}
```

## Frontend Logic (from renderer.js)

```javascript
// ------- Estados -------
let reminders = {};

// ------- Utilidades -------
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

// ------- Renderizado -------
function createNoteRow(item) {
    // ... (existing code for other views)
    
    if (currentView === 'reminders') {
        const deleteBtn = createActionButton('delete', 'Eliminar Recordatorio', 'text-red-400', 'hover:bg-red-500/10', () => deleteReminder(item.id));
        actionsDiv.append(deleteBtn);
    }
    
    // ... (rest of function)
}

function renderNotesList(filteredNotes = null) {
    // ... (existing code)
    
    if (currentView === 'reminders') {
        notesToRender = filteredNotes || Object.values(reminders);
        ensureDrawingHeaderColumn(false);
    }
    
    const sorted = notesToRender.slice().sort((a, b) => {
        if (currentView === 'reminders') {
            return new Date(a.reminderTime) - new Date(b.reminderTime);
        }
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    // ... (rest of function)
}

// ------- CRUD -------
async function loadInitialNotes() {
    // ... (existing code)
    reminders = await window.api.getReminders();
    renderNotesList();
}

function deleteReminder(reminderId) {
    if (!reminderId) return;
    delete reminders[reminderId];
    window.api.deleteReminder(reminderId);
    renderNotesList();
}

// ------- Eventos UI -------
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

// ------- Navegación -------
remindersNav?.addEventListener('click', () => {
    currentView = 'reminders';
    if (mainTitle) mainTitle.textContent = 'Recordatorios';
    toggleNavActive(remindersNav, allNotesNav, trashNav, drawingNav);
    emptyTrashFloatingBtn?.classList.add('hidden');
    startRecordingBtn?.classList.add('hidden');
    updateCreateButtonsVisibility();
    renderNotesList();
});

// ------- IPC -------
window.api.onReminderUpdated((reminder) => {
    reminders[reminder.id] = reminder;
    renderNotesList();
});

window.api.onReminderDeleted((reminderId) => {
    delete reminders[reminderId];
    renderNotesList();
});

// ------- Atajos de teclado -------
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            createReminderBtn?.click();
        }
    }
});
```

## API Expositions (from preload.js)

```javascript
// --- API de Recordatorios ---
getReminders:    () => ipcRenderer.invoke('get-reminders'),
saveReminder:    (reminder) => ipcRenderer.send('save-reminder', reminder),
deleteReminder:  (reminderId) => ipcRenderer.send('delete-reminder', reminderId),

onReminderUpdated:     makeOn('reminder-updated'),
onceReminderUpdated:   makeOnce('reminder-updated'),
offReminderUpdated:    () => ipcRenderer.removeAllListeners('reminder-updated'),

onReminderDeleted:     makeOn('reminder-deleted'),
onceReminderDeleted:   makeOnce('reminder-deleted'),
offReminderDeleted:    () => ipcRenderer.removeAllListeners('reminder-deleted'),
```

## Functionality Summary
- **Creating Reminders**: Users can create reminders via a modal form with title, description, and datetime.
- **Viewing Reminders**: Reminders are displayed in a dedicated view, sorted by time.
- **Notifications**: System notifications are scheduled and triggered at the specified time.
- **Management**: Users can delete reminders, which also cancels their notifications.
- **Integration**: Reminders are persisted in JSON and synchronized across app restarts.
