export type PodcastRecordingRecovery = {
  sessionId: string;
  blob: Blob;
  recordingSeconds: number;
  savedAt: number;
};

const DATABASE_NAME = 'nexsq-podcast-recording-recovery';
const STORE_NAME = 'recordings';
const DATABASE_VERSION = 1;

function openRecoveryDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local recording recovery.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local recording recovery storage.'));
    request.onblocked = () => reject(new Error('Local recording recovery storage is blocked by another tab.'));
  });
}

export async function savePodcastRecordingRecovery(
  sessionId: string,
  blob: Blob,
  recordingSeconds: number,
): Promise<void> {
  const database = await openRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      sessionId,
      blob,
      recordingSeconds,
      savedAt: Date.now(),
    } satisfies PodcastRecordingRecovery);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not save a local recovery copy of the recording.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Saving the local recovery copy was interrupted.'));
    };
  });
}

export async function loadPodcastRecordingRecovery(
  sessionId: string,
): Promise<PodcastRecordingRecovery | null> {
  const database = await openRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(sessionId);
    let recovery: PodcastRecordingRecovery | null = null;
    request.onsuccess = () => {
      recovery = (request.result as PodcastRecordingRecovery | undefined) || null;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(recovery);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not check for a local recording recovery copy.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Checking local recording recovery was interrupted.'));
    };
  });
}

export async function deletePodcastRecordingRecovery(sessionId: string): Promise<void> {
  const database = await openRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(sessionId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Could not remove the local recording recovery copy.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Removing the local recovery copy was interrupted.'));
    };
  });
}
