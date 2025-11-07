const pathModule = require('path');
const { elements, state } = require(pathModule.join(__dirname, 'context.js'));

function encodeFileUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  return `file://${encodeURI(normalized)}`;
}

function registerAudioModule(editor) {
  const { debouncedSave, showToast, refreshDecorationButtonStates, showConfirm } = editor;

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

  function downloadAudio(audioFile) {
    try {
      const link = document.createElement('a');
      link.href = encodeFileUrl(audioFile.filePath);
      const date = audioFile.recordedAt ? new Date(audioFile.recordedAt).toISOString().split('T')[0] : Date.now();
      link.download = `grabacion-audio-${date}.webm`;
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
    if (!state.currentNote || !Array.isArray(state.currentNote.audioFiles)) return;

    state.currentNote.audioFiles.splice(index, 1);
    container.style.opacity = '0.5';
    container.style.transform = 'translateX(-100%)';

    setTimeout(() => {
      container.remove();

      const list = elements.audioFilesList || document.getElementById('audio-files-list');
      if (list && list.children.length === 0) {
        const audioSection = elements.audioPlayerSection || document.getElementById('audio-player-section');
        if (audioSection) {
          audioSection.classList.add('hidden');
          audioSection.setAttribute('aria-hidden', 'true');
        }
      }

      debouncedSave();
      showToast('Audio eliminado', 'success');
      refreshDecorationButtonStates();
    }, 300);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function createCustomAudioPlayer(audioFile, index) {
    const container = document.createElement('div');
    container.className = 'audio-file-container';
    container.dataset.audioIndex = index;

    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'audio-player-wrapper';

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
    if (audioFile.fileSize) {
      sizeInfo.innerHTML = `
        <span class="material-symbols-outlined">storage</span>
        <span>${audioFile.fileSize}</span>
      `;
      details.appendChild(sizeInfo);
    }

    details.appendChild(dateInfo);
    metadata.appendChild(title);
    metadata.appendChild(details);
    audioInfo.appendChild(metadata);

    const player = document.createElement('div');
    player.className = 'audio-player';

    const customPlayer = document.createElement('div');
    customPlayer.className = 'custom-audio-player';

    const controls = document.createElement('div');
    controls.className = 'player-controls';

    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'play-pause-btn';
    playPauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    playPauseBtn.title = 'Reproducir';

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

    controls.appendChild(playPauseBtn);
    customPlayer.appendChild(controls);
    customPlayer.appendChild(progressContainer);
    customPlayer.appendChild(volumeControl);
    customPlayer.appendChild(actions);
    player.appendChild(customPlayer);

    playerWrapper.appendChild(audioInfo);
    playerWrapper.appendChild(player);
    container.appendChild(playerWrapper);

    const audioEl = document.createElement('audio');
    audioEl.preload = 'metadata';
    audioEl.src = encodeFileUrl(audioFile.filePath);
    container.appendChild(audioEl);

    let isPlaying = false;

    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        audioEl.pause();
      } else {
        audioEl.play().catch((error) => {
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

    audioEl.addEventListener('timeupdate', () => {
      if (!audioEl.duration) return;
      const percent = (audioEl.currentTime / audioEl.duration) * 100;
      progressFill.style.width = `${percent}%`;
      currentTime.textContent = formatTime(audioEl.currentTime);
    });

    audioEl.addEventListener('loadedmetadata', () => {
      if (audioEl.duration && isFinite(audioEl.duration)) {
        duration.textContent = formatTime(audioEl.duration);
      }
    });

    audioEl.addEventListener('ended', () => {
      isPlaying = false;
      player.classList.remove('playing');
      playPauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      audioEl.currentTime = 0;
      progressFill.style.width = '0%';
      currentTime.textContent = '0:00';
    });

    progressBar.addEventListener('click', (e) => {
      if (!audioEl.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = percent * audioEl.duration;
    });

    volumeSlider.addEventListener('click', (e) => {
      const rect = volumeSlider.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const volume = Math.max(0, Math.min(1, percent));
      audioEl.volume = volume;
      volumeLevel.style.width = `${volume * 100}%`;

      let icon = 'volume_up';
      if (volume === 0) icon = 'volume_off';
      else if (volume < 0.5) icon = 'volume_down';
      volumeBtn.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
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

    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadAudio(audioFile);
    });

    deleteBtn.addEventListener('click', () => {
      showConfirm({
        title: 'Eliminar audio',
        message: '¿Seguro que quieres eliminar esta grabación?',
        type: 'warning',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
      }).then((confirmed) => {
        if (confirmed) {
          deleteAudio(container, audioFile, index);
        }
      });
    });

    audioEl.addEventListener('error', (event) => {
      console.error('Error de audio:', event);
      showAudioError('Error al cargar el archivo de audio');
    });

    return container;
  }

  editor.services.createAudioPlayer = createCustomAudioPlayer;

  return {
    createCustomAudioPlayer,
    downloadAudio,
    deleteAudio,
    showAudioError,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerAudioModule };
}

