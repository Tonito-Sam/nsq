export interface EventRegistrationExportRow {
  full_name: string;
  username: string | null;
  email: string;
  phone: string | null;
  custom_answers: unknown;
  created_at: string;
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const getAnswers = (answers: unknown): string[] =>
  Array.isArray(answers)
    ? answers.map((answer) => typeof answer === 'string' ? answer : '')
    : [];

export const buildEventRegistrationsCsv = (
  questions: string[],
  registrations: EventRegistrationExportRow[],
) => {
  const headers = ['Full name', 'Username', 'Email', 'Phone', 'Registered at', ...questions];
  const rows = registrations.map((registration) => {
    const answers = getAnswers(registration.custom_answers);
    return [
      registration.full_name,
      registration.username || 'Guest',
      registration.email,
      registration.phone || '',
      registration.created_at,
      ...questions.map((_, index) => answers[index] || ''),
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
};

export const downloadEventRegistrationsCsv = (
  eventTitle: string,
  eventId: string,
  questions: string[],
  registrations: EventRegistrationExportRow[],
) => {
  const csv = buildEventRegistrationsCsv(questions, registrations);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const titleSlug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || eventId;
  link.href = url;
  link.download = `event-registrations-${titleSlug}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
