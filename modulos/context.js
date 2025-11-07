const elements = {
  container: null,
  titleEl: null,
  contentEl: null,
  pinBtn: null,
  collapseBtn: null,
  minBtn: null,
  closeBtn: null,
  deleteBtn: null,
  toolbarToggle: null,
  toolbarEl: null,
  audioPlayerSection: null,
  audioFilesList: null,
  fontNameSelect: null,
  fontSizeSelect: null,
  blockFormatSelect: null,
  colorTextInput: null,
  colorHiliteInput: null,
  btnImage: null,
  imageInput: null,
  underlineBtn: null,
  strikeBtn: null,
  underlineStyleSelect: null,
  underlineThicknessSelect: null,
  strikeStyleSelect: null,
  strikeThicknessSelect: null,
};

const state = {
  noteId: null,
  currentNote: null,
  debounceTimer: null,
  undoDebounceTimer: null,
  undoStack: [],
  redoStack: [],
  maxUndoSteps: 50,
  textColorState: '#ffffff',
  highlightColorState: null,
  backgroundColorState: '#2c2c2c',
  colorApplicationMode: 'future',
  underlineModeActive: false,
  strikeModeActive: false,
  underlineStyle: 'solid',
  underlineThickness: 'auto',
  strikeStyle: 'solid',
  strikeThickness: 'auto',
  audioQualityButton: null,
  audioQualityPresets: {
    standard: {
      sampleRate: 44100,
      channelCount: 2,
      audioBitsPerSecond: 128000,
      label: 'Estándar (128 kbps)',
      description: 'Calidad recomendada para notas rápidas',
    },
    good: {
      sampleRate: 44100,
      channelCount: 2,
      audioBitsPerSecond: 160000,
      label: 'Buena (160 kbps)',
      description: 'Equilibrio entre calidad y peso',
    },
    high: {
      sampleRate: 48000,
      channelCount: 2,
      audioBitsPerSecond: 192000,
      label: 'Alta (192 kbps)',
      description: 'Recomendado para música o reuniones importantes',
    },
    professional: {
      sampleRate: 48000,
      channelCount: 2,
      audioBitsPerSecond: 256000,
      label: 'Profesional (256 kbps)',
      description: 'Máxima calidad - archivos más grandes',
    },
  },
  currentAudioQuality: 'good',
  isSavingDrawing: false,
  modalSystem: null,
};

// Inicializar api con window.api si está disponible
console.log('🔍 context.js - Inicializando...');
console.log('🔍 typeof window:', typeof window);
console.log('🔍 window.api existe?', typeof window !== 'undefined' && window.api ? 'SÍ' : 'NO');
if (typeof window !== 'undefined' && window.api) {
  console.log('🔍 window.api keys:', Object.keys(window.api));
}

const api = (typeof window !== 'undefined' && window.api) ? window.api : {};
console.log('🔍 api inicializado con', Object.keys(api).length, 'funciones');

function setNoteId(id) {
  state.noteId = id;
  console.log('📝 noteId establecido:', id);
}

function cacheElements() {
  elements.container = document.getElementById('float-note-container');
  elements.titleEl = document.querySelector('.float-title');
  elements.contentEl = document.getElementById('float-content');
  elements.pinBtn = document.getElementById('float-pin-btn');
  elements.collapseBtn = document.getElementById('float-collapse-btn');
  elements.minBtn = document.getElementById('float-min-btn');
  elements.closeBtn = document.getElementById('float-close-btn');
  elements.deleteBtn = document.getElementById('float-delete-btn');
  elements.toolbarToggle = document.getElementById('toolbar-toggle');
  elements.toolbarEl = document.querySelector('.float-toolbar');
  elements.audioPlayerSection = document.getElementById('audio-player-section');
  elements.audioFilesList = document.getElementById('audio-files-list');
  elements.fontNameSelect = document.getElementById('font-name');
  elements.fontSizeSelect = document.getElementById('font-size');
  elements.blockFormatSelect = document.getElementById('block-format');
  elements.colorTextInput = document.getElementById('color-text');
  elements.colorHiliteInput = document.getElementById('color-hilite');
  elements.btnImage = document.getElementById('btn-image');
  elements.imageInput = document.getElementById('image-input');
  elements.underlineBtn = document.querySelector('[data-cmd="underline"]');
  elements.strikeBtn = document.querySelector('[data-cmd="strikeThrough"]');
  elements.underlineStyleSelect = document.getElementById('underline-style-select');
  elements.underlineThicknessSelect = document.getElementById('underline-thickness-select');
  elements.strikeStyleSelect = document.getElementById('strike-style-select');
  elements.strikeThicknessSelect = document.getElementById('strike-thickness-select');
}

function getElement(key) {
  return elements[key] || null;
}

function setCurrentNote(note) {
  state.currentNote = note;
}

function updateAPI() {
  if (typeof window !== 'undefined' && window.api) {
    // Copiar todas las propiedades de window.api al objeto api
    Object.keys(window.api).forEach(key => {
      api[key] = window.api[key];
    });
    console.log('✅ API actualizado con', Object.keys(api).length, 'funciones');
  } else {
    console.warn('⚠️ window.api no está disponible');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { elements, state, api, setNoteId, cacheElements, getElement, setCurrentNote, updateAPI };
}

