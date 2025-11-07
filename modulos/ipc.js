const path = require('path');
const { state, api } = require(path.join(__dirname, 'context.js'));

function registerIPCModule(editor) {
  let offNoteDeleted = null;
  let offNoteUpdated = null;

  function cleanup() {
    offNoteDeleted?.();
    offNoteUpdated?.();
    offNoteDeleted = null;
    offNoteUpdated = null;
    window.removeEventListener('beforeunload', cleanup);
  }

  function attach() {
    offNoteDeleted = api.onNoteDeleted?.((deletedId) => {
      if (deletedId === state.noteId) {
        window.close();
      }
    });

    offNoteUpdated = api.onNoteUpdated?.((note) => {
      if (note.id === state.noteId) {
        editor.renderNote(note);
      }
    });

    window.addEventListener('beforeunload', cleanup);
  }

  return {
    attach,
    cleanup,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerIPCModule };
}

