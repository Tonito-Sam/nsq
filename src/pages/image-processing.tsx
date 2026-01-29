import React, { useState } from 'react';
import { applyMemeFilter } from '../lib/image-processing';

const ImageProcessingDemo: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processed, setProcessed] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('classic');
  const [processing, setProcessing] = useState(false);

  const onSelect = (f?: File) => {
    if (!f) return;
    setFile(f);
    setProcessed(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
  };

  const runProcess = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const out = await applyMemeFilter(file, filter);
      setProcessed(out);
    } catch (err) {
      console.error('Processing failed', err);
      alert('Processing failed: ' + (err as any)?.message || 'unknown');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Image Processing Demo</h2>

      <div className="mb-4">
        <input type="file" accept="image/*" onChange={handleFileChange} />
      </div>

      {preview && (
        <div className="mb-4">
          <div className="mb-2 font-medium">Original preview</div>
          <img src={preview} alt="preview" style={{ maxWidth: '100%', borderRadius: 8 }} />
        </div>
      )}

      <div className="mb-4">
        <label className="mr-2">Filter:</label>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="classic">Classic</option>
          <option value="posterize">Posterize</option>
          <option value="comic">Comic</option>
          <option value="vintage">Vintage</option>
        </select>
        <button onClick={runProcess} disabled={!file || processing} style={{ marginLeft: 12 }}>
          {processing ? 'Processing...' : 'Apply Filter'}
        </button>
      </div>

      {processed && (
        <div>
          <div className="mb-2 font-medium">Processed result</div>
          <img src={processed} alt="processed" style={{ maxWidth: '100%', borderRadius: 8 }} />
          <div className="mt-2">
            <a href={processed} download={`processed-${Date.now()}.jpg`} className="underline">
              Download processed image
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageProcessingDemo;
