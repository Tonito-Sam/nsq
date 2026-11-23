import ffmpegCoreURL from '@ffmpeg/core?url';
import ffmpegWasmURL from '@ffmpeg/core/wasm?url';
import {
  buildTimeRangeExpression,
  getRetainedAudioRanges,
  parseMediaDuration,
  parseSilenceRanges,
  type TimeRange,
} from './podcastSilence';
import { createAbortError, throwIfAborted } from './abortSignal';

export type PodcastAudioCleanupOptions = {
  noiseGate: boolean;
  declip: boolean;
  declick: boolean;
  trimSilence: boolean;
  minimumSilenceSeconds: number;
};

export type PodcastBackgroundAudio = {
  file: File;
  volume: number;
};

const getAudioExtension = (file: File) => {
  const mimeExtensions: Record<string, string> = {
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/x-flac': 'flac',
    'audio/x-wav': 'wav',
  };
  const mime = file.type.toLowerCase().split(';')[0];
  if (mimeExtensions[mime]) return mimeExtensions[mime];

  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension && Object.values(mimeExtensions).includes(extension) ? extension : null;
};

export async function renderPodcastAudioCleanup(
  source: Blob,
  options: PodcastAudioCleanupOptions,
  onProgress: (progress: number) => void = () => {},
  backgroundAudio?: PodcastBackgroundAudio | null,
  onStatus: (status: string) => void = () => {},
  signal?: AbortSignal,
): Promise<Blob> {
  throwIfAborted(signal);
  if (!options.noiseGate && !options.declip && !options.declick && !options.trimSilence && !backgroundAudio) {
    return source;
  }

  const backgroundExtension = backgroundAudio ? getAudioExtension(backgroundAudio.file) : null;
  if (backgroundAudio && !backgroundExtension) {
    throw new Error('Choose a supported soundtrack file: MP3, WAV, OGG, M4A, AAC, FLAC, Opus, or WebM audio.');
  }

  onProgress(3);
  onStatus('Loading the browser-based audio processor…');
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  throwIfAborted(signal);
  const ffmpeg = new FFmpeg();
  const silenceLogs: string[] = [];
  let terminated = false;
  const terminate = () => {
    if (terminated) return;
    terminated = true;
    ffmpeg.terminate();
  };
  const handleAbort = () => terminate();
  const handleSilenceLog = ({ message }: { message: string }) => silenceLogs.push(message);
  const handleAnalysisProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress(Math.max(6, Math.min(10, Math.round(6 + progress * 4))));
  };
  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress(Math.max(10, Math.min(95, Math.round(10 + progress * 85))));
  };

  signal?.addEventListener('abort', handleAbort, { once: true });
  if (signal?.aborted) handleAbort();

  try {
    throwIfAborted(signal);
    await ffmpeg.load({ coreURL: ffmpegCoreURL, wasmURL: ffmpegWasmURL });
    throwIfAborted(signal);
    onProgress(4);
    onStatus('Preparing the recording…');
    const inputName = source.type.toLowerCase().includes('mp4') ? 'input.mp4' : 'input.webm';
    await ffmpeg.writeFile(inputName, new Uint8Array(await source.arrayBuffer()));
    if (backgroundAudio && backgroundExtension) {
      await ffmpeg.writeFile(
        `background.${backgroundExtension}`,
        new Uint8Array(await backgroundAudio.file.arrayBuffer()),
      );
      throwIfAborted(signal);
    }

    let retainedRanges: TimeRange[] = [];
    let originalDuration: number | null = null;
    if (options.trimSilence) {
      onProgress(6);
      onStatus('Analyzing silent gaps…');
      ffmpeg.on('log', handleSilenceLog);
      ffmpeg.on('progress', handleAnalysisProgress);
      const detectExitCode = await ffmpeg.exec([
        '-i', inputName,
        '-vn',
        '-af', `silencedetect=noise=-42dB:d=${options.minimumSilenceSeconds}`,
        '-f', 'null',
        '-',
      ]);
      throwIfAborted(signal);
      ffmpeg.off('log', handleSilenceLog);
      ffmpeg.off('progress', handleAnalysisProgress);
      if (detectExitCode !== 0) throw new Error('Could not analyze silent sections in the recording.');

      const duration = parseMediaDuration(silenceLogs);
      if (duration === null) throw new Error('Could not determine the recording duration for silence removal.');
      originalDuration = duration;
      retainedRanges = getRetainedAudioRanges(
        duration,
        parseSilenceRanges(silenceLogs, duration),
        options.minimumSilenceSeconds,
      );
      if (!retainedRanges.length) retainedRanges = [{ start: 0, end: duration }];
    }
    onProgress(10);
    onStatus(backgroundAudio ? 'Mixing the soundtrack with the recording…' : 'Applying audio cleanup…');

    const retainedDuration = retainedRanges.reduce((total, range) => total + range.end - range.start, 0);
    const removeSilence = options.trimSilence
      && originalDuration !== null
      && retainedDuration < originalDuration - 0.05;
    const audioFilters = [
      ...(options.noiseGate ? ['agate=threshold=0.015:ratio=4:attack=10:release=250'] : []),
      ...(options.declip ? ['adeclip'] : []),
      ...(options.declick ? ['adeclick'] : []),
    ];
    const isWebm = inputName.endsWith('.webm');
    const outputName = 'cleaned-recording.webm';
    const args = ['-i', inputName];

    if (backgroundAudio && backgroundExtension) {
      args.push('-stream_loop', '-1', '-i', `background.${backgroundExtension}`);
    }

    if (removeSilence) {
      const rangeExpression = buildTimeRangeExpression(retainedRanges);
      const voiceChain = [
        `aselect='${rangeExpression}'`,
        'asetpts=N/SR/TB',
        ...audioFilters,
      ].join(',');
      const audioChain = backgroundAudio
        ? `[0:a]${voiceChain}[voice];[1:a]volume=${Math.max(0, Math.min(1, backgroundAudio.volume)).toFixed(2)},asetpts=N/SR/TB[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`
        : `[0:a]${voiceChain}[a]`;
      args.push(
        '-filter_complex',
        `[0:v]select='${rangeExpression}',setpts=N/(30*TB)[v];${audioChain}`,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libvpx-vp9',
        '-deadline', 'realtime',
        '-cpu-used', '8',
        '-crf', '32',
        '-b:v', '0',
      );
    } else if (backgroundAudio) {
      const voiceFilter = audioFilters.length ? audioFilters.join(',') : 'anull';
      args.push(
        '-filter_complex',
        `[0:a]${voiceFilter},asetpts=PTS-STARTPTS[voice];[1:a]volume=${Math.max(0, Math.min(1, backgroundAudio.volume)).toFixed(2)},asetpts=PTS-STARTPTS[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`,
      );
      if (isWebm) {
        args.push('-map', '0:v:0', '-c:v', 'copy');
      } else {
        args.push('-map', '0:v:0', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '32', '-b:v', '0');
      }
      args.push('-map', '[a]');
    } else {
      if (isWebm) {
        args.push('-map', '0:v:0', '-c:v', 'copy');
      } else {
        args.push('-map', '0:v:0', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '32', '-b:v', '0');
      }
      args.push('-map', '0:a:0');
      if (audioFilters.length) args.push('-af', audioFilters.join(','));
    }
    args.push('-c:a', 'libopus', '-b:a', '128k', '-f', 'webm', outputName);

    ffmpeg.on('progress', handleProgress);
    const exitCode = await ffmpeg.exec(args);
    throwIfAborted(signal);
    ffmpeg.off('progress', handleProgress);
    if (exitCode !== 0) {
      throw new Error('The selected audio cleanup could not be rendered. Try disabling one effect and retry.');
    }

    onStatus('Finalizing the recording…');
    const output = await ffmpeg.readFile(outputName);
    if (typeof output === 'string' || output.byteLength === 0) {
      throw new Error('Audio cleanup returned an empty recording.');
    }
    const bytes = new Uint8Array(output.byteLength);
    bytes.set(output);
    onProgress(100);
    return new Blob([bytes], { type: 'video/webm' });
  } catch (error) {
    if (signal?.aborted) throw createAbortError();
    throw error;
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    ffmpeg.off('log', handleSilenceLog);
    ffmpeg.off('progress', handleAnalysisProgress);
    ffmpeg.off('progress', handleProgress);
    terminate();
  }
}
