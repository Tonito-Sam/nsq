import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Grid3X3,
  Megaphone,
  MessageCircle,
  Settings,
  ShoppingBag,
  Store,
  User,
  Wallet,
} from 'lucide-react';

export interface QuickLink {
  key: string;
  icon: LucideIcon;
  label: string;
  route: string;
  bg: string;
  text: string;
  ring: string;
}

export const QUICK_LINKS: QuickLink[] = [
  { key: 'profile', icon: User, label: 'Profile', route: '/profile', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/20' },
  { key: 'wallet', icon: Wallet, label: 'Wallet', route: '/wallet', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20' },
  { key: 'ad-center', icon: Megaphone, label: 'Ad Center', route: '/campaigns', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/20' },
  { key: 'store', icon: Store, label: 'My Store', route: '/my-store', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  { key: 'orders', icon: ShoppingBag, label: 'My Orders', route: '/my-store?section=orders', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-500/20' },
  { key: 'square', icon: Grid3X3, label: 'Square', route: '/square', bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/20' },
  { key: 'messages', icon: MessageCircle, label: 'Messages', route: '/messages', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20' },
  { key: 'events', icon: Calendar, label: 'Events', route: '/events', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/20' },
  { key: 'settings', icon: Settings, label: 'Settings', route: '/settings', bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/20' },
];