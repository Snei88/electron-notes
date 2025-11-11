// modulos/features/audio-recorder.js
class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
  }

  async startRecording(quality = 'good') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      const config = this.getAudioConfig(quality);
      this.mediaRecorder = new MediaRecorder(stream, config);
      this.audioChunks = [];
      this.isRecording = true;
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.saveRecording(audioBlob, quality);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(1000); // Capturar datos cada segundo
      this.startTimer();
      
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('No se pudo acceder al micrófono');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
      return true;
    }
    return false;
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      this.updateTimerDisplay(elapsed);
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay(elapsedMs) {
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const display = `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    
    // Actualizar UI
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) {
      timerElement.textContent = display;
    }
  }

  getAudioConfig(quality) {
    const presets = {
      standard: { 
        audioBitsPerSecond: 128000 
      },
      good: { 
        audioBitsPerSecond: 160000 
      },
      high: { 
        audioBitsPerSecond: 192000 
      },
      professional: { 
        audioBitsPerSecond: 256000 
      }
    };
    
    return presets[quality] || presets.good;
  }

  async saveRecording(audioBlob, quality) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      await safeIPCCall(api.saveAudio, arrayBuffer);
      
      notificationManager.show(
        `Grabación guardada (${quality})`,
        'success',
        3000
      );
    } catch (error) {
      console.error('Error saving recording:', error);
      notificationManager.show(
        'Error al guardar la grabación',
        'error',
        5000
      );
    }
  }
}

module.exports = new AudioRecorder();