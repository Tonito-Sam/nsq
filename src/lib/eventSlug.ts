export const slugifyEventTitle = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'event';

export const createEventSlug = (title: string) =>
  `${slugifyEventTitle(title)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
