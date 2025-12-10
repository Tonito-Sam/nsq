// Utility for background removal — calls the server-side proxy at /api/removebg.
// This keeps the remove.bg API key on the server and out of client bundles.
export async function removeBgUsingRemoveBgApi(file: File): Promise<File> {
  try {
    const form = new FormData();
    // Use the field name 'image' — the backend proxy expects this
    form.append('image', file, file.name);

    const res = await fetch('/api/removebg', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      console.error('remove.bg proxy returned error', res.status, await res.text());
      return file; // fallback to original
    }

    const blob = await res.blob();
    const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.png', { type: blob.type });
    return newFile;
  } catch (err) {
    console.error('Error calling remove.bg proxy:', err);
    return file;
  }
}
