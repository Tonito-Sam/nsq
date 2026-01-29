interface LandscapeWarningProps {
  count: number;
}

export function LandscapeWarning({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
      <div className="flex items-start gap-3">
        <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-600 text-sm">⚠️</span>
        </div>
        <div>
          <h4 className="font-semibold text-amber-800">
            {count} video{count > 1 ? 's are' : ' is'} landscape
          </h4>
          <p className="text-sm text-amber-700 mt-1">
            Landscape videos will be <strong>center-cropped</strong> to fit the reel format.
            Important content on the sides may be lost.
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-amber-600">
            <div className="flex items-center gap-1">
              <span>🎬</span>
              <span>Record in portrait (9:16) for best results</span>
            </div>
            <div className="flex items-center gap-1">
              <span>✂️</span>
              <span>Use editing apps to add vertical letterboxing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}