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
  let undoDebounceTimer;

  // Modal fallback for note renderer (if global showConfirm/showAlert not available)
  let modalSystem;
  function initNoteModalSystem() {
    if (typeof showConfirm === 'undefined' || typeof showAlert === 'undefined' || typeof showToast === 'undefined') {
      modalSystem = {
        showConfirm: (options) => {
          return new Promise((resolve) => {
            const confirmed = window.confirm(options?.message || '¿Continuar?');
            resolve(!!confirmed);
          });
        },
        showAlert: (options) => {
          return new Promise((resolve) => {
            window.alert(options?.message || '');
            resolve(true);
          });
        },
        showToast: (options) => { console.log('Toast:', options?.message || options?.title || ''); }
      };
      // create forwarding functions expected by other code
      window.showConfirm = (opts) => modalSystem.showConfirm(opts);
      window.showAlert = (opts) => modalSystem.showAlert(opts);
      window.showToast = (opts) => modalSystem.showToast(opts);
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const isContentFocused = document.activeElement === contentEl;
      const isTitleFocused = document.activeElement === titleEl;
      
      // Solo procesar si estamos en el editor
      if (!isContentFocused && !isTitleFocused) return;

      // Ctrl/Cmd + Z - Deshacer
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z - Rehacer
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + Y - Rehacer (alternativo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + B - Negrita
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
        updateContentAndSave();
        return;
      }

      // Ctrl/Cmd + I - Cursiva
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
        updateContentAndSave();
        return;
      }

      // Ctrl/Cmd + U - Subrayado
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
        updateContentAndSave();
        return;
      }

      // Ctrl/Cmd + K - Insertar enlace
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        insertLink();
        return;
      }

      // Ctrl/Cmd + L - Lista con viñetas
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertUnorderedList', false, null);
        updateContentAndSave();
        return;
      }

      // Ctrl/Cmd + Shift + L - Lista numerada
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertOrderedList', false, null);
        updateContentAndSave();
        return;
      }

      // Ctrl/Cmd + D - Duplicar línea o selección
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      // Ctrl/Cmd + / - Comentar/Descomentar
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleComment();
        return;
      }

      // Tab - Indentar (solo en contenido)
      if (e.key === 'Tab' && isContentFocused) {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand('outdent', false, null);
        } else {
          document.execCommand('indent', false, null);
        }
        updateContentAndSave();
        return;
      }

      // NOTE: Removed Ctrl/Cmd+Enter soft-break shortcut to ensure only plain Enter
      // inserts soft breaks. This avoids Alt/Ctrl/Cmd combinations producing
      // unexpected newlines.
    });
  }

  // Sistema de undo/redo personalizado
  let undoStack = [];
  let redoStack = [];
  let maxUndoSteps = 50;

  function saveStateToUndoStack() {
    if (!currentNote || !contentEl) return;
    
    const state = {
      content: contentEl.innerHTML,
      selection: saveSelection()
    };
    
    undoStack.push(state);
    if (undoStack.length > maxUndoSteps) {
      undoStack.shift();
    }
    
    // Limpiar redo stack cuando se hace una nueva acción
    redoStack = [];
    updateUndoRedoUI();
  }

  function handleUndo() {
    if (undoStack.length < 2) return; // Necesitamos al menos 2 estados
    
    const currentState = {
      content: contentEl.innerHTML,
      selection: saveSelection()
    };
    
    redoStack.push(currentState);
    
    const previousState = undoStack.pop();
    contentEl.innerHTML = previousState.content;
    restoreSelection(previousState.selection);
    
    currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
    updateUndoRedoUI();
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    
    const currentState = {
      content: contentEl.innerHTML,
      selection: saveSelection()
    };
    
    undoStack.push(currentState);
    
    const nextState = redoStack.pop();
    contentEl.innerHTML = nextState.content;
    restoreSelection(nextState.selection);
    
    currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
    updateUndoRedoUI();
  }

  function updateUndoRedoUI() {
    // Puedes actualizar el estado de botones undo/redo si los tienes en la UI
    const undoBtn = document.querySelector('[data-cmd="undo"]');
    const redoBtn = document.querySelector('[data-cmd="redo"]');
    
    if (undoBtn) {
      undoBtn.style.opacity = undoStack.length > 1 ? '1' : '0.5';
      undoBtn.disabled = undoStack.length <= 1;
    }
    
    if (redoBtn) {
      redoBtn.style.opacity = redoStack.length > 0 ? '1' : '0.5';
      redoBtn.disabled = redoStack.length === 0;
    }
  }

  function updateContentAndSave() {
    if (!currentNote || !contentEl) return;
    currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
  }

  function insertLink() {
    const url = prompt('Ingresa la URL:');
    if (url) {
      // Validar URL
      let finalUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
        finalUrl = 'https://' + url;
      }
      
      document.execCommand('createLink', false, finalUrl);
      
      // Asegurar que los enlaces tengan target="_blank"
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const selectedNode = selection.getRangeAt(0).startContainer.parentNode;
        if (selectedNode.nodeName === 'A') {
          selectedNode.setAttribute('target', '_blank');
          selectedNode.setAttribute('rel', 'noopener noreferrer');
        }
      }
      
      updateContentAndSave();
    }
  }

  function duplicateSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedContent = range.cloneContents();
    
    range.deleteContents();
    range.insertNode(selectedContent);
    
    updateContentAndSave();
  }

  function toggleComment() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (selectedText) {
      // Si hay texto seleccionado, comentarlo
      const isCommented = selectedText.startsWith('/*') && selectedText.endsWith('*/');
      
      if (isCommented) {
        // Descomentar
        const uncommentedText = selectedText.slice(2, -2);
        range.deleteContents();
        range.insertNode(document.createTextNode(uncommentedText));
      } else {
        // Comentar
        const commentedText = `/*${selectedText}*/`;
        range.deleteContents();
        range.insertNode(document.createTextNode(commentedText));
      }
      
      updateContentAndSave();
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  async function initTheme() {
    const s = await window.api.getSettings();
    applyTheme(s?.theme || 'dark');
  }

  window.api.onSettingsChanged((s) => applyTheme(s?.theme || 'dark'));

  // ---------- Sanitizador sencillo (whitelist) ----------
  const ALLOWED = {
    a: ['href','title','target','rel'],
    b: [], strong: [], i: [], em: [], u: [], s: [],
    p: [], h1: [], h2: [], h3: [], blockquote: [], pre: [], code: [],
    ul: [], ol: [], li: [],
    br: [], hr: [],
    img: ['src','alt','title']
  };

  // Allow spans with inline styles (but sanitized)
  ALLOWED.span = ['style'];

  function sanitizeStyle(value) {
    const safe = [];
    value.split(';').forEach(rule => {
      const [prop, rawVal] = rule.split(':').map(s => s && s.trim());
      if (!prop || !rawVal) return;
      const p = prop.toLowerCase();
      const v = rawVal.toLowerCase();
      
      // Permitir color y background-color con varios formatos
      const okColor = /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)|transparent|inherit|initial|unset)$/i.test(v);
      
      if ((p === 'color' || p === 'background-color') && okColor) {
        safe.push(`${p}:${v}`);
      }
      
      // Permitir text-decoration para tachado, subrayado, etc.
      if (p === 'text-decoration' || p === 'text-decoration-line') {
        const okDecoration = /^(none|underline|overline|line-through|inherit|initial|unset)$/i.test(v);
        if (okDecoration) {
          safe.push(`${p}:${v}`);
        }
      }
      
      // Permitir font-weight para negrita
      if (p === 'font-weight') {
        const okWeight = /^(normal|bold|bolder|lighter|[1-9]00|inherit|initial|unset)$/i.test(v);
        if (okWeight) {
          safe.push(`${p}:${v}`);
        }
      }
      
      // Permitir font-style para cursiva
      if (p === 'font-style') {
        const okStyle = /^(normal|italic|oblique|inherit|initial|unset)$/i.test(v);
        if (okStyle) {
          safe.push(`${p}:${v}`);
        }
      }
    });
    return safe.join('; ');
  }

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
        if (name === 'style' && el.tagName.toLowerCase() === 'span') {
          const cleaned = sanitizeStyle(value);
          if (cleaned) el.setAttribute('style', cleaned); else el.removeAttribute('style');
          return;
        }
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
  
  function insertSoftBreak(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    
    // Inserta <br> y posiciona el cursor después
    const br = document.createElement('br');
    range.insertNode(br);
    
    // Evita que el cursor quede "atascado" al final del nodo
    const spacer = document.createTextNode('');
    br.after(spacer);
    
    const newRange = document.createRange();
    newRange.setStartAfter(br);
    newRange.setEndAfter(br);
    sel.removeAllRanges();
    sel.addRange(newRange);
    
    // Desplaza scroll si hace falta
    el.scrollTop = el.scrollHeight;
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

    // Estilos de la nota - SOLO fondo
    const st = note.styles || {};
    container.style.backgroundColor = st.backgroundColor || '#2c2c2c';
    contentEl.style.fontFamily = st.fontFamily || 'Arial, sans-serif';
    contentEl.style.fontSize = st.fontSize ? `${st.fontSize}px` : '16px';
    
    // NO aplicar color de texto globalmente - se maneja inline
    // contentEl.style.color = st.textColor || '#ffffff';

  // Restaurar valores de inputs de color si existen
  if (colorTextInput) colorTextInput.value = st.textColor || '';
  if (colorHiliteInput) colorHiliteInput.value = st.hiliteColor || '';

    // Fijada
    setPinnedUI(!!note.isPinned);

  // Actualizar paletas/estado de colores según la nota
  loadCurrentColors();

    // Audio
    if (!audioPlayerSection || !audioFilesList) return;
    audioFilesList.innerHTML = '';

    const validAudios = Array.isArray(note.audioFiles)
      ? note.audioFiles.filter(a => a && a.fileName && a.filePath)
      : [];

    if (validAudios.length) {
      validAudios.forEach((audio, index) => {
        const audioPlayer = createCustomAudioPlayer(audio, index);
        audioFilesList.appendChild(audioPlayer);
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
    const saved = saveSelection();                 // ❶ guarda selección
    const clean = sanitizeHTML(contentEl.innerHTML);
    if (clean !== contentEl.innerHTML) {
      contentEl.innerHTML = clean;                 // ❷ reescribe solo si cambió
      restoreSelection(saved);                     // ❸ restaura selección
    }
    currentNote.content = clean;

    // Guardar estado para undo (con debounce para no saturar)
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = setTimeout(() => saveStateToUndoStack(), 500);

    debouncedSave();
  });

  // Saneado en pegado (pasta limpia HTML/texto)
    contentEl?.addEventListener('paste', (e) => {
    if (!currentNote || !contentEl) return;
     saveStateToUndoStack();

    const items = e.clipboardData?.items || [];
    let handledImage = false;

    // 1) Buscar imágenes en el clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handledImage = true;
        
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataURL = event.target.result;
          
          // Método más confiable para insertar la imagen
          insertImageAtCursor(dataURL);
          
          // Guardar después de insertar
          const clean = sanitizeHTML(contentEl.innerHTML);
          currentNote.content = clean;
          debouncedSave();
        };
        
        reader.onerror = (error) => {
          console.error('Error reading image:', error);
          showToast('Error al pegar la imagen', 'error');
        };
        
        reader.readAsDataURL(blob);
        break; // Solo manejar la primera imagen
      }
    }

    if (handledImage) return;

    // 2) Si no hay imágenes, procesar HTML/texto normal
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    
    let toInsert = '';
    
    if (html) {
      toInsert = sanitizeHTML(html);
    } else if (text) {
      toInsert = text.replace(/\n/g, '<br>');
    }
    
    if (toInsert) {
      // Usar insertHTML para texto/HTML
      document.execCommand('insertHTML', false, toInsert);
      
      const clean = sanitizeHTML(contentEl.innerHTML);
      if (clean !== contentEl.innerHTML) {
        contentEl.innerHTML = clean;
      }
      currentNote.content = clean;
      debouncedSave();
    }
  });

  // Manejo de Enter en el editor: usar solo Enter para insertar soft break (no requiere Ctrl/Cmd ni Shift)
  contentEl?.addEventListener('keydown', (e) => {
    // Solo manejar Enter sin modificadores (no Ctrl/Meta/Alt/Shift)
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();

      // Guardar el color actual antes de insertar
      const currentColor = textColorState;

      // Intentar insertHTML (execCommand) que suele mantener estilos en Chromium
      try {
        const did = document.execCommand('insertHTML', false, '<br>');
        if (did) {
          // Si tenemos un color personalizado distinto del default, aplicarlo después del salto
          if (currentColor && currentColor !== '#ffffff') {
            setTimeout(() => {
              try { document.execCommand('styleWithCSS', true, null); } catch {}
              try { document.execCommand('foreColor', false, currentColor); } catch {}
              updateContentAndSave();
            }, 10);
          } else {
            updateContentAndSave();
          }
          return;
        }
      } catch (err) {
        // ignore and fallback to Range insertion
      }

      // Fallback: usar Range para insertar <br> y mantener la selección
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);

        // Mover el cursor después del br
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);

        // Si hay color de texto en estado futuro, aplicarlo al próximo fragmento
        if (currentColor && currentColor !== '#ffffff') {
          setTimeout(() => {
            try { document.execCommand('styleWithCSS', true, null); } catch {}
            try { document.execCommand('foreColor', false, currentColor); } catch {}
            updateContentAndSave();
          }, 10);
        } else {
          updateContentAndSave();
        }
      }
    }
  });

  // Función auxiliar para insertar imágenes en la posición del cursor
  function insertImageAtCursor(dataURL) {
    const selection = window.getSelection();
    
    if (!selection.rangeCount) {
      // Si no hay selección, insertar al final
      const img = document.createElement('img');
      img.src = dataURL;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      contentEl.appendChild(img);
      return;
    }

    const range = selection.getRangeAt(0);
    const img = document.createElement('img');
    img.src = dataURL;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    
    // Insertar la imagen
    range.insertNode(img);
    
    // Mover el cursor después de la imagen
    const newRange = document.createRange();
    newRange.setStartAfter(img);
    newRange.setEndAfter(img);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  // Botones de toolbar (execCommand aún funciona en Chromium)
  document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      
      // Guardar estado antes de aplicar comando
      saveStateToUndoStack();
      
      // Para strikeThrough y underline, usar métodos mejorados
      if (cmd === 'strikeThrough') {
        applyStrikeThrough();
      } else if (cmd === 'underline') {
        applyUnderline();
      } else {
        document.execCommand(cmd, false, null);
      }
      
      contentEl?.focus();
      
      // tras cambios, sincroniza contenido
      if (currentNote && contentEl) {
        currentNote.content = sanitizeHTML(contentEl.innerHTML);
        debouncedSave();
      }
    });
  });
  
  // Función mejorada para aplicar/quitar tachado
  function applyStrikeThrough() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (range.toString().length === 0) return;
    
    // Guardar posición de inicio y fin
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;
    
    // Obtener el contenedor común
    const commonAncestor = range.commonAncestorContainer;
    const parentElement = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;
    
    // Verificar si ya tiene tachado
    const hasStrike = checkIfHasDecoration(parentElement, 'line-through');
    
    if (hasStrike) {
      // Quitar tachado usando execCommand con styleWithCSS
      document.execCommand('styleWithCSS', false, true);
      
      // Crear un span temporal para remover el estilo
      const tempSpan = document.createElement('span');
      tempSpan.style.textDecoration = 'none';
      
      const fragment = range.extractContents();
      tempSpan.appendChild(fragment);
      range.insertNode(tempSpan);
      
      // Unwrap el span y limpiar decoraciones
      cleanDecorationFromElement(tempSpan, 'line-through');
      
    } else {
      // Aplicar tachado
      document.execCommand('styleWithCSS', false, true);
      
      const span = document.createElement('span');
      const existingDeco = getComputedStyle(parentElement).textDecoration || '';
      const decoList = existingDeco.split(' ').filter(d => d && d !== 'none' && d !== 'line-through');
      decoList.push('line-through');
      span.style.textDecoration = decoList.join(' ');
      
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    
    // Restaurar selección
    try {
      const newRange = document.createRange();
      newRange.setStart(startContainer, startOffset);
      newRange.setEnd(endContainer, endOffset);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch (e) {
      // Si falla, al menos mantener el foco
      contentEl?.focus();
    }
    
    updateContentAndSave();
  }
  
  // Función mejorada para aplicar/quitar subrayado
  function applyUnderline() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (range.toString().length === 0) return;
    
    // Guardar posición de inicio y fin
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;
    
    // Obtener el contenedor común
    const commonAncestor = range.commonAncestorContainer;
    const parentElement = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;
    
    // Verificar si ya tiene subrayado
    const hasUnderline = checkIfHasDecoration(parentElement, 'underline');
    
    if (hasUnderline) {
      // Quitar subrayado
      document.execCommand('styleWithCSS', false, true);
      
      const tempSpan = document.createElement('span');
      tempSpan.style.textDecoration = 'none';
      
      const fragment = range.extractContents();
      tempSpan.appendChild(fragment);
      range.insertNode(tempSpan);
      
      // Unwrap el span y limpiar decoraciones
      cleanDecorationFromElement(tempSpan, 'underline');
      
    } else {
      // Aplicar subrayado
      document.execCommand('styleWithCSS', false, true);
      
      const span = document.createElement('span');
      const existingDeco = getComputedStyle(parentElement).textDecoration || '';
      const decoList = existingDeco.split(' ').filter(d => d && d !== 'none' && d !== 'underline');
      decoList.push('underline');
      span.style.textDecoration = decoList.join(' ');
      
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    
    // Restaurar selección
    try {
      const newRange = document.createRange();
      newRange.setStart(startContainer, startOffset);
      newRange.setEnd(endContainer, endOffset);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch (e) {
      contentEl?.focus();
    }
    
    updateContentAndSave();
  }
  
  // Verificar si un elemento tiene una decoración específica
  function checkIfHasDecoration(element, decoration) {
    if (!element) return false;
    
    // Verificar el elemento actual
    const style = element.style.textDecoration || '';
    if (style.includes(decoration)) return true;
    
    // Verificar elementos específicos
    if (decoration === 'line-through' && (element.nodeName === 'S' || element.nodeName === 'STRIKE')) {
      return true;
    }
    if (decoration === 'underline' && element.nodeName === 'U') {
      return true;
    }
    
    // Verificar computed style
    const computed = getComputedStyle(element).textDecoration || '';
    return computed.includes(decoration);
  }
  
  // Limpiar decoración de un elemento y sus hijos
  function cleanDecorationFromElement(element, decoration) {
    // Procesar el elemento actual
    if (element.style && element.style.textDecoration) {
      const decorations = element.style.textDecoration.split(' ').filter(d => 
        d && d !== decoration && d !== 'none'
      );
      
      if (decorations.length > 0) {
        element.style.textDecoration = decorations.join(' ');
      } else {
        element.style.removeProperty('text-decoration');
      }
    }
    
    // Procesar hijos
    Array.from(element.children).forEach(child => {
      cleanDecorationFromElement(child, decoration);
    });
    
    // Si el elemento quedó sin estilos, unwrap
    if (!element.getAttribute('style') || element.getAttribute('style').trim() === '') {
      while (element.firstChild) {
        element.parentNode.insertBefore(element.firstChild, element);
      }
      element.remove();
    }
  }

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
    if (!contentEl) return;
    // applyTextColor legacy removed; use color system
    applyTextColorToSelection(colorTextInput.value);
  });


  colorHiliteInput?.addEventListener('input', () => {
    // soporte en Chromium
    applyHighlightColorToSelection(colorHiliteInput.value);
    contentEl?.focus();
  });
  // ===== SISTEMA DE COLORES MEJORADO =====
  // Comentamos/desactivamos inicializadores antiguos de paletas por compatibilidad
  /*
  document.querySelectorAll('#text-color-swatches .color-btn').forEach(btn=>{
    const c = btn.getAttribute('data-color');
    if (c) btn.style.backgroundColor = c;
    btn.addEventListener('click', ()=> applyTextColor(c));
  });

  document.querySelectorAll('#hilite-color-swatches .color-btn').forEach(btn=>{
    const c = btn.getAttribute('data-color');
    if (c) btn.style.backgroundColor = c;
    btn.addEventListener('click', ()=> applyHiliteColor(c));
  });
  */

  // Nuevo sistema de colores (implementación completa más abajo)

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
    // Ensure modal helpers are available
    initNoteModalSystem();
    showConfirm({
      title: 'Eliminar Nota',
      message: '¿Estás seguro de que quieres eliminar esta nota?',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    }).then((confirmed) => {
      if (confirmed) window.api.deleteNote(noteId);
    });
  });

  // Toggle de la toolbar
  toolbarToggle?.addEventListener('click', () => {
    const willExpand = toolbarEl?.classList.contains('collapsed');
    setToolbarExpanded(!!willExpand);
  });

  // Color de la nota (botones del grupo "Colores de nota")
  /* Nota: el inicializador antiguo de noteColorGroup queda comentado.
  const noteColorGroup = document.querySelector('.note-colors[aria-label="Colores de nota"]');
  if (noteColorGroup) {
    noteColorGroup.querySelectorAll('.color-btn').forEach(btn => {
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
  }
  */

  // ===== SISTEMA MEJORADO DE COLORES CON ESTADO PERSISTENTE =====

  // Estado de colores con persistencia
  let textColorState = '#ffffff';
  let highlightColorState = null;
  let backgroundColorState = '#2c2c2c';

  // Modo actual: 'selection' (aplicar a selección) o 'future' (aplicar a texto futuro)
  let colorApplicationMode = 'future';

  // Inicializar sistema de colores mejorado
  function initColorSystem() {
    setupColorPickers();
    loadCurrentColors();
    setupSelectionTracking();
    setupContentEvents();
  }

  // Configurar los color pickers con comportamiento mejorado
  function setupColorPickers() {
    // Background Color Picker - Siempre aplica a toda la nota
    const bgColorPicker = document.getElementById('background-color-picker');
    const resetBgColor = document.getElementById('reset-background-color');
    
    bgColorPicker?.addEventListener('input', (e) => {
      applyBackgroundColor(e.target.value);
    });
    
    resetBgColor?.addEventListener('click', () => {
      applyBackgroundColor('#2c2c2c');
      if (bgColorPicker) bgColorPicker.value = '#2c2c2c';
    });

    // Text Color Picker - Aplica a selección o texto futuro
    const textColorPicker = document.getElementById('text-color-picker');
    const resetTextColor = document.getElementById('reset-text-color');
    
    textColorPicker?.addEventListener('input', (e) => {
      textColorState = e.target.value;
      applyTextColor(textColorState);
    });
    
    resetTextColor?.addEventListener('click', () => {
      textColorState = '#ffffff';
      applyTextColor('default');
      if (textColorPicker) textColorPicker.value = '#ffffff';
    });

    // Highlight Color Picker - Aplica a selección o texto futuro
    const highlightColorPicker = document.getElementById('highlight-color-picker');
    const resetHighlightColor = document.getElementById('reset-highlight-color');
    
    highlightColorPicker?.addEventListener('input', (e) => {
      highlightColorState = e.target.value;
      applyHighlightColor(highlightColorState);
    });
    
    resetHighlightColor?.addEventListener('click', () => {
      highlightColorState = null;
      applyHighlightColor('default');
      if (highlightColorPicker) highlightColorPicker.value = '#ffff00';
    });
  }

  // Configurar seguimiento de selección
  function setupSelectionTracking() {
    contentEl?.addEventListener('mousedown', () => {
      // Cuando el usuario hace clic, cambiamos a modo selección
      colorApplicationMode = 'selection';
    });
    
    contentEl?.addEventListener('keydown', () => {
      // Cuando el usuario escribe, cambiamos a modo futuro
      colorApplicationMode = 'future';
    });
    
    // Actualizar modo basado en la selección actual
    contentEl?.addEventListener('mouseup', updateColorApplicationMode);
    contentEl?.addEventListener('keyup', updateColorApplicationMode);
  }

  // Actualizar modo de aplicación de color
  function updateColorApplicationMode() {
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;
    
    colorApplicationMode = hasSelection ? 'selection' : 'future';
    
    // Actualizar UI para mostrar el modo actual
    updateColorModeIndicator();
  }

  // Actualizar indicador visual del modo
  function updateColorModeIndicator() {
    const labels = document.querySelectorAll('.color-label');
    labels.forEach(label => {
      const indicator = label.querySelector('.color-mode-indicator') || createColorModeIndicator();
      if (!label.contains(indicator)) {
        label.appendChild(indicator);
      }
      
      indicator.textContent = colorApplicationMode === 'selection' ? ' (selección)' : ' (futuro)';
      indicator.className = `color-mode-indicator ${colorApplicationMode}`;
    });
  }

  // Crear indicador de modo
  function createColorModeIndicator() {
    const indicator = document.createElement('span');
    indicator.className = 'color-mode-indicator';
    indicator.style.fontSize = '0.7em';
    indicator.style.opacity = '0.7';
    indicator.style.marginLeft = '4px';
    return indicator;
  }

  // Configurar eventos del contenido
  function setupContentEvents() {
    // Aplicar color automáticamente al escribir si estamos en modo futuro
    contentEl?.addEventListener('input', (e) => {
      if (colorApplicationMode === 'future' && textColorState !== '#ffffff') {
        // El color ya se aplica automáticamente gracias a execCommand
        // Solo necesitamos asegurarnos de que el estado sea correcto
        updateLastTextNodeColor();
      }
    });
  }

  // Aplicar color de texto (selección o futuro)
  function applyTextColor(color) {
    if (!contentEl) return;
    
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;
    
    document.execCommand('styleWithCSS', true, null);
    
    if (color === 'default') {
      if (hasSelection) {
        document.execCommand('removeFormat', false, null);
      } else {
        // Para texto futuro, establecemos el color por defecto
        textColorState = '#ffffff';
        updateColorPicker('text-color-picker', '#ffffff');
      }
    } else {
      if (hasSelection || colorApplicationMode === 'selection') {
        // Aplicar a selección actual
        document.execCommand('foreColor', false, color);
      } else {
        // Establecer para texto futuro
        document.execCommand('foreColor', false, color);
        textColorState = color;
      }
    }
    
    contentEl.focus();
    saveContent();
  }

  // Aplicar color de resaltado (selección o futuro)
  function applyHighlightColor(color) {
    if (!contentEl) return;
    
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;
    
    document.execCommand('styleWithCSS', true, null);
    
    if (color === 'default') {
      if (hasSelection) {
        document.execCommand('removeFormat', false, null);
      }
      highlightColorState = null;
    } else {
      if (hasSelection || colorApplicationMode === 'selection') {
        // Aplicar a selección actual
        document.execCommand('hiliteColor', false, color);
      } else {
        // Establecer para texto futuro - necesitamos un enfoque diferente
        // ya que hiliteColor no funciona sin selección
        highlightColorState = color;
        // Mostrar mensaje al usuario
        showColorTooltip('El resaltado se aplicará al próximo texto que selecciones');
      }
    }
    
    contentEl.focus();
    saveContent();
  }

  // Aplicar color de fondo
  function applyBackgroundColor(color) {
    if (!currentNote || !container) return;
    
    currentNote.styles = currentNote.styles || {};
    currentNote.styles.backgroundColor = color;
    backgroundColorState = color;
    
    container.style.backgroundColor = color;
    saveContent();
  }

  // Actualizar el color del último nodo de texto (para modo futuro)
  function updateLastTextNodeColor() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    
    // Encontrar el nodo de texto más cercano
    while (node && node.nodeType !== 3) {
      node = node.lastChild;
    }
    
    if (node && textColorState !== '#ffffff') {
      // Aplicar color al nodo de texto
      const span = document.createElement('span');
      span.style.color = textColorState;
      span.textContent = node.textContent;
      
      node.parentNode.replaceChild(span, node);
      saveContent();
    }
  }

  // Mostrar tooltip temporal
  function showColorTooltip(message) {
    const tooltip = document.createElement('div');
    tooltip.textContent = message;
    tooltip.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-medium);
      color: var(--text-light);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.875rem;
      z-index: 10000;
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(tooltip);
    
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }, 2000);
  }

  // Guardar contenido con debounce
  function saveContent() {
    if (currentNote && contentEl) {
      currentNote.content = sanitizeHTML(contentEl.innerHTML);
      debouncedSave();
    }
  }

  // Cargar colores actuales
  function loadCurrentColors() {
    if (!currentNote) return;
    
    const styles = currentNote.styles || {};
    
    // Color de fondo
    backgroundColorState = styles.backgroundColor || '#2c2c2c';
    updateColorPicker('background-color-picker', backgroundColorState);
    
    // Color de texto
    textColorState = styles.textColor || '#ffffff';
    updateColorPicker('text-color-picker', textColorState);
    
    // Aplicar color de fondo
    if (container) {
      container.style.backgroundColor = backgroundColorState;
    }
    
    // Inicializar modo de aplicación
    updateColorApplicationMode();
  }

  // Actualizar valor del color picker
  function updateColorPicker(pickerId, color) {
    const picker = document.getElementById(pickerId);
    if (picker && color) {
      picker.value = color;
    }
  }

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

  // ----------------- Reproductor de audio personalizado -----------------
  function createCustomAudioPlayer(audioFile, index) {
    const container = document.createElement('div');
    container.className = 'audio-file-container';
    container.dataset.audioIndex = index;

    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'audio-player-wrapper';

    // Información del audio
    const audioInfo = document.createElement('div');
    audioInfo.className = 'audio-info';
    
    const metadata = document.createElement('div');
    metadata.className = 'audio-metadata';
    
    const title = document.createElement('div');
    title.className = 'audio-title';
    title.textContent = `Grabación ${index + 1}`;
    
    const details = document.createElement('div');
    details.className = 'audio-details';
    
    const dateInfo = document.createElement('div');
    dateInfo.className = 'audio-detail';
    dateInfo.innerHTML = `
      <span class="material-symbols-outlined">schedule</span>
      <span>${audioFile.recordedAt ? new Date(audioFile.recordedAt).toLocaleString('es-CO') : 'Fecha desconocida'}</span>
    `;
    
    const sizeInfo = document.createElement('div');
    sizeInfo.className = 'audio-detail';
    sizeInfo.innerHTML = `
      <span class="material-symbols-outlined">storage</span>
      <span>${audioFile.fileSize || 'Tamaño desconocido'}</span>
    `;
    
    details.appendChild(dateInfo);
    if (audioFile.fileSize) details.appendChild(sizeInfo);
    
    metadata.appendChild(title);
    metadata.appendChild(details);
    audioInfo.appendChild(metadata);
    
    // Reproductor personalizado
    const player = document.createElement('div');
    player.className = 'audio-player';
    
    const customPlayer = document.createElement('div');
    customPlayer.className = 'custom-audio-player';
    
    // Controles de reproducción
    const controls = document.createElement('div');
    controls.className = 'player-controls';
    
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'play-pause-btn';
    playPauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    playPauseBtn.title = 'Reproducir';
    
    // Barra de progreso
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = '0%';
    
    const currentTime = document.createElement('div');
    currentTime.className = 'progress-time';
    currentTime.textContent = '0:00';
    
    const duration = document.createElement('div');
    duration.className = 'progress-time';
    duration.textContent = '0:00';
    
    progressBar.appendChild(progressFill);
    progressContainer.appendChild(currentTime);
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(duration);
    
    // Control de volumen
    const volumeControl = document.createElement('div');
    volumeControl.className = 'volume-control';
    
    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'volume-btn';
    volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
    volumeBtn.title = 'Volumen';
    
    const volumeSlider = document.createElement('div');
    volumeSlider.className = 'volume-slider';
    
    const volumeLevel = document.createElement('div');
    volumeLevel.className = 'volume-level';
    volumeLevel.style.width = '80%';
    
    volumeSlider.appendChild(volumeLevel);
    volumeControl.appendChild(volumeBtn);
    volumeControl.appendChild(volumeSlider);
    
    // Acciones
    const actions = document.createElement('div');
    actions.className = 'player-actions';
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = '<span class="material-symbols-outlined">download</span>';
    downloadBtn.title = 'Descargar audio';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-audio-btn';
    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    deleteBtn.title = 'Eliminar audio';
    
    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);
    
    // Ensamblar
    controls.appendChild(playPauseBtn);
    customPlayer.appendChild(controls);
    customPlayer.appendChild(progressContainer);
    customPlayer.appendChild(volumeControl);
    customPlayer.appendChild(actions);
    player.appendChild(customPlayer);
    
    playerWrapper.appendChild(audioInfo);
    playerWrapper.appendChild(player);
    container.appendChild(playerWrapper);
    
    // Elemento de audio real (oculto)
    const audioEl = document.createElement('audio');
    audioEl.preload = 'metadata';
    audioEl.src = encodeFileUrl(audioFile.filePath);
    container.appendChild(audioEl);
    
    // Estado del reproductor
    let isPlaying = false;
    let isDragging = false;
    
    // Funciones de utilidad
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function updateProgress() {
      if (!audioEl.duration) return;
      
      const percent = (audioEl.currentTime / audioEl.duration) * 100;
      progressFill.style.width = `${percent}%`;
      currentTime.textContent = formatTime(audioEl.currentTime);
    }
    
    function updateDuration() {
      if (audioEl.duration && isFinite(audioEl.duration)) {
        duration.textContent = formatTime(audioEl.duration);
      }
    }
    
    // Event Listeners
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        audioEl.pause();
      } else {
        audioEl.play().catch(error => {
          console.error('Error al reproducir audio:', error);
          showAudioError('No se pudo reproducir el audio');
        });
      }
    });
    
    audioEl.addEventListener('play', () => {
      isPlaying = true;
      player.classList.add('playing');
      playPauseBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
      playPauseBtn.title = 'Pausar';
    });
    
    audioEl.addEventListener('pause', () => {
      isPlaying = false;
      player.classList.remove('playing');
      playPauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      playPauseBtn.title = 'Reproducir';
    });
    
    audioEl.addEventListener('timeupdate', updateProgress);
    audioEl.addEventListener('loadedmetadata', updateDuration);
    audioEl.addEventListener('ended', () => {
      isPlaying = false;
      player.classList.remove('playing');
      playPauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      audioEl.currentTime = 0;
      updateProgress();
    });
    
    // Click en barra de progreso para buscar
    progressBar.addEventListener('click', (e) => {
      if (!audioEl.duration) return;
      
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = percent * audioEl.duration;
    });
    
    // Control de volumen
    volumeSlider.addEventListener('click', (e) => {
      const rect = volumeSlider.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const volume = Math.max(0, Math.min(1, percent));
      
      audioEl.volume = volume;
      volumeLevel.style.width = `${volume * 100}%`;
      
      // Actualizar icono de volumen
      let volumeIcon = 'volume_up';
      if (volume === 0) volumeIcon = 'volume_off';
      else if (volume < 0.5) volumeIcon = 'volume_down';
      
      volumeBtn.innerHTML = `<span class="material-symbols-outlined">${volumeIcon}</span>`;
    });
    
    volumeBtn.addEventListener('click', () => {
      if (audioEl.volume > 0) {
        audioEl.volume = 0;
        volumeLevel.style.width = '0%';
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
      } else {
        audioEl.volume = 0.8;
        volumeLevel.style.width = '80%';
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
      }
    });
    
    // Descargar audio
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadAudio(audioFile);
    });
    
    // Eliminar audio
    deleteBtn.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres eliminar esta grabación de audio?')) {
        deleteAudio(container, audioFile, index);
      }
    });
    
    // Manejo de errores
    audioEl.addEventListener('error', (e) => {
      console.error('Error de audio:', e);
      showAudioError('Error al cargar el archivo de audio');
    });
    
    return container;
  }

  function downloadAudio(audioFile) {
    try {
      const link = document.createElement('a');
      link.href = encodeFileUrl(audioFile.filePath);
      link.download = `grabacion-audio-${new Date(audioFile.recordedAt).toISOString().split('T')[0]}.webm`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Descargando audio...', 'success');
    } catch (error) {
      console.error('Error al descargar audio:', error);
      showToast('Error al descargar el audio', 'error');
    }
  }

  function deleteAudio(container, audioFile, index) {
    if (!currentNote || !Array.isArray(currentNote.audioFiles)) return;
    
    // Remover del array
    currentNote.audioFiles.splice(index, 1);
    
    // Actualizar UI
    container.style.opacity = '0.5';
    container.style.transform = 'translateX(-100%)';
    
    setTimeout(() => {
      container.remove();
      
      // Si no quedan audios, ocultar la sección
      const audioFilesList = document.getElementById('audio-files-list');
      if (audioFilesList && audioFilesList.children.length === 0) {
        const audioPlayerSection = document.getElementById('audio-player-section');
        if (audioPlayerSection) {
          audioPlayerSection.classList.add('hidden');
          audioPlayerSection.setAttribute('aria-hidden', 'true');
        }
      }
      
      // Guardar cambios
      debouncedSave();
      
      showToast('Audio eliminado', 'success');
    }, 300);
  }

  function showAudioError(message) {
    const toast = document.createElement('div');
    toast.className = 'audio-error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  function showToast(message, type = 'info') {
    // Buscar toast existente o crear uno nuevo
    let toast = document.getElementById('audio-toast');
    
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'audio-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 10000;
        max-width: 300px;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.backgroundColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
    }, 3000);
  }

  // ------- Dibujo: Guardado robusto (evita duplicados y maneja timeouts) -------
  let isSavingDrawing = false;

  async function saveDrawing() {
    // Asegurarnos de que el canvas y el modal existan en este contexto
    if (typeof drawingCanvas === 'undefined' || !drawingCanvas) {
      console.log('⚠️ saveDrawing: canvas no disponible en este contexto');
      return;
    }

    if (isSavingDrawing) {
      console.log('⏳ Guardado de dibujo ya en progreso, ignorando nueva petición');
      return;
    }

    isSavingDrawing = true;

    try {
      const dataURL = drawingCanvas.toDataURL('image/png');
      const title = 'Dibujo ' + new Date().toLocaleString('es-CO');

      console.log('💾 Iniciando guardado de dibujo...');

      // Deshabilitar temporalmente el botón de guardar si existe
      const saveBtn = document.getElementById('drawing-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>';
      }

      const targetNoteId = (currentNote && currentNote.id) ? currentNote.id : (typeof noteId !== 'undefined' ? noteId : null);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout en guardado de dibujo'));
        }, 5000);

        // Llamada al main para iniciar el guardado
        window.api.saveDrawing({ dataURL, noteId: targetNoteId, title });

        // Handlers que se registran y se eliminarán al resolverse/rechazar
        const successHandler = (note) => {
          clearTimeout(timeout);
          // offX son funciones de unsubscribe que onDrawingSaved/onDrawingSaveError devuelven
          if (typeof offSuccess === 'function') offSuccess();
          if (typeof offError === 'function') offError();
          resolve(note);
        };

        const errorHandler = (error) => {
          clearTimeout(timeout);
          if (typeof offSuccess === 'function') offSuccess();
          if (typeof offError === 'function') offError();
          reject(error);
        };

        // Registrar listeners (onX devuelve una función para desuscribir en este código base)
        let offSuccess = null;
        let offError = null;
        try {
          offSuccess = window.api.onDrawingSaved(successHandler);
          offError = window.api.onDrawingSaveError(errorHandler);
        } catch (e) {
          // Si la API expone add/remove en lugar de on/return, tratamos de manejarlo con el patrón alternativo
          window.api.onDrawingSaved && window.api.onDrawingSaved(successHandler);
          window.api.onDrawingSaveError && window.api.onDrawingSaveError(errorHandler);
          offSuccess = null;
          offError = null;
        }
      });

      console.log('✅ Dibujo guardado exitosamente');

      // Cerrar modal y limpiar estado
      if (typeof drawingModal !== 'undefined' && drawingModal) {
        drawingModal.classList.add('hidden');
      }
      // Si existiera currentDrawingNoteId lo limpiamos, en este contexto usamos currentNote
      if (typeof currentDrawingNoteId !== 'undefined') currentDrawingNoteId = null;

    } catch (error) {
      console.error('❌ Error al guardar dibujo:', error);
      try { showToast('Error al guardar el dibujo: ' + (error?.message || error), 'error'); } catch (e) { console.error(e); }
    } finally {
      isSavingDrawing = false;
      const saveBtn = document.getElementById('drawing-save-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span>';
      }
    }
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
    await initTheme();
    initNoteModalSystem();
    
    if (!noteId) { 
      await showAlert({ 
        title: 'Error', 
        message: 'Nota no encontrada', 
        type: 'error' 
      }); 
      window.close(); 
      return; 
    }
    
    const note = await window.api.getNoteData(noteId);
    if (!note) { 
      await showAlert({ 
        title: 'Error', 
        message: 'No se pudo cargar la nota', 
        type: 'error' 
      }); 
      window.close(); 
      return; 
    }

    if (!Array.isArray(note.audioFiles)) note.audioFiles = [];
    renderNote(note);
    window.api.preventClose();

    // Estado inicial de toolbar
    setToolbarExpanded(false);
    
    // Inicializar sistema de atajos
    setupKeyboardShortcuts();

    // Inicializar sistema de colores
    initColorSystem();
    
    // Guardar estado inicial en el undo stack
    saveStateToUndoStack();
  }

  initialize();
});