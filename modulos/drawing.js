const path = require('path');
const { state, api } = require(path.join(__dirname, 'context.js'));

function registerDrawingModule(editor) {
  const { showToast } = editor;

  async function saveDrawing() {
    const drawingCanvas = window.drawingCanvas;
    const drawingModal = window.drawingModal;

    if (!drawingCanvas) {
      console.log('⚠️ saveDrawing: canvas no disponible en este contexto');
      return;
    }

    if (state.isSavingDrawing) {
      console.log('⏳ Guardado de dibujo ya en progreso, ignorando nueva petición');
      return;
    }

    state.isSavingDrawing = true;

    try {
      const dataURL = drawingCanvas.toDataURL('image/png');
      const title = `Dibujo ${new Date().toLocaleString('es-CO')}`;

      const saveBtn = document.getElementById('drawing-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>';
      }

      const targetNoteId = (state.currentNote && state.currentNote.id) ? state.currentNote.id : state.noteId;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout en guardado de dibujo'));
        }, 5000);

        api.saveDrawing({ dataURL, noteId: targetNoteId, title });

        let offSuccess = null;
        let offError = null;

        const successHandler = (note) => {
          clearTimeout(timeout);
          offSuccess?.();
          offError?.();
          resolve(note);
        };

        const errorHandler = (error) => {
          clearTimeout(timeout);
          offSuccess?.();
          offError?.();
          reject(error);
        };

        try {
          offSuccess = api.onDrawingSaved?.(successHandler);
          offError = api.onDrawingSaveError?.(errorHandler);
        } catch (error) {
          api.onDrawingSaved && api.onDrawingSaved(successHandler);
          api.onDrawingSaveError && api.onDrawingSaveError(errorHandler);
          offSuccess = null;
          offError = null;
        }
      });

      if (drawingModal) {
        drawingModal.classList.add('hidden');
      }
      if (typeof window.currentDrawingNoteId !== 'undefined') {
        window.currentDrawingNoteId = null;
      }
    } catch (error) {
      console.error('❌ Error al guardar dibujo:', error);
      try {
        showToast(`Error al guardar el dibujo: ${error?.message || error}`, 'error');
      } catch (toastError) {
        console.error(toastError);
      }
    } finally {
      state.isSavingDrawing = false;
      const saveBtn = document.getElementById('drawing-save-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span>';
      }
    }
  }

  return {
    saveDrawing,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerDrawingModule };
}

