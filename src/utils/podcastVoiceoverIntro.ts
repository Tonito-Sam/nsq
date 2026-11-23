import {
  drawPodcastIntroFrame,
  drawPodcastOutroFrame,
  PODCAST_INTRO_DURATION_MS,
  PODCAST_OUTRO_DURATION_MS,
} from '@/utils/podcastIntroMontage';
import { connectReelAudioEffects, type ReelAudioPreset } from '@/utils/animatedReelCaptions';

type PodcastVoiceoverIntroOptions = {
  title: string;
  hostNames: string;
  soundtrackUrl: string;
  voiceover: File;
  soundtrackVolume: number;
  voiceoverVolume: number;
  voiceEffect: ReelAudioPreset;
  visualIntroUrl?: string | null;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
};

const loadImage = (source?: string | null) => new Promise<HTMLImageElement | null>((resolve, reject) => {
  if (!source) {
    resolve(null);
    return;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not load podcast cover or logo for the intro.'));
  image.src = source;
});

const drawVideoCover = (context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

export async function buildPodcastVoiceoverIntro({
  title,
  hostNames,
  soundtrackUrl,
  voiceover,
  soundtrackVolume,
  voiceoverVolume,
  voiceEffect,
  visualIntroUrl,
  coverImageUrl,
  logoImageUrl,
}: PodcastVoiceoverIntroOptions): Promise<File> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support creating a podcast voiceover intro.');
  }
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) throw new Error('Your browser does not support audio mixing for podcast intros.');

  const audioContext = new AudioContextConstructor();
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const canvasContext = canvas.getContext('2d');
  if (!canvasContext || typeof canvas.captureStream !== 'function') {
    await audioContext.close();
    throw new Error('Your browser does not support rendering the branded podcast intro.');
  }

  let canvasStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  const introVisual = document.createElement('video');
  introVisual.crossOrigin = 'anonymous';
  introVisual.muted = true;
  introVisual.loop = true;
  introVisual.playsInline = true;
  let animationFrame = 0;
  let stopTimer = 0;

  try {
    await audioContext.resume();
    const [soundtrackResponse, voiceoverBuffer, coverImage, logoImage] = await Promise.all([
      fetch(soundtrackUrl),
      voiceover.arrayBuffer(),
      loadImage(coverImageUrl),
      loadImage(logoImageUrl),
    ]);
    if (!soundtrackResponse.ok) throw new Error('Could not load the selected podcast soundtrack.');
    const [soundtrackData, voiceoverData] = await Promise.all([
      soundtrackResponse.arrayBuffer(),
      audioContext.decodeAudioData(voiceoverBuffer),
    ]);
    const soundtrackDataBuffer = await audioContext.decodeAudioData(soundtrackData);
    if (visualIntroUrl) {
      await new Promise<void>((resolve, reject) => {
        introVisual.onloadeddata = () => resolve();
        introVisual.onerror = () => reject(new Error('Could not load the selected intro video.'));
        introVisual.src = visualIntroUrl;
        introVisual.load();
      });
      await introVisual.play();
    }

    const destination = audioContext.createMediaStreamDestination();
    const voiceGain = audioContext.createGain();
    const soundtrackGain = audioContext.createGain();
    voiceGain.gain.value = Math.max(0, Math.min(1, voiceoverVolume / 100));
    soundtrackGain.gain.value = Math.max(0, Math.min(1, soundtrackVolume / 100));
    const voiceoverSource = audioContext.createBufferSource();
    const soundtrackSource = audioContext.createBufferSource();
    voiceoverSource.buffer = voiceoverData;
    soundtrackSource.buffer = soundtrackDataBuffer;
    soundtrackSource.loop = true;
    connectReelAudioEffects(audioContext, voiceoverSource, voiceGain, voiceEffect);
    voiceGain.connect(destination);
    soundtrackSource.connect(soundtrackGain).connect(destination);

    canvasStream = canvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const audioTrack = destination.stream.getAudioTracks()[0];
    if (!videoTrack || !audioTrack) throw new Error('Could not prepare audio and video tracks for the podcast intro.');

    const recordingStream = new MediaStream([videoTrack, audioTrack]);
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const recordingResult = new Promise<File>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onerror = () => reject(new Error('Could not render the podcast voiceover intro.'));
      recorder!.onstop = () => {
        if (!chunks.length) {
          reject(new Error('The rendered podcast intro was empty. Please try again.'));
          return;
        }
        const type = recorder!.mimeType || 'video/webm';
        const extension = type.includes('mp4') ? 'mp4' : 'webm';
        resolve(new File(chunks, `podcast-voiceover-intro.${extension}`, {
          type,
          lastModified: Date.now(),
        }));
      };
    });

    const blankVideo = document.createElement('video');
    let startedAt = 0;
    const drawFrame = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsedMs = Math.min(now - startedAt, PODCAST_INTRO_DURATION_MS);
      if (visualIntroUrl) {
        drawVideoCover(canvasContext, introVisual, canvas.width, canvas.height);
      } else {
        drawPodcastIntroFrame(
          canvasContext,
          blankVideo,
          canvas.width,
          canvas.height,
          elapsedMs,
          title,
          hostNames,
          coverImage,
          logoImage,
        );
      }
      if (elapsedMs < PODCAST_INTRO_DURATION_MS) animationFrame = window.requestAnimationFrame(drawFrame);
    };

    recorder.start(250);
    const audioStartTime = audioContext.currentTime + 0.05;
    soundtrackSource.start(audioStartTime);
    voiceoverSource.start(audioStartTime);
    soundtrackSource.stop(audioStartTime + PODCAST_INTRO_DURATION_MS / 1000);
    voiceoverSource.stop(audioStartTime + PODCAST_INTRO_DURATION_MS / 1000);
    animationFrame = window.requestAnimationFrame(drawFrame);
    stopTimer = window.setTimeout(() => {
      if (recorder?.state !== 'inactive') recorder?.stop();
    }, PODCAST_INTRO_DURATION_MS);

    return await recordingResult;
  } finally {
    window.clearTimeout(stopTimer);
    window.cancelAnimationFrame(animationFrame);
    introVisual.pause();
    introVisual.removeAttribute('src');
    canvasStream?.getTracks().forEach((track) => track.stop());
    await audioContext.close();
  }
}

export async function buildPodcastBrandedOutro({
  showName,
  hostNames,
  coverImageUrl,
  logoImageUrl,
  audioFile,
}: {
  showName: string;
  hostNames: string;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  audioFile?: File | null;
}): Promise<File> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support creating a podcast outro.');
  }
  const AudioContextConstructor = window.AudioContext;
  if (audioFile && !AudioContextConstructor) {
    throw new Error('Your browser does not support adding audio to a podcast outro.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.captureStream !== 'function') {
    throw new Error('Your browser does not support rendering a branded podcast outro.');
  }

  let audioContext: AudioContext | null = null;
  let audioStream: MediaStream | null = null;
  let canvasStream: MediaStream | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  let animationFrame = 0;
  let stopTimer = 0;

  try {
    const [coverImage, logoImage] = await Promise.all([
      loadImage(coverImageUrl),
      loadImage(logoImageUrl),
    ]);
    if (audioFile) {
      audioContext = new AudioContextConstructor();
      await audioContext.resume();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(await audioFile.arrayBuffer());
      } catch {
        throw new Error('Could not decode the selected outro audio. Choose a supported audio file and try again.');
      }
      const destination = audioContext.createMediaStreamDestination();
      audioStream = destination.stream;
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(destination);
    }

    canvasStream = canvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Could not prepare video for the podcast outro.');
    const recordingStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() || []),
    ]);

    const mimeTypes = audioFile
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    const recordingResult = new Promise<File>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('Could not render the branded podcast outro.'));
      recorder.onstop = () => {
        if (!chunks.length) {
          reject(new Error('The rendered podcast outro was empty. Please try again.'));
          return;
        }
        const type = recorder.mimeType || 'video/webm';
        resolve(new File(chunks, `podcast-branded-outro.webm`, {
          type,
          lastModified: Date.now(),
        }));
      };
    });

    let startedAt = 0;
    const drawFrame = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsedMs = Math.min(now - startedAt, PODCAST_OUTRO_DURATION_MS);
      drawPodcastOutroFrame(
        context,
        canvas.width,
        canvas.height,
        elapsedMs,
        showName,
        hostNames,
        coverImage,
        logoImage,
        null,
        false,
      );
      if (elapsedMs < PODCAST_OUTRO_DURATION_MS) {
        animationFrame = window.requestAnimationFrame(drawFrame);
      } else if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    recorder.start(250);
    if (audioContext && audioSource) {
      audioSource.start(audioContext.currentTime + 0.05);
    }
    animationFrame = window.requestAnimationFrame(drawFrame);
    stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, PODCAST_OUTRO_DURATION_MS + 1500);
    return await recordingResult;
  } finally {
    window.clearTimeout(stopTimer);
    window.cancelAnimationFrame(animationFrame);
    canvasStream?.getTracks().forEach((track) => track.stop());
    audioStream?.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== 'closed') await audioContext.close();
  }
}
