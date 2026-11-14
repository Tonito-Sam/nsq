export const PODCAST_INTRO_DURATION_MS = 15_000;
export const PODCAST_OUTRO_DURATION_MS = 8_000;

const SCENES = [
  { base: '#062116', deep: '#07110f', accent: '#20d890', secondary: '#f0bd58' },
  { base: '#08212a', deep: '#080f18', accent: '#36c6d5', secondary: '#a08cff' },
  { base: '#25180a', deep: '#100e0b', accent: '#f0bd58', secondary: '#24ce91' },
];

function drawCameraCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  alpha: number,
) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;

  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawArtworkCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function drawPodcastIntroFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  elapsedMs: number,
  showTitle: string,
  hostNames: string,
  coverImage?: HTMLImageElement | null,
  logoImage?: HTMLImageElement | null,
) {
  const duration = PODCAST_INTRO_DURATION_MS;
  const introActive = elapsedMs < duration;
  const sceneIndex = Math.min(SCENES.length - 1, Math.floor(elapsedMs / (duration / SCENES.length)));

  if (introActive) {
    const scene = SCENES[sceneIndex];
    const sceneElapsed = (elapsedMs % (duration / SCENES.length)) / (duration / SCENES.length);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, scene.base);
    background.addColorStop(0.58, scene.deep);
    background.addColorStop(1, '#030605');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    drawArtworkCover(context, coverImage, width * 0.62, height * 0.2, width * 0.3, height * 0.56, 0.35);

    const glowX = width * (0.72 + Math.sin(sceneElapsed * Math.PI * 2) * 0.08);
    const glow = context.createRadialGradient(glowX, height * 0.42, 0, glowX, height * 0.42, width * 0.72);
    glow.addColorStop(0, `${scene.accent}55`);
    glow.addColorStop(1, `${scene.accent}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 4; index += 1) {
      const travel = (elapsedMs / 1000 * (24 + index * 9) + index * width * 0.42) % (width * 1.5) - width * 0.25;
      context.save();
      context.translate(travel, height * 0.5);
      context.rotate(-0.24);
      context.globalAlpha = 0.055 + index * 0.012;
      context.fillStyle = index % 2 ? scene.secondary : scene.accent;
      context.fillRect(0, -height, width * 0.12, height * 2);
      context.restore();
    }

    context.save();
    context.globalAlpha = 0.34;
    context.strokeStyle = scene.secondary;
    context.lineWidth = Math.max(1, width * 0.0015);
    for (let index = 0; index < 3; index += 1) {
      const radius = width * (0.13 + index * 0.075 + sceneElapsed * 0.025);
      context.beginPath();
      context.arc(width * 0.78, height * 0.54, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();

    const margin = width * 0.085;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    drawArtworkCover(context, logoImage, margin, height * 0.105, width * 0.07, width * 0.07, 0.95);
    context.fillStyle = scene.accent;
    context.font = `700 ${Math.max(15, width * 0.018)}px "Segoe UI", Arial, sans-serif`;
    context.fillText('NEXSQ PODCAST', margin + (logoImage?.complete ? width * 0.085 : 0), height * 0.17);

    let titleSize = Math.min(width * 0.085, height * 0.16);
    context.font = `700 ${titleSize}px "Segoe UI", Arial, sans-serif`;
    let titleLines = wrapText(context, showTitle || 'Podcast', width * 0.78);
    while (titleLines.length > 3 && titleSize > 30) {
      titleSize *= 0.85;
      context.font = `700 ${titleSize}px "Segoe UI", Arial, sans-serif`;
      titleLines = wrapText(context, showTitle || 'Podcast', width * 0.78);
    }

    const lineHeight = titleSize * 1.14;
    const titleTop = height * 0.49 - ((titleLines.length - 1) * lineHeight) / 2;
    context.fillStyle = '#ffffff';
    context.shadowColor = '#00000099';
    context.shadowBlur = width * 0.018;
    titleLines.forEach((line, index) => {
      context.fillText(line, margin, titleTop + index * lineHeight);
    });
    context.shadowBlur = 0;

    context.fillStyle = scene.secondary;
    context.font = `600 ${Math.max(18, width * 0.032)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(`HOSTED BY  ${hostNames || 'Your host'}`, margin, titleTop + titleLines.length * lineHeight + height * 0.055);

    const progress = Math.min(1, elapsedMs / duration);
    context.fillStyle = '#ffffff35';
    context.fillRect(margin, height * 0.91, width - margin * 2, Math.max(3, height * 0.006));
    context.fillStyle = scene.accent;
    context.fillRect(margin, height * 0.91, (width - margin * 2) * progress, Math.max(3, height * 0.006));

    if (elapsedMs > duration - 1000) {
      drawCameraCover(context, video, width, height, (elapsedMs - (duration - 1000)) / 1000);
    }
  } else {
    context.fillStyle = '#050807';
    context.fillRect(0, 0, width, height);
    drawCameraCover(context, video, width, height, 1);
  }

  return { introActive, sceneIndex };
}

export function drawPodcastOutroFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  showTitle: string,
  hostNames: string,
  coverImage?: HTMLImageElement | null,
  logoImage?: HTMLImageElement | null,
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#062116');
  background.addColorStop(0.58, '#07110f');
  background.addColorStop(1, '#030605');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  drawArtworkCover(context, coverImage, width * 0.6, height * 0.18, width * 0.31, height * 0.57, 0.4);

  const margin = width * 0.085;
  drawArtworkCover(context, logoImage, margin, height * 0.16, width * 0.08, width * 0.08);
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = '#20d890';
  context.font = `700 ${Math.max(15, width * 0.018)}px "Segoe UI", Arial, sans-serif`;
  context.fillText('NEXSQ PODCAST', margin + (logoImage?.complete ? width * 0.095 : 0), height * 0.2);
  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.min(width * 0.08, height * 0.15)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(showTitle || 'Podcast', margin, height * 0.48);
  context.fillStyle = '#20d890';
  context.font = `600 ${Math.max(18, width * 0.032)}px "Segoe UI", Arial, sans-serif`;
  context.fillText('Thanks for watching', margin, height * 0.62);
  context.fillStyle = '#ffffffbf';
  context.font = `500 ${Math.max(14, width * 0.022)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(`Hosted by ${hostNames || 'Your host'}`, margin, height * 0.72);
  context.fillStyle = '#ffffff35';
  context.fillRect(margin, height * 0.91, width - margin * 2, Math.max(3, height * 0.006));
  context.fillStyle = '#20d890';
  context.fillRect(margin, height * 0.91, (width - margin * 2) * Math.min(1, elapsedMs / PODCAST_OUTRO_DURATION_MS), Math.max(3, height * 0.006));
}
