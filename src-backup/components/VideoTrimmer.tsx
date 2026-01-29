import React, { useRef, useEffect, useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

const MAX_SEGMENT = 90; // seconds

interface VideoTrimmerProps {
  file: File;
  onTrim: (start: number, end: number) => void;
}

const VideoTrimmer: React.FC<VideoTrimmerProps> = ({ file, onTrim }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [range, setRange] = useState<[number, number]>([0, MAX_SEGMENT]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = range[0];
    }
  }, [range[0]]);

  useEffect(() => {
    if (videoRef.current && playing) {
      const handleTimeUpdate = () => {
        if (videoRef.current) {
          if (videoRef.current.currentTime >= range[1]) {
            videoRef.current.pause();
            setPlaying(false);
          }
        }
      };
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      return () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [range, playing]);

  const handleLoadedMetadata = () => {
    const dur = videoRef.current?.duration || 0;
    setDuration(dur);
    if (dur < MAX_SEGMENT) {
      setRange([0, dur]);
    } else {
      setRange([0, MAX_SEGMENT]);
    }
  };

  const handleSliderChange = (vals: number | number[]) => {
    if (Array.isArray(vals)) {
      setRange([vals[0], vals[1]]);
      onTrim(vals[0], vals[1]);
      if (videoRef.current) videoRef.current.currentTime = vals[0];
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <video
          ref={videoRef}
          src={URL.createObjectURL(file)}
          style={{ width: '100%', borderRadius: 8 }}
          onLoadedMetadata={handleLoadedMetadata}
          controls={false}
        />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={() => {
              if (videoRef.current) {
                if (playing) {
                  videoRef.current.pause();
                  setPlaying(false);
                } else {
                  videoRef.current.currentTime = range[0];
                  videoRef.current.play();
                  setPlaying(true);
                }
              }
            }}
            style={{ marginRight: 12 }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <span style={{ fontSize: 12, color: '#888' }}>
            {range[0].toFixed(1)}s - {range[1].toFixed(1)}s / {duration.toFixed(1)}s
          </span>
        </div>
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <Slider
            range
            min={0}
            max={duration}
            value={range}
            allowCross={false}
            step={0.1}
            onChange={handleSliderChange}
            trackStyle={[{ backgroundColor: '#a855f7', height: 8 }]}
            handleStyle={[
              { borderColor: '#a855f7', backgroundColor: '#fff', height: 20, width: 20, marginTop: -6 },
              { borderColor: '#a855f7', backgroundColor: '#fff', height: 20, width: 20, marginTop: -6 }
            ]}
            railStyle={{ backgroundColor: '#e5e7eb', height: 8 }}
          />
        </div>
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
          Drag the handles to select up to 90 seconds for your moment.
        </div>
      </div>
    </div>
  );
};

export default VideoTrimmer;
