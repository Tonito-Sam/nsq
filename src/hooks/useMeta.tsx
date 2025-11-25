import { useEffect } from 'react';

type MetaOptions = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

function setTag(name: string, content: string | undefined, isProperty = false) {
  if (!content) return;
  const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    if (isProperty) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function useMeta(opts: MetaOptions) {
  useEffect(() => {
    const defaultTitle = document.title || 'NexSq';
    if (opts.title) {
      document.title = opts.title;
      setTag('og:title', opts.title, true);
      setTag('twitter:title', opts.title);
    } else {
      document.title = defaultTitle;
    }

    if (opts.description) {
      setTag('description', opts.description);
      setTag('og:description', opts.description, true);
      setTag('twitter:description', opts.description);
    }

    if (opts.image) {
      setTag('og:image', opts.image, true);
      setTag('twitter:image', opts.image);
    }

    if (opts.url) {
      setTag('og:url', opts.url, true);
    }

    // set default twitter:card if not set
    const existing = document.head.querySelector('meta[name="twitter:card"]');
    if (!existing) {
      const el = document.createElement('meta');
      el.setAttribute('name', 'twitter:card');
      el.setAttribute('content', 'summary_large_image');
      document.head.appendChild(el);
    }
  }, [opts.title, opts.description, opts.image, opts.url]);
}
