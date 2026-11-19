import type { AutomaticSpeechRecognitionOutput } from '@huggingface/transformers';

export type PodcastCaptionWord = {
  text: string;
  start: number;
  end: number;
};

export type PodcastCaptionPhrase = {
  text: string[];
  start: number;
  end: number;
  keywords: Set<number>;
};

type TranscriptionWorkerResponse =
  | { type: 'prepared' }
  | { type: 'progress'; progress: number }
  | { type: 'transcribed'; requestId: number; chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']> }
  | { type: 'error'; requestId?: number; message: string };

const KEYWORD_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'but', 'can', 'could', 'did', 'does', 'from', 'have', 'into', 'just', 'like', 'more',
  'most', 'much', 'only', 'other', 'over', 'really', 'said', 'should', 'some', 'such',
  'than', 'that', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'very', 'want', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would',
  'your', 'you', 'their', 'here', 'were', 'was', 'your',
]);

export const createPodcastCaptionPhrases = (
  chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']>,
): PodcastCaptionPhrase[] => {
  const words = chunks.flatMap((chunk) => {
    const text = chunk.text.trim();
    const start = chunk.timestamp?.[0];
    const end = chunk.timestamp?.[1];
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return [{ text, start, end }];
  });
  const phrases: PodcastCaptionPhrase[] = [];
  let phraseWords: PodcastCaptionWord[] = [];

  const flush = () => {
    if (!phraseWords.length) return;
    const keywords = phraseWords
      .map((word, index) => ({ index, text: word.text.replace(/[^\p{L}\p{N}'-]/gu, '') }))
      .filter(({ text }) => text.length >= 4 && !KEYWORD_STOP_WORDS.has(text.toLocaleLowerCase()))
      .sort((left, right) => right.text.length - left.text.length)
      .slice(0, 2)
      .map(({ index }) => index);
    if (!keywords.length && phraseWords.length) {
      const longestWordIndex = phraseWords.reduce(
        (longest, word, index) => word.text.length > phraseWords[longest].text.length ? index : longest,
        0,
      );
      keywords.push(longestWordIndex);
    }
    phrases.push({
      text: phraseWords.map((word) => word.text),
      start: phraseWords[0].start,
      end: phraseWords[phraseWords.length - 1].end,
      keywords: new Set(keywords),
    });
    phraseWords = [];
  };

  for (const word of words) {
    const previous = phraseWords[phraseWords.length - 1];
    const gap = previous ? word.start - previous.end : 0;
    if (
      phraseWords.length >= 5
      || gap > 0.65
      || (previous && /[.!?]["')\]]*$/.test(previous.text))
    ) flush();
    phraseWords.push(word);
    if (/[.!?]["')\]]*$/.test(word.text)) flush();
  }
  flush();
  return phrases;
};

export function createPodcastShortTranscriber(
  onModelProgress: (progress: number) => void,
) {
  const worker = new Worker(new URL('./podcastTranscription.worker.ts', import.meta.url), { type: 'module' });
  let nextRequestId = 0;
  const pending = new Map<number, {
    resolve: (chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']>) => void;
    reject: (error: Error) => void;
  }>();
  let resolveReady: (() => void) | null = null;
  let rejectReady: ((error: Error) => void) | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const rejectAll = (error: Error) => {
    rejectReady?.(error);
    rejectReady = null;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<TranscriptionWorkerResponse>) => {
    const response = event.data;
    if (response.type === 'prepared') {
      resolveReady?.();
      resolveReady = null;
      rejectReady = null;
    } else if (response.type === 'progress') {
      onModelProgress(Math.max(0, Math.min(100, response.progress)));
    } else if (response.type === 'transcribed') {
      const request = pending.get(response.requestId);
      if (!request) return;
      pending.delete(response.requestId);
      request.resolve(response.chunks);
    } else {
      const error = new Error(response.message);
      if (response.requestId === undefined) {
        rejectAll(error);
      } else {
        const request = pending.get(response.requestId);
        if (request) {
          pending.delete(response.requestId);
          request.reject(error);
        }
      }
    }
  };

  worker.onerror = (event) => {
    rejectAll(new Error(event.message || 'The local speech model stopped unexpectedly.'));
  };

  return {
    prepare: () => {
      worker.postMessage({ type: 'prepare' });
      return ready;
    },
    transcribe: async (samples: Float32Array) => {
      await ready;
      const requestId = nextRequestId++;
      const result = new Promise<NonNullable<AutomaticSpeechRecognitionOutput['chunks']>>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
      });
      worker.postMessage({ type: 'transcribe', requestId, audio: samples }, [samples.buffer]);
      return result;
    },
    terminate: () => {
      worker.terminate();
      rejectAll(new Error('Podshort transcription was cancelled.'));
    },
  };
}

export async function decodePodcastSpeechAudio(audioBlob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    const sourceChannels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const targetSampleRate = 16_000;
    const targetLength = Math.floor(decoded.length * targetSampleRate / decoded.sampleRate);
    const samples = new Float32Array(targetLength);
    const sampleRatio = decoded.sampleRate / targetSampleRate;

    for (let index = 0; index < targetLength; index += 1) {
      const sourcePosition = index * sampleRatio;
      const lowerIndex = Math.floor(sourcePosition);
      const upperIndex = Math.min(decoded.length - 1, lowerIndex + 1);
      const fraction = sourcePosition - lowerIndex;
      let monoSample = 0;
      for (const channel of sourceChannels) {
        monoSample += channel[lowerIndex] + (channel[upperIndex] - channel[lowerIndex]) * fraction;
      }
      samples[index] = monoSample / sourceChannels.length;
    }
    return samples;
  } finally {
    await audioContext.close();
  }
}

const roundedRect = (
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

const drawCaption = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  phrase: PodcastCaptionPhrase,
) => {
  const fontSize = Math.round(width * 0.066);
  const lineHeight = fontSize * 1.24;
  const horizontalPadding = fontSize * 0.5;
  const verticalPadding = fontSize * 0.34;
  const maxTextWidth = width * 0.82;
  context.save();
  context.font = `800 ${fontSize}px system-ui, sans-serif`;

  const rows: Array<Array<{ text: string; index: number; width: number }>> = [];
  let row: Array<{ text: string; index: number; width: number }> = [];
  let rowWidth = 0;
  phrase.text.forEach((text, index) => {
    const wordWidth = context.measureText(text).width;
    const nextWidth = rowWidth + (row.length ? context.measureText(' ').width : 0) + wordWidth;
    if (row.length && nextWidth > maxTextWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    rowWidth += (row.length ? context.measureText(' ').width : 0) + wordWidth;
    row.push({ text, index, width: wordWidth });
  });
  if (row.length) rows.push(row);

  const boxWidth = Math.min(
    width * 0.9,
    Math.max(...rows.map((items) => items.reduce(
      (total, item, index) => total + item.width + (index ? context.measureText(' ').width : 0),
      0,
    ))) + horizontalPadding * 2,
  );
  const boxHeight = rows.length * lineHeight + verticalPadding * 2;
  const boxX = (width - boxWidth) / 2;
  const boxY = height * 0.69;
  const gradient = context.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
  gradient.addColorStop(0, 'rgba(57, 22, 111, 0.94)');
  gradient.addColorStop(1, 'rgba(18, 12, 38, 0.94)');
  roundedRect(context, boxX, boxY, boxWidth, boxHeight, fontSize * 0.32);
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle = 'rgba(216, 180, 254, 0.9)';
  context.lineWidth = Math.max(2, width * 0.004);
  context.stroke();
  context.textBaseline = 'middle';

  rows.forEach((items, rowIndex) => {
    const rowLength = items.reduce(
      (total, item, index) => total + item.width + (index ? context.measureText(' ').width : 0),
      0,
    );
    let x = (width - rowLength) / 2;
    const y = boxY + verticalPadding + lineHeight * (rowIndex + 0.5);
    items.forEach((item) => {
      if (phrase.keywords.has(item.index)) {
        const pillPadding = fontSize * 0.12;
        roundedRect(
          context,
          x - pillPadding,
          y - fontSize * 0.48,
          item.width + pillPadding * 2,
          fontSize * 0.96,
          fontSize * 0.16,
        );
        context.fillStyle = '#facc15';
        context.fill();
        context.fillStyle = '#1f1239';
      } else {
        context.fillStyle = '#ffffff';
      }
      context.shadowColor = 'rgba(0, 0, 0, 0.4)';
      context.shadowBlur = fontSize * 0.08;
      context.fillText(item.text, x, y);
      context.shadowBlur = 0;
      x += item.width + context.measureText(' ').width;
    });
  });
  context.restore();
};

export async function renderPodcastShortCaptions(
  sourceBlob: Blob,
  chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']>,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  const phrases = createPodcastCaptionPhrases(chunks);
  if (!phrases.length) return sourceBlob;

  const objectUrl = URL.createObjectURL(sourceBlob);
  const video = document.createElement('video');
  video.src = objectUrl;
  video.preload = 'auto';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  const audioContext = new AudioContext();
  let canvasStream: MediaStream | null = null;
  let outputStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let animationFrame = 0;
  let timeout = 0;
  let renderCleanup: Promise<null> | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Could not reload a Podshort to add its captions.')), { once: true });
      video.load();
    });
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function') {
      throw new Error('This browser cannot render Podshort captions.');
    }
    const audioDestination = audioContext.createMediaStreamDestination();
    const audioSource = audioContext.createMediaElementSource(video);
    audioSource.connect(audioDestination);
    await audioContext.resume();

    canvasStream = canvas.captureStream(30);
    outputStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    const mimeType = [
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error('This browser cannot encode the captioned Podshort.');
    recorder = new MediaRecorder(outputStream, { mimeType });
    const chunksOutput: Blob[] = [];

    const rendered = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunksOutput.push(event.data);
      };
      recorder!.onerror = () => reject(new Error('Could not render the captions onto a Podshort.'));
      recorder!.onstop = () => {
        const blob = new Blob(chunksOutput, { type: recorder!.mimeType || mimeType });
        if (!blob.size) reject(new Error('The rendered Podshort captions were empty.'));
        else resolve(blob);
      };
      video.addEventListener('ended', () => {
        if (recorder!.state !== 'inactive') recorder!.stop();
      }, { once: true });
      timeout = window.setTimeout(() => {
        if (recorder!.state !== 'inactive') {
          recorder!.stop();
          reject(new Error('Rendering captions timed out before the Podshort finished.'));
        }
      }, Math.ceil(video.duration * 1000) + 10_000);
    });
    renderCleanup = rendered.then(() => null, () => null);

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const phrase = phrases.find((item) => video.currentTime >= item.start && video.currentTime <= item.end);
        if (phrase) drawCaption(context, canvas.width, canvas.height, phrase);
        onProgress(video.duration > 0 ? Math.min(1, video.currentTime / video.duration) : 0);
      }
      if (!video.ended && recorder?.state !== 'inactive') {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    };

    video.currentTime = 0;
    recorder.start(250);
    await video.play();
    drawFrame();
    return await rendered;
  } catch (renderError) {
    if (recorder?.state !== 'inactive') recorder?.stop();
    if (renderCleanup) await renderCleanup;
    throw renderError;
  } finally {
    window.clearTimeout(timeout);
    window.cancelAnimationFrame(animationFrame);
    video.pause();
    video.removeAttribute('src');
    video.load();
    outputStream?.getTracks().forEach((track) => track.stop());
    canvasStream?.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(objectUrl);
    if (audioContext.state !== 'closed') await audioContext.close();
  }
}
