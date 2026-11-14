export type ReelCaptionSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type ReelCaptionStyle = 'kinetic' | 'karaoke' | 'classic';
export type ReelAudioPreset = 'original' | 'voice-clarity' | 'warm-studio' | 'bass-boost' | 'volume-boost';
export type ReelVideoPreset = 'original' | 'balanced' | 'bright' | 'vivid';
export type ReelEnhancementOptions = {
  audioPreset: ReelAudioPreset;
  videoPreset: ReelVideoPreset;
};
export type ReelCameraMove = 'none' | 'push-in' | 'pan-left' | 'pan-right' | 'float';
export type ReelCameraTransform = { zoom: number; offsetX: number; offsetY: number };

const AUTO_CAMERA_MOVES: ReelCameraMove[] = ['push-in', 'pan-left', 'float', 'pan-right'];

export function getReelVideoFilter(preset: ReelVideoPreset): string {
  switch (preset) {
    case 'balanced':
      return 'brightness(1.06) contrast(1.12) saturate(1.14)';
    case 'bright':
      return 'brightness(1.18) contrast(1.08) saturate(1.1)';
    case 'vivid':
      return 'contrast(1.16) saturate(1.38)';
    default:
      return 'none';
  }
}

export function getCaptionWordIndex(wordCount: number, progress: number): number {
  if (wordCount <= 0) return -1;
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return Math.min(wordCount - 1, Math.floor(boundedProgress * wordCount));
}

function wrapWords(
  context: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let rowWidth = 0;

  for (const word of words) {
    const wordWidth = context.measureText(word).width;
    const nextWidth = rowWidth + (row.length ? context.measureText(' ').width : 0) + wordWidth;
    if (row.length && nextWidth > maxWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    rowWidth += (row.length ? context.measureText(' ').width : 0) + wordWidth;
    row.push(word);
  }

  if (row.length) rows.push(row);
  return rows;
}

function drawCaption(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  segment: ReelCaptionSegment | undefined,
  style: ReelCaptionStyle,
  progress: number,
) {
  if (!segment?.text.trim()) return;

  const fontSize = Math.max(24, Math.round(height * 0.044));
  const lineHeight = Math.round(fontSize * 1.24);
  const paddingX = Math.round(fontSize * 0.72);
  const paddingY = Math.round(fontSize * 0.42);
  const words = segment.text.trim().split(/\s+/);
  const activeWordIndex = getCaptionWordIndex(words.length, progress);
  const displayedWords = style === 'kinetic' ? [words[activeWordIndex]] : words;
  context.font = `800 ${fontSize}px system-ui, sans-serif`;
  const rows = wrapWords(context, displayedWords, width * 0.82 - paddingX * 2);
  const boxWidth = Math.min(width * 0.9, Math.max(...rows.map((row) =>
    row.reduce((sum, word, index) => sum + context.measureText(word).width + (index ? context.measureText(' ').width : 0), 0)
  )) + paddingX * 2);
  const boxHeight = rows.length * lineHeight + paddingY * 2;
  const centerX = width / 2;
  const centerY = height * 0.77;
  const scale = style === 'kinetic' ? 0.94 + Math.sin(progress * Math.PI) * 0.08 : 1;

  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.fillStyle = style === 'kinetic' ? '#c026d3' : 'rgba(0, 0, 0, 0.76)';
  const left = -boxWidth / 2;
  const top = -boxHeight / 2;
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(left, top, boxWidth, boxHeight, Math.round(fontSize * 0.42));
  } else {
    context.rect(left, top, boxWidth, boxHeight);
  }
  context.fill();

  let wordOffset = 0;
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum, word, index) => sum + context.measureText(word).width + (index ? context.measureText(' ').width : 0), 0);
    let x = -rowWidth / 2;
    const y = top + paddingY + lineHeight * (rowIndex + 0.82);
    row.forEach((word, wordIndex) => {
      const globalWordIndex = wordOffset + wordIndex;
      const wordWidth = context.measureText(word).width;
      context.fillStyle = style === 'karaoke' && globalWordIndex === activeWordIndex
        ? '#fde047'
        : '#ffffff';
      context.shadowColor = 'rgba(0, 0, 0, 0.45)';
      context.shadowBlur = style === 'classic' ? fontSize * 0.3 : 0;
      context.fillText(word, x, y);
      x += wordWidth + context.measureText(' ').width;
    });
    wordOffset += row.length;
  });
  context.restore();
}

function getMoveTransform(
  cameraMove: ReelCameraMove,
  progress: number,
  time: number,
  width: number,
  height: number,
): ReelCameraTransform {
  const easedProgress = progress * progress * (3 - 2 * progress);
  if (cameraMove === 'push-in') {
    return { zoom: 1 + easedProgress * 0.14, offsetX: 0, offsetY: 0 };
  }
  if (cameraMove === 'pan-left') {
    return { zoom: 1.18, offsetX: (0.5 - easedProgress) * width * 0.16, offsetY: 0 };
  }
  if (cameraMove === 'pan-right') {
    return { zoom: 1.18, offsetX: (easedProgress - 0.5) * width * 0.16, offsetY: 0 };
  }
  if (cameraMove === 'float') {
    return {
      zoom: 1.12,
      offsetX: Math.sin(time * 0.55) * width * 0.025,
      offsetY: Math.cos(time * 0.42) * height * 0.018,
    };
  }
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

function blendTransforms(from: ReelCameraTransform, to: ReelCameraTransform, progress: number): ReelCameraTransform {
  const easedProgress = progress * progress * (3 - 2 * progress);
  return {
    zoom: from.zoom + (to.zoom - from.zoom) * easedProgress,
    offsetX: from.offsetX + (to.offsetX - from.offsetX) * easedProgress,
    offsetY: from.offsetY + (to.offsetY - from.offsetY) * easedProgress,
  };
}

export function getAutoCameraTransform(
  enabled: boolean,
  time: number,
  duration: number,
  width: number,
  height: number,
): ReelCameraTransform {
  const identity = { zoom: 1, offsetX: 0, offsetY: 0 };
  if (!enabled || duration <= 0 || width <= 0 || height <= 0) return identity;

  const segmentDuration = duration / AUTO_CAMERA_MOVES.length;
  const boundedTime = Math.max(0, Math.min(time, duration));
  const index = Math.min(AUTO_CAMERA_MOVES.length - 1, Math.floor(boundedTime / segmentDuration));
  const localTime = boundedTime - index * segmentDuration;
  const localProgress = Math.min(1, localTime / segmentDuration);
  const transitionDuration = Math.min(0.8, segmentDuration * 0.22);
  const currentMove = AUTO_CAMERA_MOVES[index];

  const timeRemaining = segmentDuration - localTime;
  if (index < AUTO_CAMERA_MOVES.length - 1 && timeRemaining < transitionDuration) {
    const nextMove = AUTO_CAMERA_MOVES[index + 1];
    const from = getMoveTransform(currentMove, 1, localTime, width, height);
    const to = getMoveTransform(nextMove, 0, localTime, width, height);
    return blendTransforms(from, to, 1 - timeRemaining / transitionDuration);
  }

  return getMoveTransform(currentMove, localProgress, localTime, width, height);
}

function drawCameraFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  transform: ReelCameraTransform,
) {
  const drawWidth = width * transform.zoom;
  const drawHeight = height * transform.zoom;
  context.drawImage(
    video,
    (width - drawWidth) / 2 + transform.offsetX,
    (height - drawHeight) / 2 + transform.offsetY,
    drawWidth,
    drawHeight,
  );
}

export async function renderCaptionedReel(
  sourceUrl: string,
  segments: ReelCaptionSegment[],
  style: ReelCaptionStyle,
  cameraAnimationEnabled = false,
  onProgress: (progress: number) => void = () => {},
  enhancements: ReelEnhancementOptions = { audioPreset: 'original', videoPreset: 'original' },
): Promise<Blob> {
  const hasEnhancements = enhancements.audioPreset !== 'original' || enhancements.videoPreset !== 'original';
  if (!segments.length && !cameraAnimationEnabled && !hasEnhancements) throw new Error('There are no effects to render.');
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot process reel effects.');

  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.src = sourceUrl;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser cannot process reel effects.');
  }

  let audioContext: AudioContext | null = null;
  let outputStream: MediaStream | null = null;
  let drawTimer: number | null = null;
  let recorder: MediaRecorder | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('The recorded video could not be loaded.')), { once: true });
      video.load();
    });

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('The recorded video has no readable frames.');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const canvasStream = canvas.captureStream(30);
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('This browser cannot preserve audio while rendering reel effects.');
    }
    const tracks = [...canvasStream.getVideoTracks()];

    audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    connectReelAudioEffects(audioContext, source, destination, enhancements.audioPreset);
    tracks.push(...destination.stream.getAudioTracks());

    outputStream = new MediaStream(tracks);
    const mimeCandidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    recorder = mimeType ? new MediaRecorder(outputStream, { mimeType }) : new MediaRecorder(outputStream);

    const recordedBlob = new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      recorder!.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder!.onerror = () => reject(new Error('Reel effect rendering failed.'));
      recorder!.onstop = () => {
        if (!chunks.length) {
          reject(new Error('No video was produced. Please try again.'));
          return;
        }
        resolve(new Blob(chunks, { type: recorder!.mimeType || mimeType || 'video/webm' }));
      };
    });

    const playbackFinished = new Promise<void>((resolve, reject) => {
      video.addEventListener('ended', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Video playback failed during reel effect rendering.')), { once: true });
    });
    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const currentTime = video.currentTime;
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        const cameraTransform = getAutoCameraTransform(
          cameraAnimationEnabled,
          currentTime,
          duration,
          canvas.width,
          canvas.height,
        );
        context.save();
        context.filter = getReelVideoFilter(enhancements.videoPreset);
        drawCameraFrame(context, video, canvas.width, canvas.height, cameraTransform);
        context.restore();
        const activeSegment = segments.find((segment) => currentTime >= segment.start && currentTime <= segment.end);
        const captionProgress = activeSegment
          ? Math.max(0, Math.min(1, (currentTime - activeSegment.start) / Math.max(0.2, activeSegment.end - activeSegment.start)))
          : 0;
        drawCaption(context, canvas.width, canvas.height, activeSegment, style, captionProgress);
      }
    };

    video.addEventListener('timeupdate', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        onProgress(Math.min(100, Math.round((video.currentTime / video.duration) * 100)));
      }
    });
    video.currentTime = 0;
    recorder.start(250);
    drawFrame();
    drawTimer = window.setInterval(drawFrame, 1000 / 30);
    await audioContext?.resume();
    await video.play();
    await playbackFinished;
    if (recorder.state !== 'inactive') recorder.stop();
    const result = await recordedBlob;
    onProgress(100);
    return result;
  } catch (error) {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    throw error;
  } finally {
    if (drawTimer !== null) window.clearInterval(drawTimer);
    video.pause();
    video.removeAttribute('src');
    video.load();
    outputStream?.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== 'closed') await audioContext.close();
  }
}

export function connectReelAudioEffects(
  context: AudioContext,
  source: MediaElementAudioSourceNode,
  destination: AudioNode,
  preset: ReelAudioPreset,
): AudioNode[] {
  const connectedNodes: AudioNode[] = [];
  if (preset === 'original') {
    source.connect(destination);
    return connectedNodes;
  }

  let lastNode: AudioNode = source;
  const connectFilter = (filter: BiquadFilterNode) => {
    lastNode.connect(filter);
    lastNode = filter;
    connectedNodes.push(filter);
    return filter;
  };
  const connectCompressor = (threshold: number, ratio: number) => {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = threshold;
    compressor.knee.value = 18;
    compressor.ratio.value = ratio;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    lastNode.connect(compressor);
    lastNode = compressor;
    connectedNodes.push(compressor);
  };
  const addGain = (value: number) => {
    const gain = context.createGain();
    gain.gain.value = value;
    lastNode.connect(gain);
    lastNode = gain;
    connectedNodes.push(gain);
  };

  if (preset === 'voice-clarity' || preset === 'warm-studio') {
    const highPass = connectFilter(context.createBiquadFilter());
    highPass.type = 'highpass';
    highPass.frequency.value = preset === 'voice-clarity' ? 100 : 55;
    highPass.Q.value = 0.7;
  }

  if (preset === 'warm-studio' || preset === 'bass-boost') {
    const bass = connectFilter(context.createBiquadFilter());
    bass.type = 'lowshelf';
    bass.frequency.value = preset === 'warm-studio' ? 150 : 120;
    bass.gain.value = preset === 'warm-studio' ? 3 : 8;
  }

  if (preset === 'voice-clarity' || preset === 'warm-studio') {
    const presence = connectFilter(context.createBiquadFilter());
    presence.type = 'peaking';
    presence.frequency.value = preset === 'voice-clarity' ? 2800 : 3200;
    presence.Q.value = 0.9;
    presence.gain.value = preset === 'voice-clarity' ? 4.5 : 2;
  }

  if (preset === 'voice-clarity') connectCompressor(-28, 3);
  if (preset === 'warm-studio' || preset === 'bass-boost') connectCompressor(-25, 2.5);
  if (preset === 'volume-boost') connectCompressor(-28, 4);
  if (preset === 'voice-clarity') addGain(1.08);
  if (preset === 'bass-boost') addGain(1.03);
  if (preset === 'volume-boost') {
    addGain(1.5);
    connectCompressor(-4, 12);
  }

  if (preset === 'warm-studio') {
    const dryGain = context.createGain();
    dryGain.gain.value = 0.92;
    lastNode.connect(dryGain);
    dryGain.connect(destination);
    connectedNodes.push(dryGain);

    const reverb = context.createConvolver();
    reverb.buffer = createRoomImpulse(context);
    const wetGain = context.createGain();
    wetGain.gain.value = 0.14;
    lastNode.connect(reverb);
    reverb.connect(wetGain);
    wetGain.connect(destination);
    connectedNodes.push(reverb, wetGain);
    return connectedNodes;
  }

  lastNode.connect(destination);
  return connectedNodes;
}

function createRoomImpulse(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * 0.24));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const decay = Math.pow(1 - index / length, 3);
      data[index] = (Math.random() * 2 - 1) * decay * 0.18;
    }
  }
  return impulse;
}