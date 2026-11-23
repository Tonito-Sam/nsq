import type { AutomaticSpeechRecognitionOutput } from '@huggingface/transformers';
import {
  createPodcastCaptionPhrases,
  createPodcastShortTranscriber,
  decodePodcastSpeechAudio,
  renderPodcastShortCaptions,
} from './podcastShortCaptioning';

export const PODCAST_SHORT_DURATION_SECONDS = 55;
export const PODCAST_SHORT_COUNT = 3;
export const PODCAST_SHORT_OUTRO_DURATION_SECONDS = 3;
export const PODCAST_SHORT_CONTENT_DURATION_SECONDS =
  PODCAST_SHORT_DURATION_SECONDS - PODCAST_SHORT_OUTRO_DURATION_SECONDS;

const PODSHORT_FRAME_WIDTH = 720;
const PODSHORT_FRAME_HEIGHT = 1280;
const PODSHORT_OUTRO_ARTWORK_URL = new URL(
  '../../podcast intro soundtracks/Instagram Reel (9 16)@1x.png',
  import.meta.url,
).href;

export type PodcastShortSegment = {
  index: number;
  startSeconds: number;
  blob: Blob;
  captionsApplied: boolean;
};

export type PodcastShortsProgressPhase =
  | 'measuring'
  | 'loadingModel'
  | 'extracting'
  | 'transcribing'
  | 'renderingCaptions';

export const getPodcastVideoDuration = (
  mediaDuration: number,
  recordedDuration: number,
  seekableEnd: number,
) => [mediaDuration, recordedDuration, seekableEnd]
    .find((candidate) => Number.isFinite(candidate) && candidate > 0);

export const getPodcastShortStartTimes = (
  durationSeconds: number,
  segmentDurationSeconds = PODCAST_SHORT_DURATION_SECONDS,
  count = PODCAST_SHORT_COUNT,
) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Could not determine the episode length. Refresh the episode or re-record it before creating Podshorts.');
  }
  if (durationSeconds < segmentDurationSeconds) {
    throw new Error(`This episode is ${Math.floor(durationSeconds)} seconds long. It must be at least ${segmentDurationSeconds} seconds for a Podshort.`);
  }
  if (count < 1) return [];

  const lastStart = durationSeconds - segmentDurationSeconds;
  if (count > 1 && lastStart === 0) {
    throw new Error(`The episode must be longer than ${segmentDurationSeconds} seconds to create clips from different points.`);
  }
  if (count === 1) return [lastStart / 2];
  return Array.from({ length: count }, (_, index) => (lastStart * index) / (count - 1));
};

const drawPortraitVideoFrame = (video: HTMLVideoElement, context: CanvasRenderingContext2D) => {
  const { videoWidth, videoHeight } = video;
  context.fillStyle = '#09090b';
  context.fillRect(0, 0, PODSHORT_FRAME_WIDTH, PODSHORT_FRAME_HEIGHT);
  if (!videoWidth || !videoHeight) return;

  const sourceAspect = videoWidth / videoHeight;
  const targetAspect = PODSHORT_FRAME_WIDTH / PODSHORT_FRAME_HEIGHT;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;
  if (sourceAspect > targetAspect) {
    sourceWidth = videoHeight * targetAspect;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetAspect;
    sourceY = (videoHeight - sourceHeight) / 2;
  }
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    PODSHORT_FRAME_WIDTH,
    PODSHORT_FRAME_HEIGHT,
  );
};

const wrapCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const loadPodcastOutroArtwork = () => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not load the Podshort subscribe-card design.'));
  image.src = PODSHORT_OUTRO_ARTWORK_URL;
});

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
};

const drawPodshortOutro = (
  context: CanvasRenderingContext2D,
  channelName: string,
  artwork: HTMLImageElement,
) => {
  context.drawImage(artwork, 0, 0, PODSHORT_FRAME_WIDTH, PODSHORT_FRAME_HEIGHT);

  const contentCover = context.createLinearGradient(22, 270, 690, 630);
  contentCover.addColorStop(0, 'rgba(34, 11, 72, 0.98)');
  contentCover.addColorStop(0.5, 'rgba(10, 4, 20, 0.98)');
  contentCover.addColorStop(1, 'rgba(8, 3, 18, 0.97)');
  context.fillStyle = contentCover;
  context.fillRect(28, 270, 664, 355);

  const channelTitle = channelName.trim() || 'Podcast channel';
  let titleSize = 82;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.font = `800 ${titleSize}px Arial, sans-serif`;
  let titleLines = wrapCanvasText(context, channelTitle, PODSHORT_FRAME_WIDTH * 0.85);
  while (titleLines.length > 2 && titleSize > 50) {
    titleSize -= 4;
    context.font = `800 ${titleSize}px Arial, sans-serif`;
    titleLines = wrapCanvasText(context, channelTitle, PODSHORT_FRAME_WIDTH * 0.85);
  }
  if (titleLines.length > 2) {
    titleLines = titleLines.slice(0, 2);
    titleLines[1] = `${titleLines[1].replace(/[.…]+$/, '')}…`;
  }
  const titleLineHeight = titleSize * 0.94;
  titleLines.forEach((line, index) => {
    context.fillStyle = index % 2 === 0 ? '#ffffff' : '#bd55ed';
    context.font = `800 ${titleSize}px Arial, sans-serif`;
    context.fillText(line, 54, 350 + index * titleLineHeight);
  });

  context.fillStyle = '#e7dcff';
  context.font = '600 25px Arial, sans-serif';
  const subscribeLines = wrapCanvasText(
    context,
    `Subscribe to ${channelTitle} to watch the full episode.`,
    PODSHORT_FRAME_WIDTH * 0.88,
  ).slice(0, 2);
  subscribeLines.forEach((line, index) => context.fillText(line, 54, 525 + index * 34));

  const actionCover = context.createLinearGradient(0, 975, 0, 1080);
  actionCover.addColorStop(0, 'rgba(8, 3, 18, 0.96)');
  actionCover.addColorStop(1, 'rgba(21, 7, 37, 0.98)');
  context.fillStyle = actionCover;
  context.fillRect(35, 973, 650, 105);

  const buttonGradient = context.createLinearGradient(52, 990, 260, 1050);
  buttonGradient.addColorStop(0, '#8138ed');
  buttonGradient.addColorStop(1, '#cb54ea');
  drawRoundedRect(context, 52, 991, 210, 58, 29);
  context.fillStyle = buttonGradient;
  context.fill();
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.font = '700 25px Arial, sans-serif';
  context.fillText('SUBSCRIBE', 85, 1020);
  context.fillStyle = '#d7bcff';
  context.font = '600 19px Arial, sans-serif';
  context.fillText(channelTitle, 282, 1020);
};

const waitForMetadata = (video: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    resolve();
    return;
  }
  const cleanup = () => {
    video.removeEventListener('loadedmetadata', onLoaded);
    video.removeEventListener('error', onError);
  };
  const onLoaded = () => {
    cleanup();
    resolve();
  };
  const onError = () => {
    cleanup();
    reject(new Error('Could not load the podcast episode for clip extraction.'));
  };
  video.addEventListener('loadedmetadata', onLoaded, { once: true });
  video.addEventListener('error', onError, { once: true });
});

const restartAtBeginning = (video: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
  if (video.currentTime < 0.05 && !video.ended) {
    resolve();
    return;
  }

  let timeoutId = 0;
  const cleanup = () => {
    window.clearTimeout(timeoutId);
    video.removeEventListener('seeked', onSeeked);
    video.removeEventListener('error', onError);
  };
  const onSeeked = () => {
    cleanup();
    resolve();
  };
  const onError = () => {
    cleanup();
    reject(new Error('Could not restart the episode after measuring its duration.'));
  };
  video.addEventListener('seeked', onSeeked, { once: true });
  video.addEventListener('error', onError, { once: true });
  timeoutId = window.setTimeout(() => {
    cleanup();
    reject(new Error('Could not restart the episode after measuring its duration.'));
  }, 15_000);
  try {
    video.currentTime = 0;
    if (video.currentTime < 0.05 && !video.seeking) {
      cleanup();
      resolve();
    }
  } catch {
    cleanup();
    reject(new Error('Could not restart the episode after measuring its duration.'));
  }
});

const advanceToTime = (video: HTMLVideoElement, timeSeconds: number) => new Promise<void>((resolve, reject) => {
  if (video.currentTime >= timeSeconds - 0.05) {
    resolve();
    return;
  }

  const originalMuted = video.muted;
  const originalPlaybackRate = video.playbackRate;
  let animationFrameId: number | null = null;
  let timeoutId = 0;
  let settled = false;
  const cleanup = () => {
    window.clearTimeout(timeoutId);
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    video.removeEventListener('timeupdate', onProgress);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('waiting', onWaiting);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('error', onError);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    video.pause();
    video.muted = originalMuted;
    video.playbackRate = originalPlaybackRate;
    resolve();
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    video.pause();
    video.muted = originalMuted;
    video.playbackRate = originalPlaybackRate;
    reject(error);
  };
  const checkProgress = () => {
    if (video.currentTime >= timeSeconds - 0.05) {
      finish();
      return;
    }
    animationFrameId = window.requestAnimationFrame(checkProgress);
  };
  const onProgress = () => {
    if (video.currentTime >= timeSeconds - 0.05) finish();
  };
  const onPlaying = () => {
    if (animationFrameId === null) {
      animationFrameId = window.requestAnimationFrame(checkProgress);
    }
  };
  const onWaiting = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };
  const onEnded = () => fail(new Error('The episode ended before the next Podshort segment.'));
  const onError = () => fail(new Error('Could not play through the episode to reach the next Podshort segment.'));

  video.addEventListener('timeupdate', onProgress);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('ended', onEnded, { once: true });
  video.addEventListener('error', onError, { once: true });
  timeoutId = window.setTimeout(
    () => fail(new Error('Fast-forwarding to the next Podshort segment timed out. Please try again.')),
    10 * 60 * 1000,
  );
  video.muted = true;
  video.playbackRate = 8;
  void video.play().catch(() => fail(new Error('Could not play through the episode to reach the next Podshort segment.')));
});

const measureDurationByPlayback = (
  video: HTMLVideoElement,
  onProgress?: (scannedSeconds: number) => void,
) => new Promise<number>((resolve, reject) => {
  let timeoutId = 0;
  const cleanup = () => {
    window.clearTimeout(timeoutId);
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('error', onError);
  };
  const fail = (error: Error) => {
    cleanup();
    video.pause();
    reject(error);
  };
  const onTimeUpdate = () => onProgress?.(Math.floor(video.currentTime));
  const onEnded = () => {
    const duration = video.currentTime;
    cleanup();
    if (!Number.isFinite(duration) || duration <= 0) {
      reject(new Error('Could not determine the episode length from playback.'));
    } else {
      resolve(duration);
    }
  };
  const onError = () => fail(new Error('Could not play through the episode to measure its length.'));
  timeoutId = window.setTimeout(
    () => fail(new Error('Measuring the episode length timed out. Please try again.')),
    10 * 60 * 1000,
  );

  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended', onEnded, { once: true });
  video.addEventListener('error', onError, { once: true });
  try {
    video.muted = true;
    video.playbackRate = 8;
    video.currentTime = 0;
    void video.play().catch(() => fail(new Error('Could not play through the episode to measure its length.')));
  } catch {
    fail(new Error('Could not start playback to measure the episode length.'));
  }
});

const recordSegment = (
  video: HTMLVideoElement,
  canvasContext: CanvasRenderingContext2D,
  stream: MediaStream,
  mimeType: string,
  startSeconds: number,
  channelName: string,
  outroArtwork: HTMLImageElement,
) => new Promise<{ blob: Blob; audioBlob: Blob }>((resolve, reject) => {
  const recorder = new MediaRecorder(stream, { mimeType });
  const audioStream = new MediaStream(stream.getAudioTracks());
  const audioRecorder = new MediaRecorder(audioStream);
  const chunks: Blob[] = [];
  const audioChunks: Blob[] = [];
  const endSeconds = startSeconds + PODCAST_SHORT_CONTENT_DURATION_SECONDS;
  let settled = false;
  let videoBlob: Blob | null = null;
  let audioBlob: Blob | null = null;
  let audioRecorderStopped = false;
  let timeoutId = 0;
  let outroTimerId = 0;
  let animationFrameId: number | null = null;
  let outroStarted = false;

  const cleanup = () => {
    window.clearTimeout(timeoutId);
    window.clearTimeout(outroTimerId);
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('ended', onEnded);
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    if (audioRecorder.state !== 'inactive') audioRecorder.stop();
    reject(error);
  };
  const maybeComplete = () => {
    if (settled || !videoBlob || !audioBlob || !audioRecorderStopped) return;
    settled = true;
    resolve({ blob: videoBlob, audioBlob });
  };
  const drawFrame = () => {
    if (settled) return;
    if (outroStarted) drawPodshortOutro(canvasContext, channelName, outroArtwork);
    else drawPortraitVideoFrame(video, canvasContext);
    animationFrameId = window.requestAnimationFrame(drawFrame);
  };
  const beginOutro = () => {
    if (settled || outroStarted) return;
    outroStarted = true;
    video.pause();
    if (audioRecorder.state !== 'inactive') audioRecorder.stop();
    drawPodshortOutro(canvasContext, channelName, outroArtwork);
    outroTimerId = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, PODCAST_SHORT_OUTRO_DURATION_SECONDS * 1000);
  };
  const onTimeUpdate = () => {
    if (video.currentTime >= endSeconds) beginOutro();
  };
  const onEnded = () => {
    if (video.currentTime < endSeconds - 0.1) {
      fail(new Error(`The episode ended before a full ${PODCAST_SHORT_DURATION_SECONDS}-second clip could be extracted.`));
    } else beginOutro();
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => fail(new Error('The browser could not encode this Podshort.'));
  audioRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };
  audioRecorder.onerror = () => fail(new Error('The browser could not capture audio for Podshort captions.'));
  audioRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: audioRecorder.mimeType });
    audioRecorderStopped = true;
    maybeComplete();
  };
  recorder.onstop = () => {
    if (settled) return;
    cleanup();
    videoBlob = new Blob(chunks, { type: recorder.mimeType || mimeType });
    if (videoBlob.size === 0) {
      fail(new Error('The browser produced an empty clip.'));
      return;
    }
    maybeComplete();
  };

  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended', onEnded);
  timeoutId = window.setTimeout(
    () => fail(new Error('Clip extraction timed out. Please try again.')),
    90_000,
  );

  try {
    drawFrame();
    audioRecorder.start(250);
    recorder.start(250);
    void video.play().catch(() => fail(new Error('Could not play the episode for clip extraction.')));
  } catch {
    fail(new Error('The browser could not start recording this Podshort.'));
  }
});

export async function extractPodcastShorts(
  videoUrl: string,
  onProgress?: (
    completed: number,
    total: number,
    phase: PodcastShortsProgressPhase,
    scannedSeconds: number,
    modelProgress?: number,
  ) => void,
  recordedDurationSeconds = 0,
  channelName = 'Podcast channel',
): Promise<PodcastShortSegment[]> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support in-browser clip extraction.');
  }

  const mimeType = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) throw new Error('This browser does not support a compatible video format.');

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = false;
  video.playsInline = true;

  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    throw new Error('This browser does not support audio capture for Podshort creation.');
  }
  const audioContext = new AudioContextConstructor();
  let audioSource: MediaElementAudioSourceNode | null = null;
  let transcriber: ReturnType<typeof createPodcastShortTranscriber> | null = null;

  try {
    audioSource = audioContext.createMediaElementSource(video);
    const audioDestination = audioContext.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    const audioContextReady = audioContext.resume();
    const metadataReady = waitForMetadata(video);
    video.src = videoUrl;
    video.load();

    await Promise.all([metadataReady, audioContextReady]);
    const seekableEnd = video.seekable.length > 0
      ? video.seekable.end(video.seekable.length - 1)
      : Number.NaN;
    let duration = getPodcastVideoDuration(video.duration, recordedDurationSeconds, seekableEnd);
    if (duration === undefined) {
      const originalMuted = video.muted;
      const originalPlaybackRate = video.playbackRate;
      onProgress?.(0, PODCAST_SHORT_COUNT, 'measuring', 0);
      try {
        duration = await measureDurationByPlayback(video, (scannedSeconds) => {
          onProgress?.(0, PODCAST_SHORT_COUNT, 'measuring', scannedSeconds);
        });
      } finally {
        video.pause();
        video.muted = originalMuted;
        video.playbackRate = originalPlaybackRate;
      }
      await restartAtBeginning(video);
    }
    const startTimes = getPodcastShortStartTimes(duration, PODCAST_SHORT_CONTENT_DURATION_SECONDS);
    onProgress?.(0, startTimes.length, 'loadingModel', 0, 0);
    transcriber = createPodcastShortTranscriber((progress) => {
      onProgress?.(0, startTimes.length, 'loadingModel', 0, progress);
    });
    await transcriber.prepare();
    onProgress?.(0, startTimes.length, 'loadingModel', 0, 100);
    const outroArtwork = await loadPodcastOutroArtwork();
    onProgress?.(0, startTimes.length, 'extracting', duration);
    const canvas = document.createElement('canvas');
    canvas.width = PODSHORT_FRAME_WIDTH;
    canvas.height = PODSHORT_FRAME_HEIGHT;
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) {
      throw new Error('Could not prepare the portrait video canvas for Podshort creation.');
    }
    if (typeof canvas.captureStream !== 'function') {
      throw new Error('This browser cannot capture video for Podshort creation.');
    }

    const canvasStream = canvas.captureStream(30);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    try {
      const rawSegments: Array<{ index: number; startSeconds: number; blob: Blob }> = [];
      const transcriptionResults: Array<Promise<
        | { chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']> }
        | { error: Error }
      >> = [];
      for (let index = 0; index < startTimes.length; index += 1) {
        const startSeconds = startTimes[index];
        await advanceToTime(video, startSeconds);
        const recording = await recordSegment(video, canvasContext, stream, mimeType, startSeconds, channelName, outroArtwork);
        rawSegments.push({ index, startSeconds, blob: recording.blob });
        const transcriptionResult = decodePodcastSpeechAudio(recording.audioBlob)
          .then((samples) => transcriber!.transcribe(samples))
          .then((chunks) => ({ chunks }) as const)
          .catch((error: unknown) => ({
            error: error instanceof Error ? error : new Error('Could not transcribe speech from a Podshort.'),
          }) as const);
        transcriptionResults.push(transcriptionResult);
        onProgress?.(index + 1, startTimes.length, 'extracting', 0);
      }
      onProgress?.(0, rawSegments.length, 'transcribing', 0);
      const transcriptions = await Promise.all(transcriptionResults);
      const captionedSegments: PodcastShortSegment[] = [];
      for (let index = 0; index < rawSegments.length; index += 1) {
        const result = transcriptions[index];
        if ('error' in result) throw result.error;
        const hasCaptions = createPodcastCaptionPhrases(result.chunks).length > 0;
        const rawSegment = rawSegments[index];
        const blob = hasCaptions
          ? await renderPodcastShortCaptions(rawSegment.blob, result.chunks, (progress) => {
            onProgress?.(index + progress, rawSegments.length, 'renderingCaptions', 0);
          })
          : rawSegment.blob;
        captionedSegments.push({
          ...rawSegment,
          blob,
          captionsApplied: hasCaptions,
        });
        onProgress?.(index + 1, rawSegments.length, 'renderingCaptions', 0);
      }
      return captionedSegments;
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      canvasStream.getTracks().forEach((track) => track.stop());
    }
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    audioSource?.disconnect();
    transcriber?.terminate();
    if (audioContext.state !== 'closed') await audioContext.close();
  }
}
