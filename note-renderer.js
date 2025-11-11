const path = require('path');
const { cacheElements, setNoteId, state, api, updateAPI } = require(path.join(__dirname, 'modulos', 'context.js'));
const { createEditor } = require(path.join(__dirname, 'modulos', 'editor.js'));
const { registerAudioModule } = require(path.join(__dirname, 'modulos', 'audio.js'));
const { registerDrawingModule } = require(path.join(__dirname, 'modulos', 'drawing.js'));
const { registerIPCModule } = require(path.join(__dirname, 'modulos', 'ipc.js'));

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 note-renderer.js - DOMContentLoaded');
    console.log('🔍 window.api disponible?', window.api ? 'SÍ' : 'NO');
    if (window.api) {
      console.log('🔍 window.api funciones:', Object.keys(window.api).slice(0, 10));
    }
    
    // Actualizar API desde window.api (preload)
    updateAPI();
    
    const noteId = window.location.hash.substring(1);
    console.log('📝 noteId desde hash:', noteId);
    
    if (!noteId) {
      console.error('❌ No se encontró noteId en el hash');
      window.alert('Error: Nota no encontrada');
      window.close();
      return;
    }

    setNoteId(noteId);
    cacheElements();

    // Opening animation: add temporary classes to trigger CSS transitions
    try {
      const containerEl = document.getElementById('float-note-container');
      if (containerEl) {
        containerEl.classList.add('opening');
        // small delay to allow CSS initial state, then switch to open
        requestAnimationFrame(() => {
          // next frame: add 'open' to animate to full state
          containerEl.classList.add('open');
          // remove transient 'opening' after animation completes
          containerEl.addEventListener('transitionend', function _onEnd(e) {
            if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
              containerEl.classList.remove('opening');
              containerEl.removeEventListener('transitionend', _onEnd);
            }
          });
        });
      }
    } catch (err) {
      console.warn('Animación apertura no aplicada:', err);
    }

    console.log('🎨 Creando editor...');
    const editor = createEditor();
    
    // Registrar módulos
    const audioModule = registerAudioModule(editor);
    if (audioModule && audioModule.createCustomAudioPlayer) {
      editor.services.createAudioPlayer = audioModule.createCustomAudioPlayer;
    }

    const drawingModule = registerDrawingModule(editor);
    const ipcModule = registerIPCModule(editor);

    // Inicializar editor
    await editor.initialize();

    // Conectar IPC
    if (ipcModule && ipcModule.attach) {
      ipcModule.attach();
    }

    // Exponer funciones globales
    if (typeof window !== 'undefined') {
      window.saveDrawing = drawingModule?.saveDrawing;
      window.editor = editor;
    }

    console.log('✅ Nota renderer inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar nota renderer:', error);
    console.error('Stack:', error.stack);
    window.alert(`Error al cargar la nota: ${error.message}`);
    window.close();
  }
});

