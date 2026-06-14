// Audio input and playback control: microphone init, input-mode switching,
// file loading/playback, and the record/reset transport for both modes.

import { state } from './state.js';
import { toggleVideoRecording, stopVideoRecording } from './recording.js';

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
      alert('マイクの初期化に失敗しました。ブラウザの設定を確認してください。');
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
    if (state.mic.started) {
      state.mic.stop();
    }
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

      select('#play-pause-btn').html('再生');
      select('#file-record-btn').html('描画開始');
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
    select('#play-pause-btn').html('一時停止');
    loop();
  } else {
    state.soundFile.pause();
    select('#play-pause-btn').html('再生');
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
    select('#file-record-btn').html('描画停止');
    if (!state.isPlaying) loop();
  } else {
    state.trimEnd = state.soundFile.currentTime();
    select('#file-record-btn').html('描画開始');
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
    select('#mic-record-btn').html('一時停止');
  } else {
    state.mic.stop();
    noLoop();
    select('#mic-record-btn').html('描画開始');
  }
}

export function stopAndReset() {
  if (state.soundFile && (state.soundFile.isPlaying() || state.soundFile.isPaused())) {
    state.soundFile.stop();
  }
  if (state.mic && state.mic.started) {
    state.mic.stop();
  }

  state.isPlaying = false;
  state.isRecording = false;

  select('#play-pause-btn').html('再生');
  select('#mic-record-btn').html('描画開始');
  select('#file-record-btn').html('描画開始');

  background(0);
  state.spectrumHistory = [];
  state.prevSpectrum = [];

  // Fully reset video recording too.
  if (state.isVideoRecording) {
    stopVideoRecording();
  }
  state.mediaRecorder = null;
  state.recordedChunks = [];

  state.sessionId = null;
  select('#time-display').html('0.0s');

  if (state.currentInputMode === 'file' && state.soundFile && state.soundFile.isLoaded()) {
    updateFileProgressBar();
  }

  noLoop();
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
