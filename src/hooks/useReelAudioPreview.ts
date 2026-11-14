import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { connectReelAudioEffects, type ReelAudioPreset } from '@/utils/animatedReelCaptions';

type AudioPreviewGraph = {
  video: HTMLVideoElement;
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  nodes: AudioNode[];
};

export function useReelAudioPreview(
  videoRef: RefObject<HTMLVideoElement>,
  onError: (message: string) => void,
) {
  const graphRef = useRef<AudioPreviewGraph | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const dispose = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;

    graph.source.disconnect();
    graph.nodes.forEach((node) => node.disconnect());
    graphRef.current = null;
    if (graph.context.state !== 'closed') {
      void graph.context.close().catch((error: unknown) => {
        console.error('[ReelAudioPreview] Could not close audio preview:', error);
      });
    }
  }, []);

  const applyPreset = useCallback((preset: ReelAudioPreset) => {
    const video = videoRef.current;
    if (!video) return false;

    let graph = graphRef.current;
    if (preset === 'original' && !graph) return true;

    try {
      if (graph && graph.video !== video) {
        dispose();
        graph = null;
      }

      if (!graph) {
        const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
        const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
        if (!AudioContextConstructor) {
          onErrorRef.current('This browser cannot preview audio enhancements. You can still render the selected effects.');
          return false;
        }
        const context = new AudioContextConstructor();
        graph = {
          video,
          context,
          source: context.createMediaElementSource(video),
          nodes: [],
        };
        graphRef.current = graph;
      }

      graph.source.disconnect();
      graph.nodes.forEach((node) => node.disconnect());
      graph.nodes = connectReelAudioEffects(graph.context, graph.source, graph.context.destination, preset);
      if (graph.context.state === 'suspended') {
        void graph.context.resume().catch((error: unknown) => {
          console.error('[ReelAudioPreview] Could not start audio preview:', error);
          onErrorRef.current('Tap the video or select an audio preset again to enable audio preview.');
        });
      }
      return true;
    } catch (error) {
      console.error('[ReelAudioPreview] Could not apply audio preview:', error);
      onErrorRef.current('This browser could not apply the selected audio effect. Try another preset or render the recording.');
      return false;
    }
  }, [dispose, videoRef]);

  useEffect(() => () => dispose(), [dispose]);

  return { applyPreset, dispose };
}
