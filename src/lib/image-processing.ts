export async function applyMemeFilter(
  file: File,
  filterType: string = 'classic'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        switch (filterType) {
          case 'classic': {
            const contrast = 1.5;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = (data[i] - 128) * contrast + 128;
              data[i + 1] = (data[i + 1] - 128) * contrast + 128;
              data[i + 2] = (data[i + 2] - 128) * contrast + 128;
              if (i > 4) {
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const prevBrightness = (data[i - 4] + data[i - 3] + data[i - 2]) / 3;
                if (Math.abs(brightness - prevBrightness) > 50) {
                  data[i] = 0;
                  data[i + 1] = 0;
                  data[i + 2] = 0;
                }
              }
            }
            break;
          }
          case 'posterize': {
            const levels = 4;
            const step = 255 / Math.max(1, levels - 1);
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.round(data[i] / step) * step;
              data[i + 1] = Math.round(data[i + 1] / step) * step;
              data[i + 2] = Math.round(data[i + 2] / step) * step;
            }
            break;
          }
          case 'comic': {
            for (let i = 0; i < data.length; i += 4) {
              const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              if (gray > 128) {
                data[i] = data[i + 1] = data[i + 2] = 255;
              } else {
                data[i] = data[i + 1] = data[i + 2] = 0;
              }
            }
            break;
          }
          case 'vintage': {
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
              data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
              data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
              const noise = Math.random() * 20 - 10;
              data[i] += noise;
              data[i + 1] += noise;
              data[i + 2] += noise;
            }
            break;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
