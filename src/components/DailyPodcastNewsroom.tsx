import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Newspaper, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import apiUrl from '@/lib/api';

type NewsStory = {
  id: string;
  category: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  url: string;
  categories: string[];
  coverageCount: number;
};

type CoverageCategory = 'politics' | 'sports' | 'geopolitics' | 'entertainment';

const COVERAGE_OPTIONS: { value: CoverageCategory; label: string }[] = [
  { value: 'politics', label: 'Politics' },
  { value: 'sports', label: 'Sports' },
  { value: 'geopolitics', label: 'Geopolitics' },
  { value: 'entertainment', label: 'Entertainment' },
];

export default function DailyPodcastNewsroom({
  onUseAsDraft,
}: {
  onUseAsDraft: (title: string, script: string) => void;
}) {
  const [categories, setCategories] = useState<CoverageCategory[]>(['politics', 'sports']);
  const [country, setCountry] = useState('');
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState('Africa Today');
  const [hostNames, setHostNames] = useState('Host 1, Host 2');
  const [duration, setDuration] = useState(20);
  const [script, setScript] = useState('');
  const [loadingStories, setLoadingStories] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [error, setError] = useState('');

  const loadStories = async () => {
    setLoadingStories(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in with an admin account to fetch today’s stories.');

      const response = await fetch(apiUrl('/api/daily-podcast/stories'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories: ['top', ...categories], country: country.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not fetch current stories.');

      setStories(result.stories || []);
      setGeneratedAt(result.generatedAt || new Date().toISOString());
      setScript('');
      if (result.feedErrors?.length) {
        setError(`Some feeds did not respond: ${result.feedErrors.join(', ')}. Available stories are still shown.`);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch current stories.');
    } finally {
      setLoadingStories(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, []);

  const toggleCategory = (category: CoverageCategory) => {
    setCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  };

  const generateScript = async () => {
    if (!stories.length) return;
    setGeneratingScript(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in with an admin account to generate the podcast.');

      const response = await fetch(apiUrl('/api/daily-podcast/script'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stories: stories.slice(0, 12),
          hostNames,
          showTitle,
          duration,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not generate the podcast script.');
      setScript(result.script || '');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate the podcast script.');
    } finally {
      setGeneratingScript(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Newspaper className="h-5 w-5 text-emerald-600" />
            Daily Podcast Newsroom
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gather today’s strongest stories and produce a sourced, conversational rundown for your presenters. No AI provider account is required.
          </p>
        </div>
        <Button onClick={() => void loadStories()} disabled={loadingStories} variant="outline" className="gap-2">
          {loadingStories ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh stories
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Coverage for today’s episode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Top stories
                </span>
                {COVERAGE_OPTIONS.map((option) => (
                  <label key={option.value} className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={categories.includes(option.value)}
                      onChange={() => toggleCategory(option.value)}
                      className="accent-emerald-600"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div>
                <label htmlFor="newsroom-country" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Optional country focus
                </label>
                <Input
                  id="newsroom-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="For example, Ghana or Kenya"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="newsroom-title" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Show title</label>
                  <Input id="newsroom-title" value={showTitle} onChange={(event) => setShowTitle(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="newsroom-hosts" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Presenter name(s)</label>
                  <Input id="newsroom-hosts" value={hostNames} onChange={(event) => setHostNames(event.target.value)} placeholder="One or two names" />
                </div>
              </div>
              <div className="max-w-48">
                <label htmlFor="newsroom-duration" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Target runtime (minutes)</label>
                <Input id="newsroom-duration" type="number" min="10" max="60" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">Today’s story candidates</CardTitle>
              <span className="text-xs text-muted-foreground">{stories.length} found</span>
            </CardHeader>
            <CardContent>
              {generatedAt && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Updated {new Date(generatedAt).toLocaleString()}. The rundown generator ranks stories by cross-feed coverage and recency.
                </p>
              )}
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {stories.map((story) => (
                  <article key={story.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold uppercase">{story.categories?.join(' · ') || story.category}</span>
                      <span>{story.source}{story.publishedAt ? ` · ${new Date(story.publishedAt).toLocaleDateString()}` : ''}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold">{story.headline}</h3>
                    {story.summary && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{story.summary}</p>}
                    {story.url && (
                      <a href={story.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                        Read source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </article>
                ))}
                {!stories.length && !loadingStories && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No stories loaded yet. Refresh to fetch today’s headlines.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-emerald-600" />
              Podcast rundown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              The built-in generator assembles host dialogue, transitions, discussion prompts, and source references from the headlines and publisher summaries. It does not invent reporting; verify details at the linked sources before recording.
            </p>
            <Button onClick={() => void generateScript()} disabled={generatingScript || loadingStories || !stories.length} className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800">
              {generatingScript ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generatingScript ? 'Producing rundown…' : 'Produce today’s rundown'}
            </Button>
            {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
            <textarea
              aria-label="Generated podcast script"
              value={script}
              onChange={(event) => setScript(event.target.value)}
              placeholder="Your sourced host script will appear here after today’s stories load."
              className="min-h-[34rem] w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
            <Button variant="outline" onClick={() => onUseAsDraft(showTitle, script)} disabled={!script.trim()} className="w-full">
              Load script into show draft
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}