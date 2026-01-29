import { createReactClient, studioProvider } from '@livepeer/react';

const apiKey = import.meta.env.VITE_LIVEPEER_API_KEY;

export const livepeerClient = createReactClient({
  provider: studioProvider({ apiKey }),
});
