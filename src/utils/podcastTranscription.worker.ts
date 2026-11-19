import { pipeline, type AutomaticSpeechRecognitionOutput, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

type TranscriptionWorkerRequest =
  | { type: 'prepare' }
  | { type: 'transcribe'; requestId: number; audio: Float32Array };

type TranscriptionWorkerResponse =
  | { type: 'prepared' }
  | { type: 'progress'; progress: number }
  | { type: 'transcribed'; requestId: number; chunks: NonNullable<AutomaticSpeechRecognitionOutput['chunks']> }
  | { type: 'error'; requestId?: number; message: string };

const MODEL_ID = 'Xenova/whisper-tiny';
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

const getTranscriber = () => {
  transcriberPromise ??= pipeline('automatic-speech-recognition', MODEL_ID, {
    progress_callback: (event) => {
      if (event.status === 'progress_total') {
        self.postMessage({ type: 'progress', progress: event.progress } satisfies TranscriptionWorkerResponse);
      }
    },
  });
  return transcriberPromise;
};

self.onmessage = async (event: MessageEvent<TranscriptionWorkerRequest>) => {
  const request = event.data;
  try {
    const transcriber = await getTranscriber();
    if (request.type === 'prepare') {
      self.postMessage({ type: 'prepared' } satisfies TranscriptionWorkerResponse);
      return;
    }

    const result = await transcriber(request.audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({
      type: 'transcribed',
      requestId: request.requestId,
      chunks: result.chunks || [],
    } satisfies TranscriptionWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.type === 'transcribe' ? request.requestId : undefined,
      message: error instanceof Error ? error.message : 'On-device speech transcription failed.',
    } satisfies TranscriptionWorkerResponse);
  }
};
