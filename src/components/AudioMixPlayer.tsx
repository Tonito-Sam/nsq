import React, { useEffect, useRef, useState } from 'react';

interface Props {
  backgroundUrl?: string | null;
  voiceUrl?: string | null;
  backgroundVolume?: number;
  voiceVolume?: number;
}

export const AudioMixPlayer: React.FC<Props> = ({ backgroundUrl, voiceUrl, backgroundVolume = 0.6, voiceVolume = 1 }) => {
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const vRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      bgRef.current?.pause();
      vRef.current?.pause();
    };
  }, []);

  const play = async () => {
    if (playing) {
      bgRef.current?.pause();
      vRef.current?.pause();
      setPlaying(false);
      return;
    }

    // Create or reuse elements
    if (backgroundUrl) {
      if (!bgRef.current) bgRef.current = new Audio(backgroundUrl);
      bgRef.current.volume = backgroundVolume;
    }
    if (voiceUrl) {
      if (!vRef.current) vRef.current = new Audio(voiceUrl);
      vRef.current.volume = voiceVolume;
    }

    try {
      // Sync start by setting currentTime to 0 and playing both as close as possible
      if (bgRef.current) {
        bgRef.current.currentTime = 0;
      }
      if (vRef.current) {
        vRef.current.currentTime = 0;
      }
      await Promise.all([
        bgRef.current ? bgRef.current.play().catch(() => {}) : Promise.resolve(),
        vRef.current ? vRef.current.play().catch(() => {}) : Promise.resolve(),
      ]);
      setPlaying(true);
    } catch (e) {
      console.warn('Playback failed', e);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button onClick={play} className="px-3 py-1 rounded bg-blue-600 text-white">
        {playing ? 'Pause' : 'Play'}
      </button>
      <div className="text-sm text-gray-600">Background: {backgroundUrl ? 'Yes' : 'No'}</div>
      <div className="text-sm text-gray-600">Voice: {voiceUrl ? 'Yes' : 'No'}</div>
    </div>
  );
};

export default AudioMixPlayer;
