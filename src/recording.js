// Video recording: captures the canvas plus the active audio source into a
// downloadable WebM file.

import { state } from './state.js';
import { generateTimestampedFilename } from './export.js';

export function toggleVideoRecording() {
  if (state.isVideoRecording) {
    stopVideoRecording();
  } else {
    startVideoRecording();
  }
}

export function startVideoRecording() {
  if (state.isVideoRecording) return;
  if (getAudioContext().state !== 'running') userStartAudio();
  if (!state.isRecording && !state.isPlaying) {
    alert('描画または再生が開始されていません。録画を開始できません。');
    return;
  }

  if (!state.mediaRecorder) {
    console.log('Initializing MediaRecorder for the first time...');
    try {
      const canvas = document.querySelector('canvas');
      const videoStream = canvas.captureStream(state.frameRateSlider.value());
      const audioContext = getAudioContext();

      // Route only the active source into a dedicated capture destination.
      const mediaStreamDestination = audioContext.createMediaStreamDestination();

      if (state.currentInputMode === 'mic') {
        state.mic.connect(mediaStreamDestination);
      } else if (state.soundFile) {
        state.soundFile.connect(mediaStreamDestination);
      }

      const audioStream = mediaStreamDestination.stream;

      if (audioStream.getAudioTracks().length === 0) {
        alert('エラー: 音声トラックをキャプチャできませんでした。');
        return;
      }

      const combinedStream = new MediaStream([
        videoStream.getVideoTracks()[0],
        audioStream.getAudioTracks()[0],
      ]);

      state.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp9,opus',
      });

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) state.recordedChunks.push(event.data);
      };

      state.mediaRecorder.onstop = () => {
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style = 'display: none';
        a.href = url;
        a.download = generateTimestampedFilename('webm');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        state.recordedChunks = [];
        console.log('Video file saved.');
      };
    } catch (err) {
      console.error('Failed to initialize MediaRecorder:', err);
      alert('動画の録画機能の初期化に失敗しました。お使いのブラウザが対応していない可能性があります。');
      return;
    }
  }

  state.recordedChunks = [];
  state.mediaRecorder.start();
  state.isVideoRecording = true;
  select('#video-record-btn').html('録画停止 (V)').addClass('active');
  console.log('Video recording started.');
}

export function stopVideoRecording() {
  if (state.isVideoRecording) {
    state.mediaRecorder.stop();
    state.isVideoRecording = false;
    select('#video-record-btn').html('録画開始 (V)').removeClass('active');
    console.log('Video recording stopped.');
  }
}
