import React from 'react';
import { Award, Users } from 'lucide-react';

export type VerificationBadge = {
  text: string;
  icon: React.ReactNode;
  color: string;
  tooltip?: string;
} | null;

export function getVerificationBadge(verification_level?: string | null, followers?: number, posts?: number): VerificationBadge {
  const level = verification_level || 'new';
  const f = followers ?? 0;
  const p = posts ?? 0;

  if (level === 'verified') {
    return {
      text: 'Verified',
      icon: React.createElement(Award, { className: 'h-3 w-3' }),
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
      tooltip: 'Verified Creator'
    };
  }

  if (f >= 10000 || p >= 500) {
    return {
      text: 'Influencer',
      icon: React.createElement(Users, { className: 'h-3 w-3' }),
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
      tooltip: `${f.toLocaleString()} followers • ${p} posts`
    };
  }

  if (f >= 1000 || p >= 100) {
    return {
      text: 'Popular',
      icon: React.createElement(Users, { className: 'h-3 w-3' }),
      color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      tooltip: `${f.toLocaleString()} followers • ${p} posts`
    };
  }

  if (f >= 100 || p >= 25) {
    return {
      text: 'Rising',
      icon: React.createElement(Users, { className: 'h-3 w-3' }),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      tooltip: `${f.toLocaleString()} followers • ${p} posts`
    };
  }

  return null;
}
