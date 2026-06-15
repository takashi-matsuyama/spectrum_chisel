// Video recording: captures the canvas plus the active audio source into a
// downloadable WebM file.
//
// One recording owns one MediaRecorder and one capture graph for its whole
// lifetime. The graph (canvas capture stream + audio destination + the source
// connection) is built when recording starts and torn down when it stops, so
// nothing leaks across repeated record/reset cycles. Because onstop fires
// asynchronously, the output filename is captured at stop time and the recorded
// chunks live in the session closure, so a reset that clears the app state in
// the meantime cannot empty or misname the saved file.

import { state } from './state.js';
import { generateTimestampedFilename } from './export.js';
import { t, applyLabel } from './i18n/index.js';

// Filename captured when the current recording stops, while the session state
// (id, frame count) is still intact. onstop reads it after the async flush.
let pendingFilename = null;

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
    alert(t('alertNotStarted'));
    return;
  }

  let videoStream = null;
  let destination = null;
  let sourceNode = null;
  try {
    const canvas = document.querySelector('canvas');
    videoStream = canvas.captureStream(state.frameRateSlider.value());

    // Route only the active source into a dedicated capture destination.
    destination = getAudioContext().createMediaStreamDestination();
    if (state.currentInputMode === 'mic') {
      sourceNode = state.mic;
    } else if (state.soundFile) {
      sourceNode = state.soundFile;
    }
    if (sourceNode) sourceNode.connect(destination);

    const audioStream = destination.stream;
    if (audioStream.getAudioTracks().length === 0) {
      releaseCaptureGraph(videoStream, destination, sourceNode);
      alert(t('alertNoAudioTrack'));
      return;
    }

    const combinedStream = new MediaStream([
      videoStream.getVideoTracks()[0],
      audioStream.getAudioTracks()[0],
    ]);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm; codecs=vp9,opus',
    });

    // Per-session chunks so a concurrent reset cannot empty them.
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.className = 'hidden';
      a.href = url;
      a.download = pendingFilename || generateTimestampedFilename('webm');
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      pendingFilename = null;
      // Release the capture graph so nothing leaks between recordings.
      releaseCaptureGraph(videoStream, destination, sourceNode);
      state.mediaRecorder = null;
      console.log('Video file saved.');
    };

    state.mediaRecorder = recorder;
    recorder.start();
    state.isVideoRecording = true;
    const btn = select('#video-record-btn');
    applyLabel(btn, 'stopVideoRec');
    btn.addClass('active');
    console.log('Video recording started.');
  } catch (err) {
    console.error('Failed to initialize MediaRecorder:', err);
    releaseCaptureGraph(videoStream, destination, sourceNode);
    alert(t('alertVideoInit'));
  }
}

export function stopVideoRecording() {
  if (!state.isVideoRecording) return;
  // Capture the filename now, while the session id and frame count are still
  // intact; onstop fires later, possibly after a reset has cleared that state.
  pendingFilename = generateTimestampedFilename('webm');
  state.mediaRecorder.stop();
  state.isVideoRecording = false;
  const btn = select('#video-record-btn');
  applyLabel(btn, 'startVideoRec');
  btn.removeClass('active');
  console.log('Video recording stopped.');
}

/**
 * Tear down a recording's capture graph: detach the source from the capture
 * destination (without touching its connection to the live analyzer/output) and
 * stop the canvas capture stream tracks. Guarded so partial graphs are safe.
 */
function releaseCaptureGraph(videoStream, destination, sourceNode) {
  try {
    // Disconnect only the edge we added (source.output -> destination), so the
    // source stays connected to the FFT and master output.
    if (sourceNode && sourceNode.output && destination) sourceNode.output.disconnect(destination);
  } catch {
    // The edge may already be gone; ignore.
  }
  try {
    if (videoStream) videoStream.getTracks().forEach((track) => track.stop());
  } catch {
    // Tracks may already be stopped; ignore.
  }
}
