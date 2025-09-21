document.addEventListener('DOMContentLoaded', () => {
  const noteId = window.location.hash.substring(1);

  const container   = document.getElementById('float-note-container');
  const titleEl     = document.querySelector('.float-title');
  const contentEl   = document.getElementById('float-content');
  const pinBtn      = document.getElementById('float-pin-btn');
  const collapseBtn = document.getElementById('float-collapse-btn');
  const minBtn      = document.getElementById('float-min-btn');
  const closeBtn    = document.getElementById('float-close-btn');
  const deleteBtn   = document.getElementById('float-delete-btn');

  const toolbarToggle = document.getElementById('toolbar-toggle');
  const toolbarEl     = document.querySelector('.float-toolbar');

  const audioPlayerSection = document.getElementById('audio-player-section');
  const audioFilesList     = document.getElementById('audio-files-list');

  const colorButtons = document.querySelectorAll('.color-btn');
  const fontNameSelect   = document.getElementById('font-name');
  const fontSizeSelect   = document.getElementById('font-size');
  const blockFormatSelect= document.getElementById('block-format');
  const colorTextInput   = document.getElementById('color-text');
  const colorHiliteInput = document.getElementById('color-hilite');
  const btnImage         = document.getElementById('btn-image');
  const imageInput       = document.getElementById('image-input');

  let currentNote = null;
  let debounceTimer;

  // ---------- Sanitizador sencillo (whitelist) ----------
  const ALLOWED = {
    a: ['href','title','target','rel'],
    b: [], strong: [], i: [], em: [], u: [], s: [],
    p: [], h1: [], h2: [], h3: [], blockquote: [], pre: [], code: [],
    ul: [], ol: [], li: [],
    br: [], hr: [],
    img: ['src','alt','title']
  };

  function sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    const isAllowedUrl = (attr, val) => {
      if (attr === 'href') {
        return /^(https?:|mailto:|#)/i.test(val);
      }
      if (attr === 'src') {
        return /^(data:image\/(png|jpeg|jpg|gif|webp);base64,|file:\/\/)/i.test(val);
      }
      return true;
    };

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const tag = el.tagName?.toLowerCase();
      if (!ALLOWED.hasOwnProperty(tag)) {
        toRemove.push(el);
        continue;
      }
      // Limpia atributos no permitidos y on* handlers
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (name.startsWith('on')) { el.removeAttribute(attr.name); return; }
        if (!ALLOWED[tag].includes(name)) { el.removeAttribute(attr.name); return; }
        if (!isAllowedUrl(name, value)) { el.removeAttribute(attr.name); return; }
        // endurece enlaces
        if (tag === 'a' && name === 'href') {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }
    toRemove.forEach(n => n.remove());
    return template.innerHTML;
  }

  // ---------- Selección (básica) ----------
  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset
    };
  }
  function restoreSelection(saved) {
    if (!saved) return;
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.setStart(saved.startContainer, saved.startOffset);
      range.setEnd(saved.endContainer, saved.endOffset);
      sel.addRange(range);
    } catch { /* puede fallar si cambió el DOM */ }
  }

  // ---------- UI Helpers ----------
  function setToolbarExpanded(expanded) {
    if (!toolbarEl || !toolbarToggle) return;
    toolbarEl.classList.toggle('collapsed', !expanded);
    toolbarToggle.textContent = expanded ? 'expand_less' : 'expand_more';
    toolbarToggle.setAttribute('aria-expanded', String(expanded));
  }

  function setPinnedUI(isPinned) {
    if (!pinBtn) return;
    pinBtn.classList.toggle('active', !!isPinned);
    pinBtn.setAttribute('aria-pressed', String(!!isPinned));
  }

  function encodeFileUrl(p) {
    // Best-effort para rutas con espacios y backslashes
    if (!p) return '';
    let normalized = p.replace(/\\/g, '/');      // Windows backslashes -> slashes
    return 'file://' + encodeURI(normalized);    // encodeURI deja los ':' intactos
  }

  // ---------- Render principal ----------
  function renderNote(note) {
    if (!note || !container || !titleEl || !contentEl) return;

    currentNote = note;

    // Título
    titleEl.textContent = note.title || 'Nueva Nota';

    // Contenido (preserva selección si solo refrescamos)
    const newContent = note.content || '';
    if (contentEl.innerHTML !== newContent) {
      const sel = saveSelection();
      contentEl.innerHTML = newContent;
      restoreSelection(sel);
    }

    // Estilos de la nota
    const st = note.styles || {};
    container.style.backgroundColor = st.backgroundColor || '#2c2c2c';
    contentEl.style.fontFamily      = st.fontFamily || 'Arial, sans-serif';
    contentEl.style.fontSize        = st.fontSize ? `${st.fontSize}px` : '16px';
    contentEl.style.color           = st.textColor || '#ffffff';

    // Fijada
    setPinnedUI(!!note.isPinned);

    // Audio
    if (!audioPlayerSection || !audioFilesList) return;
    audioFilesList.innerHTML = '';
    const validAudios = Array.isArray(note.audioFiles)
      ? note.audioFiles.filter(a => a && a.fileName && a.filePath)
      : [];
    if (validAudios.length) {
      validAudios.forEach((audio) => {
        const item = document.createElement('div');
        item.className = 'audio-file-container';

        const audioEl = document.createElement('audio');
        audioEl.controls = true;
        audioEl.preload  = 'metadata';
        audioEl.src      = encodeFileUrl(audio.filePath);

        const label = document.createElement('span');
        const dt = audio.recordedAt ? new Date(audio.recordedAt) : null;
        label.textContent = `Grabado: ${dt ? dt.toLocaleString('es-CO') : '—'}`;

        item.appendChild(audioEl);
        item.appendChild(label);
        audioFilesList.appendChild(item);
      });
      audioPlayerSection.classList.remove('hidden');
      audioPlayerSection.setAttribute('aria-hidden', 'false');
    } else {
      audioPlayerSection.classList.add('hidden');
      audioPlayerSection.setAttribute('aria-hidden', 'true');
    }
  }

  // ---------- Eventos de edición ----------
  titleEl?.addEventListener('input', () => {
    if (!currentNote) return;
    currentNote.title = (titleEl.textContent || '').trim();
    debouncedSave();
  });

  contentEl?.addEventListener('input', () => {
    if (!currentNote) return;
    // sanea lo que se guarda
    const clean = sanitizeHTML(contentEl.innerHTML);
    if (clean !== contentEl.innerHTML) contentEl.innerHTML = clean;
    currentNote.content = clean;
    debouncedSave();
  });

  // Saneado en pegado (pasta limpia HTML/texto)
  contentEl?.addEventListener('paste', (e) => {
    if (!currentNote) return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const toInsert = html ? sanitizeHTML(html) : (text ? text.replace(/\n/g, '<br>') : '');
    document.execCommand('insertHTML', false, toInsert);
  });

  // Botones de toolbar (execCommand aún funciona en Chromium)
  document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      contentEl?.focus();
      // tras cambios, sincroniza contenido
      if (currentNote && contentEl) {
        currentNote.content = sanitizeHTML(contentEl.innerHTML);
        debouncedSave();
      }
    });
  });

  fontNameSelect?.addEventListener('change', () => {
    document.execCommand('fontName', false, fontNameSelect.value);
    contentEl?.focus();
  });

  fontSizeSelect?.addEventListener('change', () => {
    document.execCommand('fontSize', false, fontSizeSelect.value);
    contentEl?.focus();
  });

  blockFormatSelect?.addEventListener('change', () => {
    document.execCommand('formatBlock', false, blockFormatSelect.value);
    contentEl?.focus();
  });

  colorTextInput?.addEventListener('input', () => {
    document.execCommand('foreColor', false, colorTextInput.value);
    contentEl?.focus();
  });

  colorHiliteInput?.addEventListener('input', () => {
    // soporte en Chromium
    document.execCommand('hiliteColor', false, colorHiliteInput.value);
    contentEl?.focus();
  });

  btnImage && imageInput && btnImage.addEventListener('click', () => imageInput.click());
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        // insertamos dataURL saneado (insertImage ya valida MIME básico)
        document.execCommand('insertImage', false, reader.result);
        if (currentNote && contentEl) {
          currentNote.content = sanitizeHTML(contentEl.innerHTML);
          debouncedSave();
        }
      };
      reader.readAsDataURL(file);
    }
  });

  // Botones barra de título
  pinBtn?.addEventListener('click', () => {
    window.api.floatWindowAction('toggle-pin', noteId);
    // optimista
    setPinnedUI(!(currentNote?.isPinned));
  });

  collapseBtn?.addEventListener('click', () => {
    if (!container || !collapseBtn) return;
    const collapsed = container.classList.toggle('collapsed');
    collapseBtn.textContent = collapsed ? 'expand_more' : 'expand_less';
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  });

  minBtn?.addEventListener('click', () => window.api.floatWindowAction('minimize', noteId));
  closeBtn?.addEventListener('click', () => window.api.floatWindowAction('close', noteId));

  deleteBtn?.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      window.api.deleteNote(noteId);
    }
  });

  // Toggle de la toolbar
  toolbarToggle?.addEventListener('click', () => {
    const willExpand = toolbarEl?.classList.contains('collapsed');
    setToolbarExpanded(!!willExpand);
  });

  // Color de la nota (botones)
  colorButtons.forEach(btn => {
    const color = btn.getAttribute('data-color');
    if (color) btn.style.backgroundColor = color;
    btn.addEventListener('click', () => {
      if (!currentNote || !container) return;
      currentNote.styles = currentNote.styles || {};
      currentNote.styles.backgroundColor = color;
      container.style.backgroundColor = color;
      debouncedSave(); // guarda estilos también
    });
  });

  // ---------- Accesos directos ----------
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      window.api.floatWindowAction('close', noteId);
    }
  });

  // ---------- Guardado diferido ----------
  function debouncedSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!currentNote) return;
      // Sanea antes de persistir
      currentNote.title   = (currentNote.title || '').trim();
      currentNote.content = sanitizeHTML(currentNote.content || '');
      window.api.saveNote(currentNote);
    }, 400);
  }

  // ---------- IPC ----------
  const offNoteDeleted = window.api.onNoteDeleted((deletedId) => {
    if (deletedId === noteId) window.close();
  });

  const offNoteUpdated = window.api.onNoteUpdated((note) => {
    if (note.id === noteId) renderNote(note);
  });

  window.addEventListener('beforeunload', () => {
    offNoteDeleted?.();
    offNoteUpdated?.();
  });

  // ---------- Init ----------
  async function initialize() {
    if (!noteId) { alert('Nota no encontrada'); window.close(); return; }
    const note = await window.api.getNoteData(noteId);
    if (!note) { alert('No se pudo cargar la nota'); window.close(); return; }

    if (!Array.isArray(note.audioFiles)) note.audioFiles = [];
    renderNote(note);
    window.api.preventClose();

    // Estado inicial de toolbar (colapsada por defecto en tu HTML)
    setToolbarExpanded(false);
  }

  initialize();
});
