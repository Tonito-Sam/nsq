import { Mic, Music2, Palette, Sun, Video, Volume1, Volume2, Wand2, Waves } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReelAudioPreset, ReelVideoPreset } from '@/utils/animatedReelCaptions';

const audioOptions = [
  { value: 'original', label: 'Original', icon: Volume2 },
  { value: 'voice-clarity', label: 'Voice clarity', icon: Mic },
  { value: 'warm-studio', label: 'Warm studio', icon: Music2 },
  { value: 'bass-boost', label: 'Bass boost', icon: Waves },
  { value: 'volume-boost', label: 'Volume boost', icon: Volume1 },
] as const;

const videoOptions = [
  { value: 'original', label: 'Original', icon: Video },
  { value: 'balanced', label: 'Auto enhance', icon: Wand2 },
  { value: 'bright', label: 'Bright', icon: Sun },
  { value: 'vivid', label: 'Vivid', icon: Palette },
] as const;

type Props = {
  audioPreset: ReelAudioPreset;
  videoPreset: ReelVideoPreset;
  onAudioPresetChange: (preset: ReelAudioPreset) => void;
  onVideoPresetChange: (preset: ReelVideoPreset) => void;
  disabled?: boolean;
  accent?: 'emerald' | 'fuchsia';
};

export function MediaEnhancementTabs({
  audioPreset,
  videoPreset,
  onAudioPresetChange,
  onVideoPresetChange,
  disabled = false,
  accent = 'fuchsia',
}: Props) {
  const selectedClass = accent === 'emerald'
    ? 'border-emerald-400 bg-emerald-500/15 text-white'
    : 'border-fuchsia-400 bg-fuchsia-500/15 text-white';

  return (
    <Tabs defaultValue="audio" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 bg-black/30 p-1">
        <TabsTrigger value="audio" className="gap-2 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
          <Volume2 className="h-4 w-4" />Audio
        </TabsTrigger>
        <TabsTrigger value="video" className="gap-2 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
          <Video className="h-4 w-4" />Video
        </TabsTrigger>
      </TabsList>
      <TabsContent value="audio">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Audio enhancement preset">
          {audioOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={audioPreset === value}
              disabled={disabled}
              onClick={() => onAudioPresetChange(value)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                audioPreset === value ? selectedClass : 'border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="video">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Video enhancement preset">
          {videoOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={videoPreset === value}
              disabled={disabled}
              onClick={() => onVideoPresetChange(value)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                videoPreset === value ? selectedClass : 'border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
