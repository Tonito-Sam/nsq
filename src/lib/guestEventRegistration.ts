export interface GuestEventTicketReference {
  registrationId: string;
  email: string;
}

export interface PendingGuestEventSignup extends GuestEventTicketReference {
  fullName: string;
  returnTo: string;
}

const pendingSignupStorageKey = 'pending-guest-event-signup';
const ticketStorageKey = (postId: string) => `guest-event-ticket:${postId}`;

const parseTicketReference = (value: string | null): GuestEventTicketReference | null => {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'registrationId' in parsed
      && typeof parsed.registrationId === 'string'
      && 'email' in parsed
      && typeof parsed.email === 'string'
    ) {
      return { registrationId: parsed.registrationId, email: parsed.email };
    }
  } catch {
    return null;
  }

  return null;
};

export const saveGuestEventTicketReference = (postId: string, reference: GuestEventTicketReference) => {
  localStorage.setItem(ticketStorageKey(postId), JSON.stringify(reference));
};

export const getGuestEventTicketReference = (postId: string) =>
  parseTicketReference(localStorage.getItem(ticketStorageKey(postId)));

export const savePendingGuestEventSignup = (signup: PendingGuestEventSignup) => {
  localStorage.setItem(pendingSignupStorageKey, JSON.stringify(signup));
};

export const getPendingGuestEventSignup = (): PendingGuestEventSignup | null => {
  const rawValue = localStorage.getItem(pendingSignupStorageKey);
  const parsed = parseTicketReference(rawValue);
  if (!parsed) return null;

  try {
    const value: unknown = JSON.parse(rawValue || '');
    if (typeof value !== 'object' || value === null || !('fullName' in value) || !('returnTo' in value)) {
      return null;
    }
    if (
      typeof value.fullName === 'string'
      && value.fullName.trim().length > 0
      && typeof value.returnTo === 'string'
      && value.returnTo.startsWith('/event/')
      && !value.returnTo.startsWith('//')
    ) {
      return { ...parsed, fullName: value.fullName, returnTo: value.returnTo };
    }
  } catch {
    return null;
  }

  return null;
};

export const clearPendingGuestEventSignup = () => {
  localStorage.removeItem(pendingSignupStorageKey);
};
