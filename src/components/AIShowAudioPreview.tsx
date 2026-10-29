import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PresenterBlueprint } from '@/lib/aiPresenter';

type SpokenSegment = {
  label: string;
  text: string;
};

interface AIShowAudioPreviewProps {
  blueprint: PresenterBlueprint | null;
}

export const AIShowAudioPreview = ({ blueprint }: AIShowAudioPreviewProps) => {
  const [available, setAvailable] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const queueRef = useRef<SpokenSegment[]>([]);
  const speakRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    setAvailable(true);
    const synthesis = window.speechSynthesis;
    const loadVoices = () => setVoices(synthesis.getVoices());
    loadVoices();
    synthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      synthesis.removeEventListener('voiceschanged', loadVoices);
      synthesis.cancel();
    };
  }, []);

  useEffect(() => {
    speakRef.current = (index: number) => {
      const segment = queueRef.current[index];
      if (!segment) {
        setPlaying(false);
        setPaused(false);
        setActiveSegmentIndex(-1);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = 1;
      utterance.onstart = () => {
        setPlaying(true);
        setPaused(false);
        setActiveSegmentIndex(index);
      };
      utterance.onend = () => speakRef.current(index + 1);
      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        setPlaying(false);
        setPaused(false);
      };
      window.speechSynthesis.speak(utterance);
    };
  }, [voices, voiceURI]);

  const play = () => {
    if (!available || !blueprint) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }

    const queue: SpokenSegment[] = [
      { label: 'Opening', text: blueprint.intro },
      ...blueprint.segments.map((segment) => ({
        label: segment.title,
        text: [
          segment.hostDialogue,
          segment.contentBlocks.opening,
          ...segment.contentBlocks.mainSegment,
          segment.contentBlocks.analysis,
          segment.contentBlocks.closing,
        ].filter(Boolean).join(' '),
      })),
      { label: 'Closing', text: blueprint.closing },
    ].filter((segment) => segment.text.trim());

    window.speechSynthesis.cancel();
    queueRef.current = queue;
    setPlaying(false);
    setPaused(false);
    setActiveSegmentIndex(-1);
    speakRef.current(0);
  };

  const pause = () => {
    if (!available || !playing) return;
    window.speechSynthesis.pause();
    setPaused(true);
  };

  const stop = () => {
    if (available) window.speechSynthesis.cancel();
    queueRef.current = [];
    setPlaying(false);
    setPaused(false);
    setActiveSegmentIndex(-1);
  };

  const activeLabel = activeSegmentIndex >= 0
    ? queueRef.current[activeSegmentIndex]?.label
    : null;

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Volume2 className="h-4 w-4 text-emerald-400" />
          Spoken rundown preview
        </div>
        <span className="text-xs text-slate-400">This device only · not saved as an episode</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="presenter-browser-voice">Browser voice</label>
        <select
          id="presenter-browser-voice"
          value={voiceURI}
          onChange={(event) => setVoiceURI(event.target.value)}
          disabled={!available || voices.length === 0 || playing}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white disabled:opacity-60"
        >
          <option value="">Default browser voice</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
        <Button size="sm" onClick={play} disabled={!available || !blueprint}>
          <Play className="h-4 w-4" />
          {paused ? 'Resume' : playing ? 'Restart' : 'Play'}
        </Button>
        <Button size="icon" variant="outline" onClick={pause} disabled={!playing || paused} aria-label="Pause spoken preview" title="Pause">
          <Pause className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={stop} disabled={!playing && !paused} aria-label="Stop spoken preview" title="Stop">
          <Square className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-2 min-h-4 text-xs text-slate-400" aria-live="polite">
        {!available
          ? 'Speech playback is not supported by this browser.'
          : activeLabel
            ? `${paused ? 'Paused' : 'Playing'}: ${activeLabel}`
            : 'Ready to read the opening, segments, and closing.'}
      </p>
    </div>
  );
};
