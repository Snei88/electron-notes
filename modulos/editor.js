const path = require('path');
const { elements, state, api } = require(path.join(__dirname, 'context.js'));
const { sanitizeHTML, sanitizeStyle } = require(path.join(__dirname, 'sanitizer.js'));

function createEditor() {
  const services = {};

  function setModalSystem(modal) {
    state.modalSystem = modal;
  }

  function getModalSystem() {
    return state.modalSystem;
  }

  function initNoteModalSystem() {
    if (typeof window.showConfirm === 'function' && typeof window.showAlert === 'function' && typeof window.showToast === 'function') {
      return;
    }

    const modalSystem = {
      showConfirm: (options) => new Promise((resolve) => {
        const confirmed = window.confirm(options?.message || '¿Continuar?');
        resolve(!!confirmed);
      }),
      showAlert: (options) => new Promise((resolve) => {
        window.alert(options?.message || '');
        resolve(true);
      }),
      showToast: (options) => {
        console.log('Toast:', options?.message || options?.title || '');
      },
    };

    setModalSystem(modalSystem);
    window.showConfirm = (opts) => modalSystem.showConfirm(opts);
    window.showAlert = (opts) => modalSystem.showAlert(opts);
    window.showToast = (opts) => modalSystem.showToast(opts);
  }

  function showConfirm(options) {
    if (typeof window.showConfirm === 'function') {
      return window.showConfirm(options);
    }
    const modal = getModalSystem();
    return modal?.showConfirm(options) || Promise.resolve(false);
  }

  function showAlert(options) {
    if (typeof window.showAlert === 'function') {
      return window.showAlert(options);
    }
    const modal = getModalSystem();
    return modal?.showAlert(options) || Promise.resolve();
  }

  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast({ message, type });
      return;
    }
    const modal = getModalSystem();
    modal?.showToast({ message, type });
  }

  function setupKeyboardShortcuts() {
    const { contentEl, titleEl } = elements;

    document.addEventListener('keydown', (e) => {
      const isContentFocused = document.activeElement === contentEl;
      const isTitleFocused = document.activeElement === titleEl;
      if (!isContentFocused && !isTitleFocused) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
        updateContentAndSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
        updateContentAndSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        saveStateToUndoStack();
        toggleUnderline();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        insertLink();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertUnorderedList', false, null);
        updateContentAndSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertOrderedList', false, null);
        updateContentAndSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleComment();
        return;
      }

      if (e.key === 'Tab' && isContentFocused) {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand('outdent', false, null);
        } else {
          document.execCommand('indent', false, null);
        }
        updateContentAndSave();
      }
    });
  }

  function saveStateToUndoStack() {
    const { contentEl } = elements;
    if (!state.currentNote || !contentEl) return;

    const snapshot = {
      content: contentEl.innerHTML,
      selection: saveSelection(),
    };

    state.undoStack.push(snapshot);
    if (state.undoStack.length > state.maxUndoSteps) {
      state.undoStack.shift();
    }

    state.redoStack = [];
    updateUndoRedoUI();
  }

  function handleUndo() {
    const { contentEl } = elements;
    if (!contentEl || state.undoStack.length < 2) return;

    const current = {
      content: contentEl.innerHTML,
      selection: saveSelection(),
    };
    state.redoStack.push(current);

    const previous = state.undoStack.pop();
    contentEl.innerHTML = previous.content;
    restoreSelection(previous.selection);

    state.currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
    updateUndoRedoUI();
    resetToFloatingMode();
    refreshDecorationButtonStates();
  }

  function handleRedo() {
    const { contentEl } = elements;
    if (!contentEl || state.redoStack.length === 0) return;

    const current = {
      content: contentEl.innerHTML,
      selection: saveSelection(),
    };
    state.undoStack.push(current);

    const next = state.redoStack.pop();
    contentEl.innerHTML = next.content;
    restoreSelection(next.selection);

    state.currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
    updateUndoRedoUI();
    refreshDecorationButtonStates();
  }

  function updateUndoRedoUI() {
    const undoBtn = document.querySelector('[data-cmd="undo"]');
    const redoBtn = document.querySelector('[data-cmd="redo"]');

    if (undoBtn) {
      undoBtn.style.opacity = state.undoStack.length > 1 ? '1' : '0.5';
      undoBtn.disabled = state.undoStack.length <= 1;
    }

    if (redoBtn) {
      redoBtn.style.opacity = state.redoStack.length > 0 ? '1' : '0.5';
      redoBtn.disabled = state.redoStack.length === 0;
    }
  }

  function updateContentAndSave() {
    const { contentEl } = elements;
    if (!state.currentNote || !contentEl) return;
    state.currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
  }

  function insertLink() {
    const url = window.prompt('Ingresa la URL:');
    if (!url) return;

    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      finalUrl = `https://${url}`;
    }

    document.execCommand('createLink', false, finalUrl);

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

  function duplicateSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    range.deleteContents();
    range.insertNode(fragment);

    updateContentAndSave();
  }

  function toggleComment() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;

    const isCommented = selectedText.startsWith('/*') && selectedText.endsWith('*/');
    if (isCommented) {
      const cleaned = selectedText.slice(2, -2);
      range.deleteContents();
      range.insertNode(document.createTextNode(cleaned));
    } else {
      const commented = `/*${selectedText}*/`;
      range.deleteContents();
      range.insertNode(document.createTextNode(commented));
    }

    updateContentAndSave();
  }

  function collapseSelectionToEnd(selection) {
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function moveCaretOutOfDecoration(decoration) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      if (range.startOffset === node.length) {
        node = node.parentNode;
      } else {
        return;
      }
    }

    const { contentEl } = elements;

    while (node && node !== contentEl) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const style = (node.style?.textDecoration || '').toLowerCase();
        const styleLine = (node.style?.textDecorationLine || '').toLowerCase();
        const computed = (window.getComputedStyle(node).textDecorationLine || '').toLowerCase();
        const match = decoration === 'underline'
          ? style.includes('underline') || styleLine.includes('underline') || computed.includes('underline')
          : style.includes('line-through') || styleLine.includes('line-through') || computed.includes('line-through');

        if (match && node.parentNode) {
          const newRange = document.createRange();
          newRange.setStartAfter(node);
          newRange.setEndAfter(node);
          selection.removeAllRanges();
          selection.addRange(newRange);
          return;
        }
      }
      node = node.parentNode;
    }
  }

  function syncNoteContentAfterFormat() {
    const { contentEl } = elements;
    if (!state.currentNote || !contentEl) return;
    state.currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
  }

  function nodeHasDecoration(node, type) {
    const { contentEl } = elements;
    if (!node) return false;
    let current = node;
    while (current && current !== contentEl) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const tag = current.tagName;
        if (type === 'underline' && (tag === 'U' || tag === 'INS')) return true;
        if (type === 'strike' && (tag === 'S' || tag === 'DEL' || tag === 'STRIKE')) return true;

        const inlineStyle = (current.style?.textDecoration || '').toLowerCase();
        const inlineLine = (current.style?.textDecorationLine || '').toLowerCase();
        const computedStyle = (window.getComputedStyle(current).textDecorationLine || '').toLowerCase();

        if (type === 'underline' && (inlineStyle.includes('underline') || inlineLine.includes('underline') || computedStyle.includes('underline'))) {
          return true;
        }
        if (type === 'strike' && (inlineStyle.includes('line-through') || inlineLine.includes('line-through') || computedStyle.includes('line-through'))) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  }

  function getNodeBeforeCaret(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    let container = range.startContainer;
    let offset = range.startOffset;

    if (container.nodeType === Node.TEXT_NODE) {
      if (offset > 0) {
        return container;
      }
      const parent = container.parentNode;
      offset = Array.prototype.indexOf.call(parent.childNodes, container);
      container = parent;
    }

    if (!container || container.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    if (offset === 0) {
      return null;
    }

    return container.childNodes[offset - 1] || null;
  }

  function getDecorationStyleConfig(type) {
    if (type === 'underline') {
      return {
        style: state.underlineStyle,
        thickness: state.underlineThickness,
      };
    }
    return {
      style: state.strikeStyle,
      thickness: state.strikeThickness,
    };
  }

  function applyDecorationStyleToElement(element, type) {
    const { contentEl } = elements;
    if (!element || !contentEl.contains(element)) return;

    const { style, thickness } = getDecorationStyleConfig(type);

    const lines = new Set();
    const computed = (window.getComputedStyle(element).textDecorationLine || '').split(/\s+/).filter(Boolean);
    computed.forEach((line) => lines.add(line));
    const inlineLines = (element.style.textDecorationLine || '').split(/\s+/).filter(Boolean);
    inlineLines.forEach((line) => lines.add(line));

    if (type === 'underline') lines.add('underline');
    if (type === 'strike') lines.add('line-through');

    element.style.textDecorationLine = Array.from(lines).join(' ');

    if (!style || style === 'solid') {
      element.style.removeProperty('text-decoration-style');
    } else {
      element.style.textDecorationStyle = style;
    }

    if (!thickness || thickness === 'auto') {
      element.style.removeProperty('text-decoration-thickness');
    } else {
      element.style.textDecorationThickness = thickness;
    }
  }

  function applyDecorationStyleToSelection(type) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const { contentEl } = elements;

    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!contentEl.contains(node)) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_SKIP;
          return nodeHasDecoration(node, type) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      },
    );

    const seen = new Set();
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (seen.has(el)) continue;
      applyDecorationStyleToElement(el, type);
      seen.add(el);
    }

    const startEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
    const endEl = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer;
    [startEl, endEl].forEach((el) => {
      if (el && contentEl.contains(el) && nodeHasDecoration(el, type)) {
        applyDecorationStyleToElement(el, type);
      }
    });
  }

  function getElementForDecorationAtCaret(selection, type) {
    let node = getNodeBeforeCaret(selection);
    const { contentEl } = elements;

    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    if (node && contentEl.contains(node) && nodeHasDecoration(node, type)) {
      return node;
    }

    let focus = selection.focusNode;
    if (focus && focus.nodeType === Node.TEXT_NODE) {
      focus = focus.parentNode;
    }
    if (focus && contentEl.contains(focus) && nodeHasDecoration(focus, type)) {
      return focus;
    }

    return null;
  }

  function findDecorationElementInRange(range, type) {
    const { contentEl } = elements;
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!contentEl.contains(node)) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_SKIP;
          return nodeHasDecoration(node, type) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      },
    );

    while (walker.nextNode()) {
      return walker.currentNode;
    }
    return null;
  }

  function normalizeDecorationStyle(value) {
    if (!value) return null;
    const lower = value.toLowerCase();
    const allowed = ['solid', 'double', 'dotted', 'dashed', 'wavy'];
    return allowed.includes(lower) ? lower : null;
  }

  function normalizeDecorationThickness(value) {
    if (!value) return null;
    const lower = value.toLowerCase();
    if (lower === 'auto' || lower === 'from-font') return 'auto';
    const allowed = ['1px', '2px', '3px', '4px'];
    return allowed.includes(lower) ? lower : null;
  }

  function updateDecorationSelectUI(type, element) {
    if (!element) return;
    const computed = window.getComputedStyle(element);
    const styleValue = normalizeDecorationStyle(computed.textDecorationStyle);
    const thicknessValue = normalizeDecorationThickness(computed.textDecorationThickness);

    if (type === 'underline') {
      if (styleValue && elements.underlineStyleSelect) {
        elements.underlineStyleSelect.value = styleValue;
        state.underlineStyle = styleValue;
      }
      if (thicknessValue && elements.underlineThicknessSelect) {
        elements.underlineThicknessSelect.value = thicknessValue;
        state.underlineThickness = thicknessValue;
      } else if (elements.underlineThicknessSelect) {
        elements.underlineThicknessSelect.value = 'auto';
        state.underlineThickness = 'auto';
      }
    } else {
      if (styleValue && elements.strikeStyleSelect) {
        elements.strikeStyleSelect.value = styleValue;
        state.strikeStyle = styleValue;
      }
      if (thicknessValue && elements.strikeThicknessSelect) {
        elements.strikeThicknessSelect.value = thicknessValue;
        state.strikeThickness = thicknessValue;
      } else if (elements.strikeThicknessSelect) {
        elements.strikeThicknessSelect.value = 'auto';
        state.strikeThickness = 'auto';
      }
    }
  }

  function applyDecorationStyleAtCaret(type) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const target = getElementForDecorationAtCaret(selection, type);
    if (target) {
      applyDecorationStyleToElement(target, type);
    }
  }

  function handleDecorationStyleChange(type) {
    if (!state.currentNote) return;
    const selection = window.getSelection();
    const decorator = type === 'underline' ? 'underline' : 'strike';
    const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed && selectionHasDecoration(decorator);

    if (hasSelection) {
      applyDecorationStyleToSelection(type);
    } else {
      applyDecorationStyleAtCaret(type);
    }

    syncNoteContentAfterFormat();
    refreshDecorationButtonStates();
  }

  function selectionHasDecoration(type) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    if (type === 'underline' && document.queryCommandState('underline')) return true;
    if (type === 'strike' && document.queryCommandState('strikeThrough')) return true;

    const focusNode = selection.focusNode?.nodeType === Node.TEXT_NODE
      ? selection.focusNode.parentNode
      : selection.focusNode;
    const anchorNode = selection.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentNode
      : selection.anchorNode;

    return nodeHasDecoration(focusNode, type) || nodeHasDecoration(anchorNode, type);
  }

  function setDecorationButtonState(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', !!active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function refreshDecorationButtonStates() {
    const selection = window.getSelection();
    const collapsed = !selection || selection.rangeCount === 0 || selection.isCollapsed;

    let underlineActive = collapsed ? state.underlineModeActive : selectionHasDecoration('underline');
    let strikeActive = collapsed ? state.strikeModeActive : selectionHasDecoration('strike');

    if (collapsed) {
      const caretUnderline = document.queryCommandState('underline');
      const caretStrike = document.queryCommandState('strikeThrough');

      state.underlineModeActive = caretUnderline;
      state.strikeModeActive = caretStrike;

      const underlineElement = getElementForDecorationAtCaret(selection, 'underline');
      const strikeElement = getElementForDecorationAtCaret(selection, 'strike');

      underlineActive = caretUnderline || !!underlineElement;
      strikeActive = caretStrike || !!strikeElement;

      if (underlineElement) {
        updateDecorationSelectUI('underline', underlineElement);
      }
      if (strikeElement) {
        updateDecorationSelectUI('strike', strikeElement);
      }
    } else if (selection) {
      const range = selection.getRangeAt(0);
      if (underlineActive) {
        const el = findDecorationElementInRange(range, 'underline');
        if (el) {
          updateDecorationSelectUI('underline', el);
        }
      }
      if (strikeActive) {
        const el = findDecorationElementInRange(range, 'strike');
        if (el) {
          updateDecorationSelectUI('strike', el);
        }
      }
    }

    setDecorationButtonState(elements.underlineBtn, underlineActive);
    setDecorationButtonState(elements.strikeBtn, strikeActive);
  }

  function toggleUnderline() {
    const { contentEl } = elements;
    if (!contentEl) return;

    document.execCommand('styleWithCSS', true, null);
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;

    document.execCommand('underline', false, null);
    const isActiveNow = document.queryCommandState('underline');

    if (hasSelection) {
      if (isActiveNow) {
        applyDecorationStyleToSelection('underline');
        selection.collapseToEnd();
        moveCaretOutOfDecoration('underline');
      } else {
        selection.collapseToEnd();
      }
      state.underlineModeActive = false;
    } else {
      state.underlineModeActive = isActiveNow;
      if (isActiveNow) {
        applyDecorationStyleAtCaret('underline');
      }
    }

    syncNoteContentAfterFormat();
    refreshDecorationButtonStates();
  }

  function toggleStrikeThrough() {
    const { contentEl } = elements;
    if (!contentEl) return;

    document.execCommand('styleWithCSS', true, null);
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;

    document.execCommand('strikeThrough', false, null);
    const isActiveNow = document.queryCommandState('strikeThrough');

    if (hasSelection) {
      if (isActiveNow) {
        applyDecorationStyleToSelection('strike');
        selection.collapseToEnd();
        moveCaretOutOfDecoration('line-through');
      } else {
        selection.collapseToEnd();
      }
      state.strikeModeActive = false;
    } else {
      state.strikeModeActive = isActiveNow;
      if (isActiveNow) {
        applyDecorationStyleAtCaret('strike');
      }
    }

    syncNoteContentAfterFormat();
    refreshDecorationButtonStates();
  }

  function resetDecorationModesForNewLine() {
    let changed = false;

    if (state.underlineModeActive) {
      if (document.queryCommandState('underline')) {
        document.execCommand('underline', false, null);
      }
      state.underlineModeActive = false;
      changed = true;
    }

    if (state.strikeModeActive) {
      if (document.queryCommandState('strikeThrough')) {
        document.execCommand('strikeThrough', false, null);
      }
      state.strikeModeActive = false;
      changed = true;
    }

    if (changed) {
      refreshDecorationButtonStates();
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  async function initTheme() {
    console.log('🎨 initTheme - Iniciando...');
    console.log('🔍 api.getSettings existe?', typeof api.getSettings);
    try {
      if (typeof api.getSettings === 'function') {
        console.log('✅ Llamando a api.getSettings()...');
        const settings = await api.getSettings();
        console.log('📦 Settings recibidos:', settings);
        applyTheme(settings?.theme || 'dark');
      } else {
        console.warn('⚠️ api.getSettings no está disponible, usando tema por defecto');
        console.log('🔍 api keys disponibles:', Object.keys(api));
        applyTheme('dark');
      }
    } catch (error) {
      console.error('❌ Error al cargar tema:', error);
      applyTheme('dark');
    }
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

  function renderNote(note) {
    const {
      container,
      titleEl,
      contentEl,
      audioPlayerSection,
      audioFilesList,
      underlineStyleSelect,
      underlineThicknessSelect,
      strikeStyleSelect,
      strikeThicknessSelect,
      colorTextInput,
      colorHiliteInput,
    } = elements;

    if (!note || !container || !titleEl || !contentEl) return;

    state.currentNote = note;

    titleEl.textContent = note.title || 'Nueva Nota';

    const emptyLinesContent = '<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>';
    const newContent = note.content || emptyLinesContent;
    if (contentEl.innerHTML !== newContent) {
      const sel = saveSelection();
      contentEl.innerHTML = newContent;
      restoreSelection(sel);
    }

    const styles = note.styles || {};
    container.style.backgroundColor = styles.backgroundColor || '#2c2c2c';
    contentEl.style.fontFamily = styles.fontFamily || 'Arial, sans-serif';
    contentEl.style.fontSize = styles.fontSize ? `${styles.fontSize}px` : '16px';

    if (colorTextInput) colorTextInput.value = styles.textColor || '';
    if (colorHiliteInput) colorHiliteInput.value = styles.hiliteColor || '';

    setPinnedUI(!!note.isPinned);
    loadCurrentColors();

    if (!audioPlayerSection || !audioFilesList) return;
    audioFilesList.innerHTML = '';

    const validAudios = Array.isArray(note.audioFiles)
      ? note.audioFiles.filter((a) => a && a.fileName && a.filePath)
      : [];

    if (validAudios.length) {
      validAudios.forEach((audio, index) => {
        const audioPlayer = services.createAudioPlayer?.(audio, index);
        if (audioPlayer) {
          audioFilesList.appendChild(audioPlayer);
        }
      });

      audioPlayerSection.classList.remove('hidden');
      audioPlayerSection.setAttribute('aria-hidden', 'false');
    } else {
      audioPlayerSection.classList.add('hidden');
      audioPlayerSection.setAttribute('aria-hidden', 'true');
    }

    if (underlineStyleSelect) underlineStyleSelect.value = state.underlineStyle;
    if (underlineThicknessSelect) underlineThicknessSelect.value = state.underlineThickness;
    if (strikeStyleSelect) strikeStyleSelect.value = state.strikeStyle;
    if (strikeThicknessSelect) strikeThicknessSelect.value = state.strikeThickness;

    refreshDecorationButtonStates();
  }

  function resetToFloatingMode() {
    const { container, toolbarEl, toolbarToggle } = elements;
    if (!container) return;
    container.classList.remove('word-mode');
    document.body.classList.remove('word-mode-active');
    if (toolbarEl) {
      toolbarEl.classList.add('collapsed');
      if (toolbarToggle) toolbarToggle.textContent = 'expand_more';
    }
  }

    function setPinnedUI(isPinned) {
    const { pinBtn } = elements;
    if (!pinBtn) return;
    pinBtn.classList.toggle('active', !!isPinned);
    pinBtn.setAttribute('aria-pressed', String(!!isPinned));
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset,
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
    } catch (error) {
      console.warn('No se pudo restaurar la selección', error);
    }
  }

  function debouncedSave() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      if (!state.currentNote) return;
      state.currentNote.title = (state.currentNote.title || '').trim();
      state.currentNote.content = sanitizeHTML(state.currentNote.content || '');
      api.saveNote(state.currentNote);
    }, 400);
  }

  function saveContent() {
    const { contentEl } = elements;
    if (!state.currentNote || !contentEl) return;
    state.currentNote.content = sanitizeHTML(contentEl.innerHTML);
    debouncedSave();
  }

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

  function updateColorPicker(id, color) {
    if (!color) return;
    const picker = document.getElementById(id);
    if (picker) picker.value = color;
  }

  function loadCurrentColors() {
    if (!state.currentNote) return;
    const styles = state.currentNote.styles || {};
    state.backgroundColorState = styles.backgroundColor || '#2c2c2c';
    state.textColorState = styles.textColor || '#ffffff';

    updateColorPicker('background-color-picker', state.backgroundColorState);
    updateColorPicker('text-color-picker', state.textColorState);

    const { container } = elements;
    if (container) {
      container.style.backgroundColor = state.backgroundColorState;
    }

    updateColorApplicationMode();
  }

  function updateColorApplicationMode() {
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    state.colorApplicationMode = hasSelection ? 'selection' : 'future';
    updateColorModeIndicator();
  }

  function createColorModeIndicator() {
    const indicator = document.createElement('span');
    indicator.className = 'color-mode-indicator';
    indicator.style.fontSize = '0.7em';
    indicator.style.opacity = '0.7';
    indicator.style.marginLeft = '4px';
    return indicator;
  }

  function updateColorModeIndicator() {
    document.querySelectorAll('.color-label').forEach((label) => {
      const indicator = label.querySelector('.color-mode-indicator') || createColorModeIndicator();
      if (!label.contains(indicator)) {
        label.appendChild(indicator);
      }
      indicator.textContent = state.colorApplicationMode === 'selection' ? ' (selección)' : ' (futuro)';
      indicator.className = `color-mode-indicator ${state.colorApplicationMode}`;
    });
  }

  function setToolbarExpanded(expanded) {
    const { toolbarEl, toolbarToggle, container } = elements;
    if (!toolbarEl || !toolbarToggle) return;
    
    toolbarEl.classList.toggle('collapsed', !expanded);
    toolbarToggle.textContent = expanded ? 'expand_less' : 'expand_more';
    toolbarToggle.setAttribute('aria-expanded', String(expanded));
    
    // Modo expandido tipo Word
    if (expanded) {
      // Guardar tamaño original si no existe
      if (!container.dataset.originalWidth) {
        const currentBounds = require('electron').remote?.getCurrentWindow()?.getBounds();
        if (currentBounds) {
          container.dataset.originalWidth = currentBounds.width;
          container.dataset.originalHeight = currentBounds.height;
        }
      }
      
      // Expandir ventana
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('expand-note-window', state.noteId);
      } catch (e) {
        console.warn('No se pudo expandir ventana:', e);
      }
      
      container.classList.add('word-mode');
    } else {
      // Restaurar tamaño original
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('restore-note-window', state.noteId);
      } catch (e) {
        console.warn('No se pudo restaurar ventana:', e);
      }
      
      container.classList.remove('word-mode');
    }
  }

  function applyBackgroundColor(color) {
    const { container } = elements;
    if (!state.currentNote || !container) return;
    state.currentNote.styles = state.currentNote.styles || {};
    state.currentNote.styles.backgroundColor = color;
    state.backgroundColorState = color;
    container.style.backgroundColor = color;
    saveContent();
  }

  function applyTextColor(color) {
    const { contentEl } = elements;
    if (!contentEl) return;

    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    document.execCommand('styleWithCSS', true, null);

    if (color === 'default') {
      if (hasSelection) {
        document.execCommand('removeFormat', false, null);
      } else {
        state.textColorState = '#ffffff';
        updateColorPicker('text-color-picker', '#ffffff');
      }
    } else {
      if (hasSelection || state.colorApplicationMode === 'selection') {
        document.execCommand('foreColor', false, color);
      } else {
        document.execCommand('foreColor', false, color);
        state.textColorState = color;
      }
    }

    contentEl.focus();
    saveContent();
  }

  function applyHighlightColor(color) {
    const { contentEl } = elements;
    if (!contentEl) return;
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    document.execCommand('styleWithCSS', true, null);

    if (color === 'default') {
      if (hasSelection) {
        document.execCommand('removeFormat', false, null);
      }
      state.highlightColorState = null;
    } else {
      if (hasSelection || state.colorApplicationMode === 'selection') {
        document.execCommand('hiliteColor', false, color);
      } else {
        state.highlightColorState = color;
        showColorTooltip('El resaltado se aplicará al próximo texto que selecciones');
      }
    }

    contentEl.focus();
    saveContent();
  }

  function applyTextColorToSelection(color) {
    document.execCommand('styleWithCSS', true, null);
    document.execCommand('foreColor', false, color);
    saveContent();
  }

  function applyHighlightColorToSelection(color) {
    document.execCommand('styleWithCSS', true, null);
    document.execCommand('hiliteColor', false, color);
    saveContent();
  }

  function setupSelectionTracking() {
    const { contentEl } = elements;
    if (!contentEl) return;

    contentEl.addEventListener('mousedown', () => {
      state.colorApplicationMode = 'selection';
    });

    contentEl.addEventListener('keydown', () => {
      state.colorApplicationMode = 'future';
    });

    contentEl.addEventListener('mouseup', updateColorApplicationMode);
    contentEl.addEventListener('keyup', updateColorApplicationMode);
  }

  function setupContentEvents() {
    const { contentEl } = elements;
    if (!contentEl) return;

    contentEl.addEventListener('input', () => {
      if (state.colorApplicationMode === 'future' && state.textColorState !== '#ffffff') {
        updateLastTextNodeColor();
      }
    });
  }

  function updateLastTextNodeColor() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    while (node && node.nodeType !== Node.TEXT_NODE) {
      node = node.lastChild;
    }

    if (node && state.textColorState !== '#ffffff') {
      const span = document.createElement('span');
      span.style.color = state.textColorState;
      span.textContent = node.textContent;
      node.parentNode.replaceChild(span, node);
      saveContent();
    }
  }

  function setupEditorToolbar() {
    const { contentEl } = elements;

    document.querySelectorAll('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        saveStateToUndoStack();

        if (cmd === 'strikeThrough') {
          toggleStrikeThrough();
        } else if (cmd === 'underline') {
          toggleUnderline();
        } else {
          document.execCommand('styleWithCSS', true, null);
          document.execCommand(cmd, false, null);
          syncNoteContentAfterFormat();
          refreshDecorationButtonStates();
        }

        contentEl?.focus();
      });
    });

    document.addEventListener('selectionchange', () => {
      if (!contentEl) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const contains = (node) => node && (node === contentEl || contentEl.contains(node));
      if (!contains(sel.anchorNode) && !contains(sel.focusNode)) return;
      refreshDecorationButtonStates();
    });
  }

  function setupFieldListeners() {
    const {
      titleEl,
      contentEl,
      colorTextInput,
      colorHiliteInput,
      underlineStyleSelect,
      underlineThicknessSelect,
      strikeStyleSelect,
      strikeThicknessSelect,
    } = elements;

    titleEl?.addEventListener('input', () => {
      if (!state.currentNote) return;
      state.currentNote.title = (titleEl.textContent || '').trim();
      debouncedSave();
    });

    contentEl?.addEventListener('input', () => {
      if (!state.currentNote) return;
      const saved = saveSelection();
      const clean = sanitizeHTML(contentEl.innerHTML);
      if (clean !== contentEl.innerHTML) {
        contentEl.innerHTML = clean;
        restoreSelection(saved);
      }
      state.currentNote.content = clean;

      if (state.underlineModeActive) {
        applyDecorationStyleAtCaret('underline');
      }
      if (state.strikeModeActive) {
        applyDecorationStyleAtCaret('strike');
      }

      clearTimeout(state.undoDebounceTimer);
      state.undoDebounceTimer = setTimeout(() => saveStateToUndoStack(), 500);

      debouncedSave();
      refreshDecorationButtonStates();
    });

    colorTextInput?.addEventListener('input', () => {
      applyTextColorToSelection(colorTextInput.value);
    });

    colorHiliteInput?.addEventListener('input', () => {
      applyHighlightColorToSelection(colorHiliteInput.value);
      contentEl?.focus();
    });

    underlineStyleSelect?.addEventListener('change', () => {
      state.underlineStyle = underlineStyleSelect.value || 'solid';
      handleDecorationStyleChange('underline');
    });

    underlineThicknessSelect?.addEventListener('change', () => {
      state.underlineThickness = underlineThicknessSelect.value || 'auto';
      handleDecorationStyleChange('underline');
    });

    strikeStyleSelect?.addEventListener('change', () => {
      state.strikeStyle = strikeStyleSelect.value || 'solid';
      handleDecorationStyleChange('strike');
    });

    strikeThicknessSelect?.addEventListener('change', () => {
      state.strikeThickness = strikeThicknessSelect.value || 'auto';
      handleDecorationStyleChange('strike');
    });
  }

  function setupToolbarToggle() {
    const { toolbarToggle, toolbarEl } = elements;
    toolbarToggle?.addEventListener('click', () => {
      const willExpand = toolbarEl?.classList.contains('collapsed');
      setToolbarExpanded(!!willExpand);
    });
  }

  function initializeColorSystem() {
    const bgColorPicker = document.getElementById('background-color-picker');
    const resetBgColor = document.getElementById('reset-background-color');
    const textColorPicker = document.getElementById('text-color-picker');
    const resetTextColor = document.getElementById('reset-text-color');
    const highlightColorPicker = document.getElementById('highlight-color-picker');
    const resetHighlightColor = document.getElementById('reset-highlight-color');
    const { contentEl } = elements;

    bgColorPicker?.addEventListener('input', (e) => {
      applyBackgroundColor(e.target.value);
    });

    resetBgColor?.addEventListener('click', () => {
      applyBackgroundColor('#2c2c2c');
      if (bgColorPicker) bgColorPicker.value = '#2c2c2c';
    });

    textColorPicker?.addEventListener('input', (e) => {
      state.textColorState = e.target.value;
      applyTextColor(state.textColorState);
    });

    resetTextColor?.addEventListener('click', () => {
      state.textColorState = '#ffffff';
      applyTextColor('default');
      if (textColorPicker) textColorPicker.value = '#ffffff';
    });

    highlightColorPicker?.addEventListener('input', (e) => {
      state.highlightColorState = e.target.value;
      applyHighlightColor(state.highlightColorState);
    });

    resetHighlightColor?.addEventListener('click', () => {
      state.highlightColorState = null;
      applyHighlightColor('default');
      if (highlightColorPicker) highlightColorPicker.value = '#ffff00';
    });

    contentEl?.addEventListener('mousedown', () => {
      state.colorApplicationMode = 'selection';
    });
  }

  function setupSelectionListeners() {
    setupSelectionTracking();
    setupContentEvents();
  }

  function setupImageButton() {
    const { btnImage, imageInput } = elements;
    btnImage && imageInput && btnImage.addEventListener('click', () => imageInput.click());
    imageInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          document.execCommand('insertImage', false, reader.result);
          if (state.currentNote && elements.contentEl) {
            state.currentNote.content = sanitizeHTML(elements.contentEl.innerHTML);
            debouncedSave();
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function setupContentKeydown() {
    const { contentEl } = elements;
    if (!contentEl) return;
    contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();

        const currentColor = state.textColorState;

        try {
          const did = document.execCommand('insertHTML', false, '<br>');
          if (did) {
            if (currentColor && currentColor !== '#ffffff') {
              setTimeout(() => {
                try { document.execCommand('styleWithCSS', true, null); } catch {}
                try { document.execCommand('foreColor', false, currentColor); } catch {}
                updateContentAndSave();
                resetDecorationModesForNewLine();
              }, 10);
            } else {
              updateContentAndSave();
              resetDecorationModesForNewLine();
            }
            return;
          }
        } catch (error) {
          // ignore
        }

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(range);

          if (currentColor && currentColor !== '#ffffff') {
            setTimeout(() => {
              try { document.execCommand('styleWithCSS', true, null); } catch {}
              try { document.execCommand('foreColor', false, currentColor); } catch {}
              updateContentAndSave();
              resetDecorationModesForNewLine();
            }, 10);
          } else {
            updateContentAndSave();
            resetDecorationModesForNewLine();
          }
        }
      }
    });
  }

  function registerGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        api.floatWindowAction?.('close', state.noteId);
      }
    });
  }

  function cachePrimaryElements() {
    elements.btnImage = document.getElementById('btn-image');
    elements.imageInput = document.getElementById('image-input');
  }

  function setupEvents() {
    setupKeyboardShortcuts();
    setupEditorToolbar();
    setupFieldListeners();
    setupToolbarToggle();
    initializeColorSystem();
    setupSelectionListeners();
    setupImageButton();
    setupContentKeydown();
    registerGlobalShortcuts();
    setupWindowControls();
  }

  function setupWindowControls() {
    const { pinBtn, collapseBtn, minBtn, closeBtn, deleteBtn, container } = elements;

    pinBtn?.addEventListener('click', () => {
      api.floatWindowAction?.('toggle-pin', state.noteId);
      setPinnedUI(!(state.currentNote?.isPinned));
    });

    collapseBtn?.addEventListener('click', () => {
      if (!container || !collapseBtn) return;
      const collapsed = container.classList.toggle('collapsed');
      collapseBtn.textContent = collapsed ? 'expand_more' : 'expand_less';
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    });

    minBtn?.addEventListener('click', () => {
      api.floatWindowAction?.('minimize', state.noteId);
    });

    closeBtn?.addEventListener('click', () => {
      api.floatWindowAction?.('close', state.noteId);
    });

    deleteBtn?.addEventListener('click', () => {
      showConfirm({
        title: 'Eliminar Nota',
        message: '¿Estás seguro de que quieres eliminar esta nota?',
        type: 'warning',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
      }).then((confirmed) => {
        if (confirmed) {
          api.deleteNote?.(state.noteId);
        }
      });
    });
  }

  async function initialize(noteData) {
    console.log('🚀 editor.initialize - Iniciando...');
    console.log('📦 noteData recibido:', noteData ? 'SÍ' : 'NO');
    console.log('📝 state.noteId:', state.noteId);
    
    ensureImprovedStylesOnce();
    cachePrimaryElements();
    initNoteModalSystem();
    await initTheme();

    if (!state.noteId) {
      console.error('❌ No hay noteId en state');
      await showAlert({ title: 'Error', message: 'Nota no encontrada', type: 'error' });
      window.close();
      return;
    }

    let note = noteData;
    if (!note) {
      console.log('📥 Intentando cargar nota desde API...');
      console.log('🔍 api.getNoteData existe?', typeof api.getNoteData);
      try {
        if (typeof api.getNoteData === 'function') {
          console.log('✅ Llamando a api.getNoteData(' + state.noteId + ')...');
          note = await api.getNoteData(state.noteId);
          console.log('📦 Nota recibida:', note ? 'SÍ' : 'NO');
        } else {
          console.error('❌ api.getNoteData no está disponible');
          console.log('🔍 api keys disponibles:', Object.keys(api));
          await showAlert({ title: 'Error', message: 'No se pudo cargar la nota: API no disponible', type: 'error' });
          window.close();
          return;
        }
      } catch (error) {
        console.error('❌ Error al cargar nota:', error);
        await showAlert({ title: 'Error', message: 'No se pudo cargar la nota: ' + error.message, type: 'error' });
        window.close();
        return;
      }
    }

    if (!note) {
      console.error('❌ No se pudo obtener la nota');
      await showAlert({ title: 'Error', message: 'No se pudo cargar la nota', type: 'error' });
      window.close();
      return;
    }

    console.log('✅ Nota cargada, renderizando...');
    if (!Array.isArray(note.audioFiles)) note.audioFiles = [];
    renderNote(note);
    api.preventClose?.();
    setToolbarExpanded(false);
    setupEvents();
    loadCurrentColors();
    saveStateToUndoStack();
    console.log('✅ Editor inicializado completamente');
  }

  services.createAudioPlayer = null; // placeholder; audio module will extend

  return {
    initialize,
    saveStateToUndoStack,
    handleUndo,
    handleRedo,
    updateUndoRedoUI,
    updateContentAndSave,
    insertLink,
    duplicateSelection,
    toggleComment,
    collapseSelectionToEnd,
    moveCaretOutOfDecoration,
    syncNoteContentAfterFormat,
    nodeHasDecoration,
    getNodeBeforeCaret,
    applyDecorationStyleToElement,
    applyDecorationStyleToSelection,
    getElementForDecorationAtCaret,
    findDecorationElementInRange,
    normalizeDecorationStyle,
    normalizeDecorationThickness,
    updateDecorationSelectUI,
    applyDecorationStyleAtCaret,
    handleDecorationStyleChange,
    selectionHasDecoration,
    setDecorationButtonState,
    refreshDecorationButtonStates,
    toggleUnderline,
    toggleStrikeThrough,
    resetDecorationModesForNewLine,
    applyTheme,
    initTheme,
    ensureImprovedStylesOnce,
    renderNote,
    saveSelection,
    restoreSelection,
    debouncedSave,
    saveContent,
    showToast,
    showAlert,
    showConfirm,
    applyBackgroundColor,
    applyTextColor,
    applyHighlightColor,
    applyTextColorToSelection,
    applyHighlightColorToSelection,
    showColorTooltip,
    updateColorPicker,
    loadCurrentColors,
    updateColorApplicationMode,
    services,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createEditor };
}





