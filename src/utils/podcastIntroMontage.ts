export const PODCAST_INTRO_DURATION_MS = 15_000;
export const PODCAST_OUTRO_DURATION_MS = 15_000;
export const PODCAST_LOWER_THIRD_INITIAL_DELAY_MS = 5_000;
export const PODCAST_LOWER_THIRD_INTERVAL_MS = 30_000;
export const PODCAST_LOWER_THIRD_DURATION_MS = 15_000;

export type PodcastBroadcastSlot = {
  date: string;
  time: string;
  timeZone: string;
};

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
  zoom = 1,
) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;

  const scale = Math.max(width / video.videoWidth, height / video.videoHeight) * zoom;
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

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.arcTo(x + width, y, x + width, y + height, corner);
  context.arcTo(x + width, y + height, x, y + height, corner);
  context.arcTo(x, y + height, x, y, corner);
  context.arcTo(x, y, x + width, y, corner);
  context.closePath();
}

function getPodcastInitials(showName: string) {
  return showName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'P';
}

function drawPodcastLogoMark(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  showName: string,
) {
  const radius = size * 0.2;
  context.save();
  roundedRectPath(context, x, y, size, size, radius);
  context.clip();
  if (image) {
    drawArtworkCover(context, image, x, y, size, size);
  } else {
    const gradient = context.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, '#087f5b');
    gradient.addColorStop(1, '#064e3b');
    context.fillStyle = gradient;
    context.fillRect(x, y, size, size);
    context.fillStyle = '#ffffff';
    context.font = `700 ${size * 0.38}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(getPodcastInitials(showName), x + size / 2, y + size / 2);
  }
  context.restore();

  context.save();
  roundedRectPath(context, x, y, size, size, radius);
  context.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  context.lineWidth = Math.max(1.5, size * 0.018);
  context.stroke();
  context.restore();
}

function drawPodcastArtwork(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;

  const radius = height * 0.06;
  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.shadowColor = 'rgba(0, 0, 0, 0.5)';
  context.shadowBlur = height * 0.12;
  context.fillStyle = 'rgba(3, 8, 7, 0.92)';
  context.fill();
  context.shadowBlur = 0;
  context.clip();
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();

  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.strokeStyle = 'rgba(255, 255, 255, 0.58)';
  context.lineWidth = Math.max(1.5, height * 0.012);
  context.stroke();
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

function fitCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, forceEllipsis = false) {
  let fittedText = text.trim();
  if (!forceEllipsis && context.measureText(fittedText).width <= maxWidth) return fittedText;
  while (fittedText && context.measureText(`${fittedText}…`).width > maxWidth) {
    fittedText = fittedText.slice(0, -1);
  }
  return fittedText ? `${fittedText.trimEnd()}…` : '…';
}

export function shouldShowPodcastLowerThird(elapsedMs: number) {
  if (elapsedMs < PODCAST_LOWER_THIRD_INITIAL_DELAY_MS) return false;
  return (elapsedMs - PODCAST_LOWER_THIRD_INITIAL_DELAY_MS) % PODCAST_LOWER_THIRD_INTERVAL_MS
    < PODCAST_LOWER_THIRD_DURATION_MS;
}

export function getPodcastLowerThirdStage(elapsedMs: number): { stage: 0 | 1 | 2; progress: number } | null {
  if (!shouldShowPodcastLowerThird(elapsedMs)) return null;
  const elapsedInStrip = (elapsedMs - PODCAST_LOWER_THIRD_INITIAL_DELAY_MS) % PODCAST_LOWER_THIRD_INTERVAL_MS;
  const stageDuration = PODCAST_LOWER_THIRD_DURATION_MS / 3;
  const stage = Math.floor(elapsedInStrip / stageDuration) as 0 | 1 | 2;
  return {
    stage,
    progress: (elapsedInStrip % stageDuration) / stageDuration,
  };
}

export function shouldStartPodcastOutro(recordingSeconds: number, targetDurationMinutes: number) {
  if (!Number.isFinite(targetDurationMinutes) || targetDurationMinutes <= 0) return false;
  return recordingSeconds >= targetDurationMinutes * 60 - PODCAST_OUTRO_DURATION_MS / 1000;
}

export function getNextPodcastBroadcastSlot(
  approvedDays: readonly string[],
  timeSlotStart: string | null | undefined,
  timeSlotEnd: string | null | undefined,
  timeZone = 'UTC',
  now = new Date(),
): PodcastBroadcastSlot | null {
  const days = new Set(approvedDays.map((day) => day.trim().toLowerCase()));
  const startMatch = timeSlotStart?.match(/^(\d{1,2}):(\d{2})/);
  const endMatch = timeSlotEnd?.match(/^(\d{1,2}):(\d{2})/);
  if (!days.size || !startMatch) return null;

  const startHour = Number(startMatch[1]);
  const startMinute = Number(startMatch[2]);
  const endHour = endMatch ? Number(endMatch[1]) : null;
  const endMinute = endMatch ? Number(endMatch[2]) : null;
  if (
    startHour > 23
    || startMinute > 59
    || (endHour !== null && (endHour > 23 || (endMinute !== null && endMinute > 59)))
  ) return null;

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const parts = Object.fromEntries(nowParts.map(({ type, value }) => [type, value]));
  const currentDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const startMinutes = startHour * 60 + startMinute;
  const formatTime = (hour: number, minute: number) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidateDate = new Date(currentDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
      .format(candidateDate)
      .toLowerCase();
    if (!days.has(dayName) || (dayOffset === 0 && startMinutes < currentMinutes)) continue;

    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(candidateDate);
    const time = endHour === null || endMinute === null
      ? formatTime(startHour, startMinute)
      : `${formatTime(startHour, startMinute)} – ${formatTime(endHour, endMinute)}`;
    return { date, time, timeZone };
  }

  return null;
}

export function drawPodcastNextEpisodeSlot(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  slot: PodcastBroadcastSlot | null | undefined,
) {
  const cardX = width * 0.53;
  const cardY = height * 0.57;
  const cardWidth = width * 0.39;
  const cardHeight = height * 0.27;
  const radius = height * 0.025;

  context.save();
  roundedRectPath(context, cardX, cardY, cardWidth, cardHeight, radius);
  const cardGradient = context.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
  cardGradient.addColorStop(0, 'rgba(11, 42, 33, 0.94)');
  cardGradient.addColorStop(1, 'rgba(4, 15, 17, 0.94)');
  context.fillStyle = cardGradient;
  context.fill();
  context.strokeStyle = 'rgba(104, 239, 183, 0.5)';
  context.lineWidth = Math.max(2, height * 0.003);
  context.stroke();

  const padding = cardWidth * 0.08;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = '#72f0bc';
  context.font = `700 ${Math.max(11, height * 0.023)}px "Segoe UI", Arial, sans-serif`;
  context.fillText('NEXT EPISODE', cardX + padding, cardY + cardHeight * 0.2);

  if (slot) {
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(15, height * 0.03)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(fitCanvasText(context, slot.date, cardWidth - padding * 2), cardX + padding, cardY + cardHeight * 0.48);
    context.fillStyle = '#b7f5dd';
    context.font = `600 ${Math.max(14, height * 0.027)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(fitCanvasText(context, slot.time, cardWidth - padding * 2), cardX + padding, cardY + cardHeight * 0.7);
    context.fillStyle = '#ffffffa8';
    context.font = `500 ${Math.max(10, height * 0.018)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(fitCanvasText(context, slot.timeZone, cardWidth - padding * 2), cardX + padding, cardY + cardHeight * 0.87);
  } else {
    context.fillStyle = '#ffffff';
    context.font = `600 ${Math.max(13, height * 0.025)}px "Segoe UI", Arial, sans-serif`;
    context.fillText('Date and time to be announced', cardX + padding, cardY + cardHeight * 0.55);
  }
  context.restore();
}

export function drawPodcastBroadcastOverlays(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  showName: string,
  topic: string,
  hostNames: string,
  artworkImage?: HTMLImageElement | null,
  lowerThirdOnly = false,
) {
  const lowerThirdStage = getPodcastLowerThirdStage(elapsedMs);
  const margin = width * 0.045;
  const image = artworkImage?.complete && artworkImage.naturalWidth ? artworkImage : null;
  const artworkWidth = height * 0.105;
  const artworkHeight = height * 0.14;
  if (!lowerThirdOnly) {
    drawPodcastArtwork(
      context,
      image,
      width - margin - artworkWidth,
      height * 0.045,
      artworkWidth,
      artworkHeight,
    );
  }

  if (!lowerThirdOnly && lowerThirdStage?.stage !== 1) {
    const topicText = topic.trim() || 'Discussion topic';
    const topicX = margin;
    const topicY = height * 0.045;
    const topicHeight = height * 0.07;
    const topicPadding = height * 0.018;
    const topicLabel = 'TOPIC';
    context.save();
    context.font = `700 ${Math.max(9, height * 0.014)}px "Segoe UI", Arial, sans-serif`;
    const topicLabelWidth = context.measureText(topicLabel).width;
    const topicTextX = topicX + topicPadding * 2 + topicLabelWidth;
    const topicMaxWidth = width * 0.58 - (topicTextX - topicX) - topicPadding;
    context.font = `600 ${Math.max(12, height * 0.021)}px "Segoe UI", Arial, sans-serif`;
    const topicPillWidth = Math.min(
      width * 0.58,
      topicTextX - topicX + topicPadding + context.measureText(topicText).width,
    );
    roundedRectPath(context, topicX, topicY, topicPillWidth, topicHeight, topicHeight * 0.22);
    context.fillStyle = 'rgba(3, 10, 12, 0.76)';
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = Math.max(1, height * 0.0015);
    context.stroke();
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = `700 ${Math.max(9, height * 0.014)}px "Segoe UI", Arial, sans-serif`;
    context.fillStyle = '#65e6b2';
    context.fillText(topicLabel, topicX + topicPadding, topicY + topicHeight / 2);
    context.font = `600 ${Math.max(12, height * 0.021)}px "Segoe UI", Arial, sans-serif`;
    context.fillStyle = '#ffffff';
    context.fillText(
      fitCanvasText(context, topicText, topicMaxWidth),
      topicTextX,
      topicY + topicHeight / 2,
    );
    context.restore();
  }

  if (!lowerThirdStage) return;

  const barX = 0;
  const barHeight = height * 0.14;
  const barY = height - barHeight;
  const barWidth = width;
  context.save();
  const barGradient = context.createLinearGradient(barX, barY, barX + barWidth, barY + barHeight);
  barGradient.addColorStop(0, 'rgba(3, 16, 13, 0.9)');
  barGradient.addColorStop(0.55, 'rgba(5, 12, 13, 0.87)');
  barGradient.addColorStop(1, 'rgba(8, 10, 14, 0.9)');
  context.fillStyle = barGradient;
  context.fillRect(barX, barY, barWidth, barHeight);

  const accentGradient = context.createLinearGradient(barX, barY, barX, barY + barHeight);
  accentGradient.addColorStop(0, '#61f0b5');
  accentGradient.addColorStop(1, '#0aa975');
  context.fillStyle = accentGradient;
  context.fillRect(barX, barY, width, Math.max(2, height * 0.003));

  const horizontalPadding = height * 0.03;
  const imageSize = barHeight * 0.64;
  const imageX = horizontalPadding;
  const imageY = barY + (barHeight - imageSize) / 2;
  drawPodcastLogoMark(context, image, imageX, imageY, imageSize, showName);

  const textX = imageX + imageSize + height * 0.018;
  const availableTextWidth = width - textX - horizontalPadding;
  const sceneLabel = lowerThirdStage.stage === 0
    ? 'PODCAST'
    : lowerThirdStage.stage === 1
      ? 'TOPIC'
      : 'HOST';
  const sceneText = lowerThirdStage.stage === 0
    ? showName || 'Podcast'
    : lowerThirdStage.stage === 1
      ? topic.trim() || 'Discussion topic'
      : hostNames || 'Your host';
  const edgeProgress = Math.min(1, Math.min(
    lowerThirdStage.progress,
    1 - lowerThirdStage.progress,
  ) / 0.16);
  const easedProgress = 1 - (1 - edgeProgress) ** 3;
  const textOffset = (1 - easedProgress) * height * 0.012;
  context.globalAlpha = easedProgress;
  context.translate(0, (1 - easedProgress) * height * 0.035);
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  const textY = barY + barHeight / 2;
  context.fillStyle = '#72f0bc';
  context.font = `700 ${Math.max(9, height * 0.014)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(sceneLabel, textX + textOffset, textY - barHeight * 0.14);
  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.max(14, height * 0.03)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(fitCanvasText(context, sceneText, availableTextWidth), textX + textOffset, textY + barHeight * 0.16);
  context.restore();
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
  introBackgroundVideo?: HTMLVideoElement | null,
  cameraZoom = 1,
) {
  const duration = PODCAST_INTRO_DURATION_MS;
  const introActive = elapsedMs < duration;
  const sceneIndex = Math.min(SCENES.length - 1, Math.floor(elapsedMs / (duration / SCENES.length)));

  if (introActive) {
    const scene = SCENES[sceneIndex];
    const sceneElapsed = (elapsedMs % (duration / SCENES.length)) / (duration / SCENES.length);
    const hasIntroVideo = introBackgroundVideo
      && introBackgroundVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    if (hasIntroVideo) {
      drawCameraCover(context, introBackgroundVideo, width, height, 1);
      const titlePanel = context.createLinearGradient(0, height * 0.28, 0, height * 0.78);
      titlePanel.addColorStop(0, 'rgba(3, 6, 5, 0.35)');
      titlePanel.addColorStop(0.12, 'rgba(3, 6, 5, 0.92)');
      titlePanel.addColorStop(0.88, 'rgba(3, 6, 5, 0.92)');
      titlePanel.addColorStop(1, 'rgba(3, 6, 5, 0.35)');
      context.fillStyle = titlePanel;
      context.fillRect(0, height * 0.28, width, height * 0.5);
    } else {
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, scene.base);
      background.addColorStop(0.58, scene.deep);
      background.addColorStop(1, '#030605');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

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
    }

    const margin = width * 0.085;
    const titleArtwork = coverImage || logoImage;
    const titleMaxWidth = width * (titleArtwork ? 0.53 : 0.78);
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    drawArtworkCover(
      context,
      coverImage ? logoImage : null,
      margin,
      height * 0.105,
      width * 0.07,
      width * 0.07,
      0.95,
    );
    context.fillStyle = scene.accent;
    context.font = `700 ${Math.max(15, width * 0.018)}px "Segoe UI", Arial, sans-serif`;
    const hasHeaderLogo = Boolean(coverImage && logoImage?.complete && logoImage.naturalWidth);
    context.fillText('NEXSQ PODCAST', margin + (hasHeaderLogo ? width * 0.085 : 0), height * 0.17);

    if (titleArtwork) {
      drawPodcastArtwork(
        context,
        titleArtwork,
        width * 0.68,
        height * 0.365,
        width * 0.25,
        height * 0.29,
      );
    }

    let titleSize = Math.min(width * 0.085, height * 0.16);
    context.font = `700 ${titleSize}px "Segoe UI", Arial, sans-serif`;
    let titleLines = wrapText(context, showTitle || 'Podcast', titleMaxWidth);
    while (titleLines.length > 3 && titleSize > 30) {
      titleSize *= 0.85;
      context.font = `700 ${titleSize}px "Segoe UI", Arial, sans-serif`;
      titleLines = wrapText(context, showTitle || 'Podcast', titleMaxWidth);
    }

    const lineHeight = titleSize * 1.14;
    const titleTop = height * 0.49 - ((titleLines.length - 1) * lineHeight) / 2;
    context.fillStyle = '#ffffff';
    context.shadowColor = '#00000099';
    context.shadowBlur = width * 0.018;
    titleLines.forEach((line, index) => {
      context.fillText(fitCanvasText(context, line, titleMaxWidth), margin, titleTop + index * lineHeight);
    });
    context.shadowBlur = 0;

    context.fillStyle = scene.secondary;
    context.font = `600 ${Math.max(18, width * 0.032)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(
      fitCanvasText(context, `HOSTED BY  ${hostNames || 'Your host'}`, titleMaxWidth),
      margin,
      titleTop + titleLines.length * lineHeight + height * 0.055,
    );

    const progress = Math.min(1, elapsedMs / duration);
    context.fillStyle = '#ffffff35';
    context.fillRect(margin, height * 0.91, width - margin * 2, Math.max(3, height * 0.006));
    context.fillStyle = scene.accent;
    context.fillRect(margin, height * 0.91, (width - margin * 2) * progress, Math.max(3, height * 0.006));

    if (elapsedMs > duration - 1000) {
      drawCameraCover(context, video, width, height, (elapsedMs - (duration - 1000)) / 1000, cameraZoom);
    }
  } else {
    context.fillStyle = '#050807';
    context.fillRect(0, 0, width, height);
    drawCameraCover(context, video, width, height, 1, cameraZoom);
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
  nextEpisodeSlot?: PodcastBroadcastSlot | null,
  includeNextEpisodeSlot = true,
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
  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.min(width * 0.08, height * 0.15)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(showTitle || 'Podcast', margin, height * 0.48);
  context.fillStyle = '#20d890';
  context.font = `600 ${Math.max(18, width * 0.032)}px "Segoe UI", Arial, sans-serif`;
  context.fillText('Thanks for watching', margin, height * 0.62);
  context.fillStyle = '#ffffffbf';
  context.font = `500 ${Math.max(14, width * 0.022)}px "Segoe UI", Arial, sans-serif`;
  context.fillText(`Hosted by ${hostNames || 'Your host'}`, margin, height * 0.72);
  if (includeNextEpisodeSlot) drawPodcastNextEpisodeSlot(context, width, height, nextEpisodeSlot);
  context.fillStyle = '#ffffff35';
  context.fillRect(margin, height * 0.91, width - margin * 2, Math.max(3, height * 0.006));
  context.fillStyle = '#20d890';
  context.fillRect(margin, height * 0.91, (width - margin * 2) * Math.min(1, elapsedMs / PODCAST_OUTRO_DURATION_MS), Math.max(3, height * 0.006));
}
