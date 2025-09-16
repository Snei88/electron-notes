document.addEventListener('DOMContentLoaded', () => {
    const noteId = window.location.hash.substring(1);

    const container = document.getElementById('float-note-container');
    const titleEl = document.querySelector('.float-title');
    const contentEl = document.getElementById('float-content');
    const pinBtn = document.getElementById('float-pin-btn');
    const collapseBtn = document.getElementById('float-collapse-btn');
    const minBtn = document.getElementById('float-min-btn');
    const closeBtn = document.getElementById('float-close-btn');
    const deleteBtn = document.getElementById('float-delete-btn');

    let currentNote = null;
    let debounceTimer;

    // Helper functions to save and restore cursor position in contenteditable
    function saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            return {
                startContainer: range.startContainer,
                startOffset: range.startOffset,
                endContainer: range.endContainer,
                endOffset: range.endOffset
            };
        }
        return null;
    }

    function restoreSelection(savedSelection) {
        if (!savedSelection) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        const range = document.createRange();
        try {
            range.setStart(savedSelection.startContainer, savedSelection.startOffset);
            range.setEnd(savedSelection.endContainer, savedSelection.endOffset);
            selection.addRange(range);
        } catch (e) {
            // If the saved selection is invalid (e.g., content changed), ignore
        }
    }

    function getContrastColor(hexColor) {
        if (!hexColor) return '#FFFFFF';
        if (hexColor.startsWith('#')) {
            hexColor = hexColor.slice(1);
        }
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    // Cambiar color de la nota con botones predefinidos
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
        const color = btn.getAttribute('data-color');
        btn.style.backgroundColor = color;
        btn.addEventListener('click', () => {
            if (!currentNote) return;
            currentNote.styles.backgroundColor = color;
            container.style.backgroundColor = color;
            window.api.saveNote(currentNote);
        });
    });

    // Toggle toolbar
    const toolbarToggle = document.getElementById('toolbar-toggle');
    const toolbarEl = document.querySelector('.float-toolbar');
    toolbarToggle.addEventListener('click', () => {
        toolbarEl.classList.toggle('collapsed');
        toolbarToggle.textContent = toolbarEl.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
    });

    window.api.onNoteDeleted(deletedId => {
        if (deletedId === noteId) {
            window.close();
        }
    });

    // --- Keyboard shortcuts ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            window.api.floatWindowAction('close', noteId);
        }
    });

    function renderNote(note) {
        if (!note) return;

        currentNote = note;

        // Set title
        titleEl.textContent = note.title || 'Nueva Nota';

        // Set content, preserving cursor if possible
        const newContent = note.content || '';
        if (contentEl.innerHTML !== newContent) {
            const savedSelection = saveSelection();
            contentEl.innerHTML = newContent;
            restoreSelection(savedSelection);
        }

        // Set styles
        if (note.styles) {
            container.style.backgroundColor = note.styles.backgroundColor || '#2c2c2c';
            contentEl.style.fontFamily = note.styles.fontFamily || 'Arial, sans-serif';
            contentEl.style.fontSize = note.styles.fontSize ? `${note.styles.fontSize}px` : '16px';
            contentEl.style.color = note.styles.textColor || '#ffffff';
        }

        // Update pin button state
        if (note.isPinned) {
            pinBtn.classList.add('pinned');
        } else {
            pinBtn.classList.remove('pinned');
        }

        // Render audio files if any
        const audioPlayerSection = document.getElementById('audio-player-section');
        const audioFilesList = document.getElementById('audio-files-list');

        // Ensure audioFiles array exists and has valid audio files
        if (note.audioFiles && Array.isArray(note.audioFiles) && note.audioFiles.length > 0 && note.audioFiles.some(audio => audio.fileName && audio.filePath)) {
            console.log('Mostrando sección de audio para nota:', note.id, 'con', note.audioFiles.length, 'archivos válidos');
            audioFilesList.innerHTML = '';

            note.audioFiles.forEach((audio, index) => {
                // Solo procesar archivos que tengan fileName y filePath válidos
                if (audio.fileName && audio.filePath) {
                    console.log('Procesando archivo de audio:', index, audio.fileName);
                    const audioContainer = document.createElement('div');
                    audioContainer.classList.add('audio-file-container');

                    const audioElement = document.createElement('audio');
                    audioElement.controls = true;
                    audioElement.src = `file://${audio.filePath}`;
                    audioElement.preload = 'metadata';

                    const label = document.createElement('span');
                    label.textContent = `Grabado: ${new Date(audio.recordedAt).toLocaleString()}`;

                    audioContainer.appendChild(audioElement);
                    audioContainer.appendChild(label);
                    audioFilesList.appendChild(audioContainer);
                }
            });
            audioPlayerSection.classList.remove('hidden');
        } else {
            console.log('Ocultando sección de audio para nota:', note.id, '- sin archivos de audio válidos');
            audioPlayerSection.classList.add('hidden');
            audioFilesList.innerHTML = '';
        }
    }

    // --- Event Listeners ---

    // Title editing
    titleEl.addEventListener('input', () => {
        if (!currentNote) return;
        currentNote.title = titleEl.textContent;
        debouncedSave();
    });

    // Content editing
    contentEl.addEventListener('input', () => {
        if (!currentNote) return;
        currentNote.content = contentEl.innerHTML;
        debouncedSave();
    });

    // Toolbar buttons
    document.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.getAttribute('data-cmd');
            document.execCommand(cmd, false, null);
            contentEl.focus();
        });
    });

    // Font name selector
    const fontNameSelect = document.getElementById('font-name');
    if (fontNameSelect) {
        fontNameSelect.addEventListener('change', () => {
            document.execCommand('fontName', false, fontNameSelect.value);
            contentEl.focus();
        });
    }

    // Font size selector
    const fontSizeSelect = document.getElementById('font-size');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => {
            document.execCommand('fontSize', false, fontSizeSelect.value);
            contentEl.focus();
        });
    }

    // Block format selector
    const blockFormatSelect = document.getElementById('block-format');
    if (blockFormatSelect) {
        blockFormatSelect.addEventListener('change', () => {
            document.execCommand('formatBlock', false, blockFormatSelect.value);
            contentEl.focus();
        });
    }

    // Text color picker
    const colorTextInput = document.getElementById('color-text');
    if (colorTextInput) {
        colorTextInput.addEventListener('input', () => {
            document.execCommand('foreColor', false, colorTextInput.value);
            contentEl.focus();
        });
    }

    // Image insertion
    const btnImage = document.getElementById('btn-image');
    const imageInput = document.getElementById('image-input');
    if (btnImage && imageInput) {
        btnImage.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    document.execCommand('insertImage', false, reader.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Title bar buttons
    pinBtn.addEventListener('click', () => {
        window.api.floatWindowAction('toggle-pin', noteId);
    });

    collapseBtn.addEventListener('click', () => {
        container.classList.toggle('collapsed');
    });

    minBtn.addEventListener('click', () => {
        window.api.floatWindowAction('minimize', noteId);
    });

    closeBtn.addEventListener('click', () => {
        window.api.floatWindowAction('close', noteId);
    });

    deleteBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
            window.api.deleteNote(noteId);
        }
    });

    // Debounced save function
    function debouncedSave() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (currentNote) {
                window.api.saveNote(currentNote);
            }
        }, 500);
    }

    // --- IPC Listeners ---
    window.api.onNoteUpdated(note => {
        if (note.id === noteId) {
            renderNote(note);
        }
    });

    // --- Initialization ---
    async function initialize() {
        const note = await window.api.getNoteData(noteId);

        // Fix: If audioFiles is undefined or empty, explicitly set to empty array to avoid rendering
        if (!note.audioFiles || !Array.isArray(note.audioFiles)) {
            note.audioFiles = [];
        }

        renderNote(note);
        window.api.preventClose(); // Inform main process to handle close logic
    }

    initialize();
});
