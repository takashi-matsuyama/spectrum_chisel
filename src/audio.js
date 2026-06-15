// Audio input and playback control: microphone init, input-mode switching,
// file loading/playback, and the record/reset transport for both modes.

import { state } from './state.js';
import { toggleVideoRecording, stopVideoRecording } from './recording.js';
import { broadcastClear } from './broadcast.js';
import { t, applyLabel } from './i18n/index.js';

export function initMic() {
  state.mic = new p5.AudioIn();
  state.mic.start(
    () => {
      console.log('Mic ready.');
      state.fft.setInput(state.mic);
      state.mic.stop(); // Start in a stopped state.
    },
    (err) => {
      console.error('Mic error:', err);
      alert(t('alertMicInit'));
    }
  );
}

export function switchInputMode(mode) {
  stopAndReset();
  state.currentInputMode = mode;
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const micControls = select('#mic-controls');
  const fileControls = select('#file-controls');

  if (mode === 'mic') {
    micBtn.addClass('active');
    fileBtn.removeClass('active');
    micControls.removeClass('hidden');
    fileControls.addClass('hidden');
    state.fft.setInput(state.mic);
  } else {
    fileBtn.addClass('active');
    micBtn.removeClass('active');
    micControls.addClass('hidden');
    fileControls.removeClass('hidden');

    // Fully reset the mic connection so audio input is reliably off.
    // p5.AudioIn exposes no reliable "started" flag, and stop() is a safe no-op
    // when the mic is already stopped, so stop it unconditionally.
    state.mic.stop();
    state.mic.disconnect();

    if (state.soundFile) {
      state.fft.setInput(state.soundFile);
    }
  }
}

export function setupSoundControls() {
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const uploadInput = select('#upload-sound');
  const playPauseBtn = select('#play-pause-btn');
  const resetBtn = select('#reset-btn');
  const fileVolumeSlider = select('#file-volume-slider');
  const micRecordBtn = select('#mic-record-btn');
  const fileRecordBtn = select('#file-record-btn');
  const progressBar = select('#progress-bar');
  const videoRecordBtn = select('#video-record-btn');

  micBtn.mousePressed(() => switchInputMode('mic'));
  fileBtn.mousePressed(() => uploadInput.elt.click());
  uploadInput.changed(handleSoundFile);

  playPauseBtn.mousePressed(toggleFilePlayback);
  micRecordBtn.mousePressed(toggleMicRecording);
  fileRecordBtn.mousePressed(toggleFileRecording);
  videoRecordBtn.mousePressed(toggleVideoRecording);

  resetBtn.mousePressed(stopAndReset);

  fileVolumeSlider.input(() => {
    if (state.soundFile) {
      state.soundFile.setVolume(fileVolumeSlider.value());
    }
  });

  progressBar.elt.addEventListener('input', () => {
    if (state.soundFile && state.soundFile.isLoaded() && !state.soundFile.isPlaying()) {
      const duration = state.soundFile.duration();
      const jumpTime = (progressBar.value() / 100) * duration;
      state.soundFile.jump(jumpTime);
      updateFileProgressBar();
    }
  });
}

export function handleSoundFile(event) {
  if (event.target.files[0]) {
    if (state.soundFile) {
      state.soundFile.stop();
    }
    state.soundFile = loadSound(event.target.files[0], () => {
      console.log('Sound file loaded.');

      // Initialize the trim range to the whole file.
      state.trimStart = 0;
      state.trimEnd = state.soundFile.duration();

      switchInputMode('file');

      const fileVolumeSlider = select('#file-volume-slider');
      state.soundFile.setVolume(fileVolumeSlider.value());

      applyLabel(select('#play-pause-btn'), 'play');
      applyLabel(select('#file-record-btn'), 'startDrawing');
      state.isPlaying = false;
      state.isRecording = false;
      noLoop();
    });
  }
}

export function toggleFilePlayback() {
  if (!state.soundFile || !state.soundFile.isLoaded()) return;
  if (getAudioContext().state !== 'running') userStartAudio();

  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    state.soundFile.play();
    applyLabel(select('#play-pause-btn'), 'pause');
    loop();
  } else {
    state.soundFile.pause();
    applyLabel(select('#play-pause-btn'), 'play');
    if (!state.isRecording) noLoop(); // Keep looping while recording.
  }
}

export function toggleFileRecording() {
  if (!state.soundFile || !state.soundFile.isLoaded()) return;

  state.isRecording = !state.isRecording;
  if (state.isRecording) {
    if (state.spectrumHistory.length === 0) {
      state.sessionId = Date.now();
      state.recordStartTime = millis();
      state.trimStart = state.soundFile.currentTime();
    }
    applyLabel(select('#file-record-btn'), 'stopDrawing');
    if (!state.isPlaying) loop();
  } else {
    state.trimEnd = state.soundFile.currentTime();
    applyLabel(select('#file-record-btn'), 'startDrawing');
    if (!state.isPlaying) noLoop();
  }
}

export function toggleMicRecording() {
  if (getAudioContext().state !== 'running') userStartAudio();

  state.isRecording = !state.isRecording;
  state.isPlaying = state.isRecording;

  if (state.isRecording) {
    if (state.spectrumHistory.length === 0) {
      state.sessionId = Date.now();
      state.recordStartTime = millis();
    }
    state.mic.start();
    loop();
    applyLabel(select('#mic-record-btn'), 'pause');
  } else {
    state.mic.stop();
    noLoop();
    applyLabel(select('#mic-record-btn'), 'startDrawing');
  }
}

export function stopAndReset() {
  // Stop any in-flight video recording first, while the session id and frame
  // count are still intact: stopVideoRecording() snapshots the filename now and
  // its onstop handler owns finalizing the file and tearing down the capture
  // graph, so we must not clear that state out from under it here.
  if (state.isVideoRecording) {
    stopVideoRecording();
  }

  if (state.soundFile && (state.soundFile.isPlaying() || state.soundFile.isPaused())) {
    state.soundFile.stop();
  }
  // Always stop the mic so input is released on reset. state.mic.started does
  // not exist on p5.AudioIn (it was always undefined, so the mic was never
  // stopped here); stop() is a safe no-op when the mic is already stopped.
  if (state.mic) {
    state.mic.stop();
  }

  state.isPlaying = false;
  state.isRecording = false;

  applyLabel(select('#play-pause-btn'), 'play');
  applyLabel(select('#mic-record-btn'), 'startDrawing');
  applyLabel(select('#file-record-btn'), 'startDrawing');

  background(0);
  state.spectrumHistory = [];
  state.prevSpectrum = [];

  state.sessionId = null;
  select('#time-display').html('0.0s');

  if (state.currentInputMode === 'file' && state.soundFile && state.soundFile.isLoaded()) {
    updateFileProgressBar();
  }

  noLoop();
  // Clear any open viewing window too.
  broadcastClear();
  console.log('Canvas and history cleared.');
}

export function updateFileProgressBar() {
  const progressBar = select('#progress-bar');
  const timeDisplay = select('#file-time-display');
  if (state.soundFile && state.soundFile.isLoaded()) {
    const currentTime = state.soundFile.currentTime();
    const duration = state.soundFile.duration();
    progressBar.value((currentTime / duration) * 100); // p5 slider expects 0-100.
    timeDisplay.html(`${formatTime(currentTime)} / ${formatTime(duration)}`);
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
