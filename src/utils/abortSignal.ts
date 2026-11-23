export function createAbortError() {
  const error = new Error('The operation was cancelled.');
  error.name = 'AbortError';
  return error;
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

export function waitForAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', handleAbort);
    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}
