import { ArrowUpRight, Link2 } from 'lucide-react';

export function extractFirstUrl(content: string): string | null {
  const match = content.match(/(?:https?:\/\/|www\.)[^\s<>"']+/i);
  if (!match) return null;

  const candidate = match[0].replace(/[),.!?;:]+$/, '');
  const normalized = /^www\./i.test(candidate) ? `https://${candidate}` : candidate;

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

interface LinkPreviewCardProps {
  content: string;
}

export function LinkPreviewCard({ content }: LinkPreviewCardProps) {
  const href = extractFirstUrl(content);
  if (!href) return null;

  const url = new URL(href);
  const host = url.hostname.replace(/^www\./i, '');
  const path = `${url.pathname}${url.search}${url.hash}`.replace(/\/$/, '') || '/';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open link to ${host}`}
      className="mt-3 flex min-w-0 items-center gap-3 overflow-hidden rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-emerald-600/50 hover:bg-emerald-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <Link2 className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{host}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400" title={href}>{path}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400" />
    </a>
  );
}