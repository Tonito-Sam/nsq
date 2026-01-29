import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

const slides = [
  {
    text: 'Welcome to 1Studio Web TV',
    sub: 'Your home for live and on-demand entertainment',
    color: 'from-purple-600 to-blue-500',
  },
  {
    text: 'Experience Live Shows, Music, and More',
    sub: 'Stay tuned for exclusive content and events',
    color: 'from-pink-500 to-yellow-400',
  },
  {
    text: 'Enjoy the 1Studio Trailer',
    sub: 'The future of web TV is here. Get ready!',
    color: 'from-green-400 to-blue-600',
  },
];

const PIANO_SOUND = '/public/piano-loop.mp3'; // Place a free piano loop here

export const StudioTrailerSlider: React.FC<{ className?: string }> = ({ className }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // false = playing
  const [muted, setMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Slide animation control
  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % slides.length);
      }, 3500);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [paused]);

  // Audio control
  useEffect(() => {
    if (audioRef.current) {
      if (!paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [paused]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  // Loop the audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = true;
    }
  }, []);

  const slide = slides[index];

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-lg bg-gradient-to-br ${slide.color} animate-fade-in ${className || ''}`}> 
      <audio ref={audioRef} src={PIANO_SOUND} preload="auto" autoPlay loop muted={muted} />
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg animate-slide-in-up text-center" key={slide.text}>
          {slide.text}
        </div>
        <div className="mt-2 text-lg md:text-xl text-white/80 animate-fade-in delay-200 text-center max-w-xl mx-auto">
          {slide.sub}
        </div>
      </div>
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-20 bg-black/40 rounded-full px-3 py-2">
        <button onClick={() => setPaused((p) => !p)} className="text-white hover:text-purple-300 focus:outline-none">
          {!paused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button onClick={() => setMuted((m) => !m)} className="text-white hover:text-purple-300 focus:outline-none">
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <span key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === index ? 'bg-white' : 'bg-white/40'}`}></span>
        ))}
      </div>
    </div>
  );
};
