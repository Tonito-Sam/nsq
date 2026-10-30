import React, { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, Sparkles, Palette, Image as ImageIcon, Calendar, Users, Globe, Filter, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { applyMemeFilter } from '../../lib/image-processing';
import { specialBackgrounds, SpecialBackground } from './specialBackgrounds';
import { cn } from '@/lib/utils';
import { insertSharedFeedPost } from '@/lib/feedShare';
import { sendNotification } from '@/lib/notifications';

// Types
interface SpecialDay {
  id: string;
  name: string;
  description: string;
  icon: string;
  background: string;
  date_type: 'fixed' | 'rule' | 'birthday';
  date_rule?: string;
  fixed_date?: string;
  country_codes?: string[];
  is_global: boolean;
  category: 'holiday' | 'observance' | 'birthday' | 'anniversary' | 'custom';
  personName?: string;
  personRelationship?: string;
  personUserId?: string;
  personUsername?: string;
}

interface BirthdayUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  date_of_birth: string;
}

// Preset configurations - optimized for mobile
const PRESET_COLORS = [
  '#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
];

const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Playfair Display', 
  'Pacifico', 'Comic Neue', 'Courier Prime'
];

const FONT_SIZES = [16, 20, 24, 28, 32, 36, 40];

const MEME_FILTERS = [
  { name: 'Classic', value: 'classic', description: 'High contrast' },
  { name: 'Posterize', value: 'posterize', description: 'Reduced colors' },
  { name: 'Comic', value: 'comic', description: 'Bold outlines' },
  { name: 'Vintage', value: 'vintage', description: 'Sepia tones' },
  { name: 'Cartoon', value: 'cartoon', description: 'Animated style' },
  { name: 'Pixel', value: 'pixel', description: '8-bit effect' },
];

// Helper functions
function getUserCountry(user: any): string | null {
  return user?.country || 'US';
}

function getContrastYIQ(bg: string): '#222' | '#fff' {
  if (!bg) return '#fff';
  if (bg.startsWith('url(') || bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) return '#fff';
  let hex = bg.trim();
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#fff';
  const r = parseInt(hex.substr(0,2), 16);
  const g = parseInt(hex.substr(2,2), 16);
  const b = parseInt(hex.substr(4,2), 16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return yiq >= 180 ? '#222' : '#fff';
}

function isTodaySpecial(bg: SpecialBackground, userCountry: string | null): boolean {
  const today = dayjs();
  const isAvailableForCountry = bg.countries.includes('ALL') || 
                                (userCountry && bg.countries.includes(userCountry));
  if (!isAvailableForCountry) return false;
  
  if (typeof bg.date === 'string' && /^\d{2}-\d{2}$/.test(bg.date)) {
    const [month, day] = bg.date.split('-');
    return today.format('MM-DD') === `${month}-${day}`;
  }
  
  if (typeof bg.date === 'object' && bg.date.rule) {
    const rule = bg.date.rule;
    switch (rule) {
      case 'second Sunday in May':
        if (today.month() !== 4) return false;
        if (today.day() !== 0) return false;
        return Math.ceil(today.date() / 7) === 2;
      case 'third Sunday in June':
        if (today.month() !== 5) return false;
        if (today.day() !== 0) return false;
        return Math.ceil(today.date() / 7) === 3;
      default:
        return false;
    }
  }
  
  return false;
}

function convertStaticToSpecialDay(bg: SpecialBackground): SpecialDay {
  return {
    id: bg.id,
    name: bg.name.length > 15 ? bg.name.substring(0, 15) + '...' : bg.name,
    description: bg.description || `Celebrate ${bg.name}!`,
    icon: bg.icon || '🎉',
    background: bg.background,
    date_type: typeof bg.date === 'string' ? 'fixed' : 'rule',
    date_rule: typeof bg.date === 'object' ? bg.date.rule : undefined,
    fixed_date: typeof bg.date === 'string' ? bg.date : undefined,
    country_codes: bg.countries,
    is_global: bg.countries.includes('ALL'),
    category: bg.name.toLowerCase().includes('day') ? 'holiday' : 'observance'
  };
}

async function fetchBirthdayUsers(): Promise<BirthdayUser[]> {
  const today = dayjs();
  const { data: usersData, error } = await supabase
    .from('users')
    .select('id, username, first_name, last_name, avatar_url, birthday')
    .not('birthday', 'is', null)
    .limit(1000);

  if (error) {
    console.error('Error fetching birthdays:', error);
    return [];
  }

  const matches = (usersData || []).filter((u: any) => {
    if (!u?.birthday) return false;
    const b = dayjs(u.birthday);
    return b.isValid() && b.month() === today.month() && b.date() === today.date();
  }).map((u: any) => ({
    id: u.id,
    username: u.username,
    full_name: (u.first_name || '') + (u.last_name ? ` ${u.last_name}` : ''),
    avatar_url: u.avatar_url,
    date_of_birth: u.birthday,
  } as BirthdayUser));

  return matches;
}

function generateBirthdaySpecialDay(user: BirthdayUser): SpecialDay {
  const colors = [
    'linear-gradient(135deg, #FF9A9E 0%, #FAD0C4 100%)',
    'linear-gradient(135deg, #A1C4FD 0%, #C2E9FB 100%)',
    'linear-gradient(135deg, #FFD1FF 0%, #FAD0C4 100%)',
    'linear-gradient(135deg, #FFECD2 0%, #FCB69F 100%)',
    'linear-gradient(135deg, #84FAB0 0%, #8FD3F4 100%)',
  ];
  
  return {
    id: `birthday-${user.id}`,
    name: `${user.full_name || user.username}'s Bday`,
    description: `Happy birthday!`,
    icon: '🎂',
    background: colors[Math.floor(Math.random() * colors.length)],
    date_type: 'birthday',
    fixed_date: user.date_of_birth,
    is_global: false,
    category: 'birthday'
  };
}

async function fetchProfileCelebrations(userId: string): Promise<SpecialDay[]> {
  const { data, error } = await supabase
    .from('users')
    .select('first_name, last_name, birthday, anniversary1_date, anniversary1_label, anniversary1_relationship, anniversary1_person_name, anniversary1_person_user_id, anniversary2_date, anniversary2_label, anniversary2_relationship, anniversary2_person_name, anniversary2_person_user_id, anniversary3_date, anniversary3_label, anniversary3_relationship, anniversary3_person_name, anniversary3_person_user_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('Could not load profile celebrations:', error.message);
    return [];
  }

  const colors = [
    'linear-gradient(135deg, #F6A6B2 0%, #C9B6E4 100%)',
    'linear-gradient(135deg, #F7C59F 0%, #F2A7A0 100%)',
    'linear-gradient(135deg, #84C7C1 0%, #A6C8E8 100%)',
    'linear-gradient(135deg, #EDB7D2 0%, #F5D79A 100%)',
  ];
  const profileName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  const linkedPersonIds = [1, 2, 3]
    .map((number) => data[`anniversary${number}_person_user_id` as keyof typeof data] as string | null)
    .filter((id): id is string => Boolean(id));
  const { data: linkedPeople } = linkedPersonIds.length
    ? await supabase.from('users').select('id, username').in('id', linkedPersonIds)
    : { data: [] as Array<{ id: string; username: string }> };
  const usernamesById = new Map((linkedPeople || []).map((person: any) => [person.id, person.username]));
  const days: SpecialDay[] = [];

  if (data.birthday) {
    days.push({
      id: 'profile-birthday',
      name: profileName ? `${profileName}'s Birthday` : 'My Birthday',
      description: `Celebrate your birthday${dayjs(data.birthday).isValid() ? ` on ${dayjs(data.birthday).format('MMM D')}` : ''}!`,
      icon: '🎂',
      background: colors[0],
      date_type: 'birthday',
      fixed_date: data.birthday,
      is_global: false,
      category: 'birthday',
    });
  }

  [1, 2, 3].forEach((number) => {
    const date = data[`anniversary${number}_date` as keyof typeof data] as string | null;
    if (!date) return;
    const label = (data[`anniversary${number}_label` as keyof typeof data] as string | null)?.trim() || 'Anniversary';
    const personName = (data[`anniversary${number}_person_name` as keyof typeof data] as string | null)?.trim() || '';
    const personRelationship = (data[`anniversary${number}_relationship` as keyof typeof data] as string | null)?.trim() || '';
    const personUserId = (data[`anniversary${number}_person_user_id` as keyof typeof data] as string | null) || undefined;
    const dateLabel = dayjs(date).isValid() ? ` on ${dayjs(date).format('MMM D')}` : '';
    days.push({
      id: `profile-anniversary-${number}`,
      name: label,
      description: `Celebrate your ${label.toLowerCase()}${personName ? ` with ${personName}` : ''}${dateLabel}!`,
      icon: '💐',
      background: colors[number],
      date_type: 'fixed',
      fixed_date: date,
      is_global: false,
      category: 'anniversary',
      personName: personName || undefined,
      personRelationship: personRelationship || undefined,
      personUserId,
      personUsername: personUserId ? usernamesById.get(personUserId) : undefined,
    });
  });

  return days;
}

async function createCelebrationCard({
  title,
  message,
  icon,
  background,
  photoFiles = [],
  photoLabels = [],
}: {
  title: string;
  message: string;
  icon: string;
  background: string;
  photoFiles?: File[];
  photoLabels?: string[];
}): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the celebration card.');

  const colors = background.match(/#[\da-f]{6}/gi) || ['#187C75', '#224A5A'];
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1] || colors[0]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(10, 24, 34, 0.22)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(255,255,255,0.16)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(900, 190, 250, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(125, 1170, 190, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = 'rgba(255,255,255,0.10)';
  context.beginPath();
  context.roundRect(70, 70, 940, 1210, 48);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 2;
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = '#FFFFFF';
  context.font = '600 30px Arial, sans-serif';
  context.fillText('A MOMENT TO CELEBRATE', 540, 235);

  const photos = photoFiles.slice(0, 2);
  if (photos.length) {
    const frameSize = photos.length === 1 ? 360 : 300;
    const frameY = 295;
    const frameXs = photos.length === 1 ? [360] : [210, 570];
    for (let index = 0; index < photos.length; index += 1) {
      const bitmap = await createImageBitmap(photos[index]);
      const scale = Math.max(frameSize / bitmap.width, frameSize / bitmap.height);
      const cropWidth = frameSize / scale;
      const cropHeight = frameSize / scale;
      const cropX = (bitmap.width - cropWidth) / 2;
      const cropY = (bitmap.height - cropHeight) / 2;
      const frameX = frameXs[index];

      context.save();
      context.beginPath();
      context.roundRect(frameX, frameY, frameSize, frameSize, 32);
      context.clip();
      context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, frameX, frameY, frameSize, frameSize);
      context.restore();
      bitmap.close();

      context.strokeStyle = 'rgba(255,255,255,0.9)';
      context.lineWidth = 8;
      context.beginPath();
      context.roundRect(frameX, frameY, frameSize, frameSize, 32);
      context.stroke();
      context.fillStyle = 'rgba(10, 24, 34, 0.6)';
      context.beginPath();
      context.roundRect(frameX + 18, frameY + frameSize - 62, frameSize - 36, 44, 18);
      context.fill();
      context.fillStyle = '#FFFFFF';
      context.font = '600 24px Arial, sans-serif';
      context.fillText(photoLabels[index] || `Photo ${index + 1}`, frameX + frameSize / 2, frameY + frameSize - 32, frameSize - 48);
    }
  }

  context.font = '120px Arial, sans-serif';
  context.fillText(icon, 540, photos.length ? 790 : 500);

  const drawWrappedText = (value: string, startY: number, font: string, lineHeight: number, maxLines: number) => {
    context.font = font;
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > 820) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((textLine, index) => {
      context.fillText(textLine, 540, startY + index * lineHeight, 840);
    });
    return Math.min(lines.length, maxLines) * lineHeight;
  };

  const titleStartY = photos.length ? 875 : 650;
  const titleHeight = drawWrappedText(title, titleStartY, '700 64px Arial, sans-serif', 78, photos.length ? 2 : 3);
  context.fillStyle = 'rgba(255,255,255,0.88)';
  drawWrappedText(message, titleStartY + titleHeight + 20, '400 38px Arial, sans-serif', 54, photos.length ? 3 : 5);
  context.fillStyle = 'rgba(255,255,255,0.72)';
  context.font = '500 24px Arial, sans-serif';
  context.fillText('NEXSQ  •  CELEBRATIONS', 540, photos.length ? 1300 : 1190);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not export the celebration card.')), 'image/png');
  });
  return new File([blob], `celebration-${Date.now()}.png`, { type: 'image/png' });
}

interface TextMomentCreatorProps {
  user: any;
  onMomentCreated?: (inserted?: any) => void;
  isUploading?: boolean;
  setIsUploading?: Dispatch<SetStateAction<boolean>>;
}

const TextMomentCreator: React.FC<TextMomentCreatorProps> = ({ 
  user, 
  onMomentCreated, 
  isUploading: propsIsUploading, 
  setIsUploading: propsSetIsUploading 
}) => {
  const [text, setText] = useState('');
  const [bg, setBg] = useState<string>(PRESET_COLORS[0]);
  const [font, setFont] = useState(FONTS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
  const [customColor, setCustomColor] = useState('');
  const [selectedSpecial, setSelectedSpecial] = useState<SpecialDay | null>(null);
  const [customSpecialMessage, setCustomSpecialMessage] = useState('');
  const [celebrationPhotos, setCelebrationPhotos] = useState<Array<File | null>>([]);
  const [celebrationPhotoPreviews, setCelebrationPhotoPreviews] = useState<Array<string | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [localIsUploading, setLocalIsUploading] = useState(false);
  const isUploading = propsIsUploading ?? localIsUploading;
  const setIsUploading = propsSetIsUploading ?? setLocalIsUploading;
  const [activeTab, setActiveTab] = useState('simple');
  
  const [customSpecialActive, setCustomSpecialActive] = useState(false);
  const [customSpecialBg, setCustomSpecialBg] = useState<string>(PRESET_COLORS[1]);
  const [customSpecialIcon, setCustomSpecialIcon] = useState<string>('🎉');
  const [customSpecialName, setCustomSpecialName] = useState('My Special Day');
  const [customSpecialMsg, setCustomSpecialMsg] = useState('');
  const [shareToFeed, setShareToFeed] = useState(false);
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('classic');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  
  // Mobile-specific states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const queryClient = useQueryClient();
  const userCountry = getUserCountry(user);
  const isCelebration = Boolean(selectedSpecial || customSpecialActive);
  const celebrationPhotoSlots = selectedSpecial?.category === 'anniversary'
    ? ['You', selectedSpecial.personName || 'Spouse / Partner']
    : selectedSpecial?.category === 'birthday'
      ? [selectedSpecial.id === 'profile-birthday' ? 'Your photo' : 'Celebrant photo']
      : [];

  const clearCelebrationPhotos = () => {
    celebrationPhotoPreviews.forEach((preview) => preview && URL.revokeObjectURL(preview));
    setCelebrationPhotos([]);
    setCelebrationPhotoPreviews([]);
  };
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Get static special backgrounds for today
  const staticSpecialDays = React.useMemo(() => {
    return specialBackgrounds
      .filter(bg => isTodaySpecial(bg, userCountry))
      .map(bg => convertStaticToSpecialDay(bg));
  }, [userCountry]);

  const todayDate = dayjs().format('YYYY-MM-DD');
  const { data: platformSpecialDays = [] } = useQuery<SpecialDay[]>({
    queryKey: ['platform-special-days', todayDate],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_special_days')
        .select('id, event_date, country_code, name, local_name, description, icon, background, event_types, is_national')
        .eq('event_date', todayDate)
        .eq('is_enabled', true)
        .order('country_code', { ascending: true });
      if (error) {
        console.warn('Could not load platform special days:', error.message);
        return [];
      }
      return (data || []).map((event: any) => ({
        id: `platform-${event.id}`,
        name: event.local_name || event.name,
        description: event.description || `Celebrate ${event.local_name || event.name}!`,
        icon: event.icon || '🎉',
        background: event.background,
        date_type: 'fixed' as const,
        fixed_date: dayjs(event.event_date).format('MM-DD'),
        country_codes: [event.country_code],
        is_global: false,
        category: event.event_types?.includes('Public') ? 'holiday' as const : 'observance' as const,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch birthdays from database
  const { data: birthdayUsers = [], isLoading: isLoadingBirthdays } = useQuery({
    queryKey: ['birthdayUsers'],
    queryFn: fetchBirthdayUsers,
    enabled: !!user,
  });

  const { data: profileCelebrations = [] } = useQuery({
    queryKey: ['profile-celebrations', user?.id],
    queryFn: () => fetchProfileCelebrations(user.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Combine all special days
  const allSpecialDays = React.useMemo(() => {
    const birthdays = birthdayUsers.map(generateBirthdaySpecialDay);
    const combined = [...profileCelebrations, ...staticSpecialDays, ...platformSpecialDays, ...birthdays];
    
    if (countryFilter !== 'all') {
      if (countryFilter === 'profile') return combined.filter(day => day.id.startsWith('profile-'));
      if (countryFilter === 'birthday') return combined.filter(day => day.category === 'birthday' || day.category === 'anniversary');
      if (countryFilter === 'global') return combined.filter(day => day.is_global);
      return combined.filter(day => 
        day.is_global || 
        day.country_codes?.includes(countryFilter) ||
        day.category === 'birthday' ||
        day.category === 'anniversary'
      );
    }
    
    return combined;
  }, [staticSpecialDays, platformSpecialDays, birthdayUsers, profileCelebrations, countryFilter]);
  
  // Get unique countries
  const availableCountries = React.useMemo(() => {
    const countries = new Set<string>();
    specialBackgrounds.forEach(bg => {
      bg.countries.forEach(country => {
        if (country !== 'ALL') countries.add(country);
      });
    });
    platformSpecialDays.forEach(day => day.country_codes?.forEach(country => countries.add(country)));
    return Array.from(countries).sort();
  }, [platformSpecialDays]);
  
  // Handler functions
  const handleBgSelect = (color: string) => {
    setSelectedSpecial(null);
    clearCelebrationPhotos();
    setBg(color);
    setCustomSpecialActive(false);
    setUploadedImage(null);
    setImagePreview(null);
  };
  
  const handleSpecialSelect = (day: SpecialDay) => {
    clearCelebrationPhotos();
    setSelectedSpecial(day);
    setBg(day.background);
    setUploadedImage(null);
    setImagePreview(null);
    setActiveTab('special');
    setText((current) => current.trim() || (
      day.category === 'birthday'
        ? `Happy birthday, ${day.name.replace(/'s Birthday$| Bday$/, '')}!`
        : day.category === 'anniversary'
          ? `Happy ${day.name.toLowerCase()}!`
          : `Celebrating ${day.name}!`
    ));
  };

  const handleCelebrationPhotoChange = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for the celebration card.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Each celebration photo must be 5MB or less.');
      return;
    }

    setCelebrationPhotos((current) => {
      const next = [...current];
      next[index] = file;
      return next;
    });
    setCelebrationPhotoPreviews((current) => {
      const next = [...current];
      if (next[index]) URL.revokeObjectURL(next[index]!);
      next[index] = URL.createObjectURL(file);
      return next;
    });
  };
  
  const handleImageUpload = async (file: File) => {
    if (!file.type.match('image.*')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    const previewUrl = URL.createObjectURL(file);
    setUploadedImage(file);
    setImagePreview(previewUrl);
    setSelectedSpecial(null);
    setCustomSpecialActive(false);
    setActiveTab('image');
    
    setIsProcessingImage(true);
    try {
      const processedImageUrl = await applyMemeFilter(file, selectedFilter);
      setBg(`url('${processedImageUrl}')`);
      toast.success('Image processed!');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
      setBg(`url('${previewUrl}')`);
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  const handleFilterChange = async (filter: string) => {
    if (!uploadedImage) return;
    
    setSelectedFilter(filter);
    setIsProcessingImage(true);
    try {
      const processedImageUrl = await applyMemeFilter(uploadedImage, filter);
      setBg(`url('${processedImageUrl}')`);
    } catch (error) {
      console.error('Error applying filter:', error);
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  const handlePostMoment = async () => {
    if (!user) {
      toast.error('You must be logged in to post a moment');
      return;
    }
    
    const isCelebration = Boolean(selectedSpecial || customSpecialActive);
    if (!text.trim() && !isCelebration) {
      setError('Text is required');
      toast.error('Please add some text to your moment');
      return;
    }
    
    if ((customSpecialActive ? customSpecialMsg : customSpecialMessage).length > 60) {
      setError('Special message must be 60 characters or less');
      toast.error('Special message is too long');
      return;
    }

    const requiredCelebrationPhotos = selectedSpecial?.category === 'anniversary'
      ? 2
      : selectedSpecial?.category === 'birthday'
        ? 1
        : 0;
    const selectedCelebrationPhotos = celebrationPhotos.filter((file): file is File => Boolean(file));
    if (selectedCelebrationPhotos.length < requiredCelebrationPhotos) {
      setError(requiredCelebrationPhotos === 2
        ? 'Add both your photo and your spouse/partner photo for an anniversary card.'
        : 'Add a birthday photo before creating this celebration card.');
      toast.error(requiredCelebrationPhotos === 2
        ? 'Choose both anniversary photos.'
        : 'Choose a birthday photo.');
      return;
    }
    
    setError(null);
    setIsUploading(true);
    
    try {
      let imageUrl = null;
      const celebrationTitle = customSpecialActive ? customSpecialName : selectedSpecial?.name || '';
      const celebrationIcon = customSpecialActive ? customSpecialIcon : selectedSpecial?.icon || '🎉';
      const celebrationBackground = customSpecialActive ? customSpecialBg : selectedSpecial?.background || bg;
      const celebrationMessage = customSpecialActive
        ? customSpecialMsg.trim() || text.trim()
        : customSpecialMessage.trim() || selectedSpecial?.description || text.trim();
      const taggedPersonId = selectedSpecial?.personUserId;
      const taggedPersonUsername = selectedSpecial?.personUsername;
      const caption = [
        text.trim() || celebrationMessage,
        taggedPersonId && taggedPersonUsername ? `Celebrating with @${taggedPersonUsername}` : '',
      ].filter(Boolean).join('\n');
      const cardFile = isCelebration
        ? await createCelebrationCard({
            title: celebrationTitle,
            message: celebrationMessage,
            icon: celebrationIcon,
            background: celebrationBackground,
            photoFiles: selectedCelebrationPhotos,
            photoLabels: celebrationPhotoSlots,
          })
        : uploadedImage;

      if (cardFile) {
        const fileExt = cardFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('moment-images')
          .upload(fileName, cardFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('moment-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      const insertObj: any = {
        user_id: user.id,
        content: caption,
        post_type: 'moment',
        privacy: 'public',
        moment_type: cardFile ? 'image' : 'text',
        moment_bg: imageUrl ? `url('${imageUrl}')` : bg,
        moment_font: font,
        moment_font_size: fontSize,
        processed_image_url: imageUrl || null,
        meme_filter: uploadedImage && !isCelebration ? selectedFilter : null,
        share_to_feed: isCelebration ? false : shareToFeed,
      };
      
      if (selectedSpecial) {
        insertObj.moment_special_message = customSpecialMessage.trim() || selectedSpecial.description;
        insertObj.moment_special_icon = selectedSpecial.icon;
        insertObj.moment_special_name = selectedSpecial.name;
        insertObj.moment_special_id = selectedSpecial.id;
        insertObj.moment_special_type = selectedSpecial.category;
        
        if (selectedSpecial.country_codes) {
          insertObj.moment_special_countries = selectedSpecial.country_codes;
        }
      }
      
      if (customSpecialActive) {
        insertObj.is_custom_special_day = true;
        insertObj.moment_special_message = customSpecialMsg.trim() || undefined;
        insertObj.moment_special_icon = customSpecialIcon;
        insertObj.moment_special_name = customSpecialName;
        insertObj.moment_special_bg = customSpecialBg;
      }
      
      const { data: inserted, error: insertError } = await supabase
        .from('posts')
        .insert(insertObj)
        .select(`
          *,
          profiles:user_id (
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single();
      
      if (insertError) throw insertError;

      let feedShareFailed = false;
      if (isCelebration && imageUrl) {
        try {
          const { data: feedPost, error: feedError } = await insertSharedFeedPost({
            supabaseClient: supabase,
            userId: user.id,
            caption,
            mediaUrl: imageUrl,
            audience: 'public',
            sourceType: 'image',
            taggedUserIds: taggedPersonId ? [taggedPersonId] : [],
          });
          if (feedError) throw feedError;
          if (taggedPersonId && feedPost?.id) {
            const actorName = [user.user_metadata?.first_name, user.user_metadata?.last_name]
              .filter(Boolean)
              .join(' ') || user.user_metadata?.username || 'Someone';
            await sendNotification({
              user_id: taggedPersonId,
              actor_id: user.id,
              type: 'mention',
              object_type: 'posts',
              object_id: feedPost.id,
              title: 'You were tagged in a celebration',
              message: `${actorName} tagged you in a celebration post.`,
              data: { postId: feedPost.id, userId: user.id },
            });
          }
        } catch (feedError) {
          feedShareFailed = true;
          console.error('Celebration Moment created but feed post failed:', feedError);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      
      queryClient.setQueryData(['posts'], (old: any) => {
        if (!old) return old;
        
        const newPost = {
          ...inserted,
          profiles: inserted.profiles,
          comments_count: 0,
          likes_count: 0,
          shares_count: 0,
          reposts_count: 0,
          is_liked: false,
          is_shared: false,
        };
        
        if (Array.isArray(old.pages)) {
          const newPages = old.pages.map((page: any, idx: number) => {
            if (idx === 0) return { ...page, posts: [newPost, ...(page.posts || [])] };
            return page;
          });
          return { ...old, pages: newPages };
        }
        
        return { ...old, posts: [newPost, ...(old.posts || [])] };
      });
      
      if (onMomentCreated) onMomentCreated(inserted);
      
      if (feedShareFailed) {
        toast.warning('Your celebration Moment is live, but its feed post could not be created.');
      } else if (isCelebration) {
        toast.success('Celebration card shared to Moments and the main feed!');
      } else {
        toast.success('Moment shared successfully!');
      }
      
      // Reset form
      setText('');
      setCustomColor('');
      setSelectedSpecial(null);
      setCustomSpecialMessage('');
      setCustomSpecialActive(false);
      setCustomSpecialBg(PRESET_COLORS[1]);
      setCustomSpecialIcon('🎉');
      setCustomSpecialName('My Special Day');
      setCustomSpecialMsg('');
      clearCelebrationPhotos();
      setBg(PRESET_COLORS[0]);
      setFont(FONTS[0]);
      setFontSize(FONT_SIZES[2]);
      setUploadedImage(null);
      setImagePreview(null);
      setShareToFeed(false);
      setActiveTab('simple');
      
    } catch (err: any) {
      console.error('Error posting moment:', err);
      setError(err.message || 'Failed to post moment');
      toast.error(err.message || 'Failed to post moment');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Preview style - optimized for mobile
  const previewStyle: React.CSSProperties = {
    background: bg,
    backgroundSize: bg.startsWith('url') ? 'cover' : 'auto',
    backgroundPosition: 'center',
    color: getContrastYIQ(bg),
    fontFamily: font,
    fontSize: isMobile ? `${Math.min(fontSize, 28)}px` : `${fontSize}px`,
    minHeight: isMobile ? 200 : 280,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    borderRadius: 12,
    padding: isMobile ? 16 : 20,
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  };
  
  return (
    <div className="max-w-4xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
      {/* Header - Optimized for mobile */}
      <div className="text-center mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Create Your Special Moment
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Celebrate holidays, birthdays, or create your own special day
        </p>
      </div>
      
      {/* Text Input - Compact */}
      <Card className="border border-border/50">
        <CardContent className="pt-4 md:pt-6">
          <textarea
            className="w-full rounded-lg md:rounded-xl border border-border p-3 md:p-4 text-sm md:text-base bg-background text-foreground focus:border-primary focus:ring-1 md:focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            rows={3}
            placeholder="What's on your mind? Share your special moment..."
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ fontFamily: font, fontSize: `${fontSize}px` }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs md:text-sm text-muted-foreground">
              {text.length}/500
            </span>
            {userCountry && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {userCountry}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Mobile-friendly Tabs */}
      <Tabs defaultValue="simple" value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className={cn(
            "grid w-full mb-3 md:mb-4",
            isMobile ? "grid-cols-4 h-10" : "grid-cols-4 h-11"
          )}>
            <TabsTrigger value="simple" className="text-xs md:text-sm px-2 md:px-4">
              <Palette className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isMobile ? 'Simple' : 'Simple'}
            </TabsTrigger>
            <TabsTrigger value="special" className="text-xs md:text-sm px-2 md:px-4">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isMobile ? `Days (${allSpecialDays.length})` : `Special Days (${allSpecialDays.length})`}
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs md:text-sm px-2 md:px-4">
              <ImageIcon className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isMobile ? 'Image' : 'Upload'}
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs md:text-sm px-2 md:px-4">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isMobile ? 'Custom' : 'Custom'}
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        {/* Simple Backgrounds Tab - Mobile Optimized */}
        <TabsContent value="simple">
          <Card className="border border-border/50">
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-4 md:space-y-6">
                {/* Background Colors - Compact */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Choose Background</Label>
                    <Badge variant="outline" className="text-xs">
                      {PRESET_COLORS.length} colors
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {PRESET_COLORS.map((color, i) => (
                      <button
                        key={i}
                        className={cn(
                          "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white shadow transition-all",
                          bg === color && "ring-2 ring-primary ring-offset-1"
                        )}
                        style={{ background: color }}
                        onClick={() => handleBgSelect(color)}
                        aria-label={`Select color ${i + 1}`}
                      />
                    ))}
                    <div className="relative">
                      <input
                        type="color"
                        value={customColor || '#ffffff'}
                        onChange={e => {
                          setCustomColor(e.target.value);
                          handleBgSelect(e.target.value);
                        }}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-300 cursor-pointer appearance-none"
                        title="Custom color"
                      />
                      <div className="absolute inset-0 rounded-full border border-dashed border-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                {/* Typography - Compact */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Typography</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Font Family</Label>
                      <Select value={font} onValueChange={setFont}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select font" />
                        </SelectTrigger>
                        <SelectContent>
                          {FONTS.map(f => (
                            <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Font Size</Label>
                      <Select value={fontSize.toString()} onValueChange={(v) => setFontSize(Number(v))}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_SIZES.map(s => (
                            <SelectItem key={s} value={s.toString()}>
                              {s}px
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Special Days Tab - Mobile Optimized */}
        <TabsContent value="special">
          <Card className="border border-border/50">
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-4">
                {/* Mobile Filter Toggle */}
                {isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                  >
                    <span className="flex items-center gap-2">
                      <Filter className="w-3 h-3" />
                      Filters
                    </span>
                    {showMobileFilters ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </Button>
                )}
                
                {/* Filters - Responsive */}
                <div className={cn(
                  "space-y-3",
                  isMobile && !showMobileFilters && "hidden"
                )}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Special Days & Profile Dates</Label>
                      <p className="text-xs text-muted-foreground">
                        {isLoadingBirthdays
                          ? <Skeleton className="h-3 w-20" />
                          : `${profileCelebrations.length} saved profile dates · ${birthdayUsers.length} birthdays today`}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-muted-foreground" />
                        <Select 
                          value={countryFilter} 
                          onValueChange={setCountryFilter}
                        >
                          <SelectTrigger className="h-8 text-xs w-24">
                            <SelectValue placeholder="Country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Countries</SelectItem>
                            <SelectItem value="profile">My Profile Dates</SelectItem>
                            <SelectItem value="birthday">Birthdays & Anniversaries</SelectItem>
                            <SelectItem value="global">Global</SelectItem>
                            {availableCountries.map(country => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Badge variant="secondary" className="text-xs">
                        {allSpecialDays.length}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Quick Filters */}
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-2">
                      <Button
                        size="sm"
                        variant={countryFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => setCountryFilter('all')}
                        className="text-xs whitespace-nowrap"
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={countryFilter === 'birthday' ? 'default' : 'outline'}
                        onClick={() => setCountryFilter('birthday')}
                        className="text-xs whitespace-nowrap"
                      >
                        🎂 Birthdays & anniversaries
                      </Button>
                      <Button
                        size="sm"
                        variant={countryFilter === 'profile' ? 'default' : 'outline'}
                        onClick={() => setCountryFilter('profile')}
                        className="text-xs whitespace-nowrap"
                      >
                        💐 My profile dates
                      </Button>
                      <Button
                        size="sm"
                        variant={countryFilter === 'global' ? 'default' : 'outline'}
                        onClick={() => setCountryFilter('global')}
                        className="text-xs whitespace-nowrap"
                      >
                        🌍 Global
                      </Button>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
                
                {/* Special Days Grid - Responsive */}
                {allSpecialDays.length > 0 ? (
                  <div className={cn(
                    "grid gap-3",
                    isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                  )}>
                    {allSpecialDays.map(day => (
                      <button
                        key={day.id}
                        className={cn(
                          "relative rounded-lg md:rounded-xl overflow-hidden border transition-all",
                          selectedSpecial?.id === day.id 
                            ? "border-primary ring-1 ring-primary" 
                            : "border-transparent hover:border-primary/50"
                        )}
                        style={{ 
                          background: day.background,
                          aspectRatio: '1',
                        }}
                        onClick={() => handleSpecialSelect(day)}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="relative p-3 h-full flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="text-xl md:text-2xl">{day.icon}</span>
                            {day.category === 'birthday' && (
                              <Badge className="text-xs px-1 py-0 bg-pink-500">Bday</Badge>
                            )}
                            {day.is_global && day.category !== 'birthday' && (
                              <Badge variant="outline" className="text-xs px-1 py-0">🌍</Badge>
                            )}
                          </div>
                          <div className="mt-auto text-left">
                            <span className="block text-xs md:text-sm font-semibold text-white truncate">
                              {day.name}
                            </span>
                            <span className="block text-[10px] md:text-xs text-white/80 truncate">
                              {day.description}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <Calendar className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mx-auto mb-2" />
                    <h4 className="text-sm md:text-base font-medium mb-1">No Special Days</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      No special days or birthdays today.
                    </p>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('custom')}
                    >
                      Create Your Own
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Image Upload Tab - Mobile Optimized */}
        <TabsContent value="image">
          <Card className="border border-border/50">
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-4 md:space-y-6">
                {/* Upload Area - Compact */}
                <div 
                  className="border-2 border-dashed border-border rounded-lg md:rounded-xl p-6 md:p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Upload className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mx-auto mb-2" />
                  <h3 className="text-sm md:text-base font-medium mb-1">Upload Image</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tap to upload (max 5MB)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, GIF, WEBP
                  </p>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                    }}
                  />
                </div>
                
                {/* Image Preview & Filters */}
                {imagePreview && (
                  <div className="space-y-4">
                    <div className="relative rounded-lg md:rounded-xl overflow-hidden border border-border">
                      <img 
                        src={imagePreview} 
                        alt="Uploaded preview" 
                        className="w-full h-48 md:h-64 object-cover"
                      />
                      {isProcessingImage && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            <span className="text-white text-xs">Processing...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Meme Filters - Responsive */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4" />
                        <Label className="text-sm font-medium">Meme Effects</Label>
                      </div>
                      <div className={cn(
                        "grid gap-2",
                        isMobile ? "grid-cols-3" : "grid-cols-3 md:grid-cols-6"
                      )}>
                        {MEME_FILTERS.map(filter => (
                          <button
                            key={filter.value}
                            className={cn(
                              "border rounded-lg p-2 md:p-3 text-center transition-all",
                              selectedFilter === filter.value 
                                ? "border-primary bg-primary/10" 
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => handleFilterChange(filter.value)}
                            disabled={isProcessingImage}
                          >
                            <div className="font-medium text-xs md:text-sm mb-1">{filter.name}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                              {filter.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Custom Special Day Tab - Mobile Optimized */}
        <TabsContent value="custom">
          <Card className="border border-border/50">
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2">Special Day Name</Label>
                  <Input
                    type="text"
                    maxLength={32}
                    placeholder="e.g. My Birthday Bash"
                    value={customSpecialName}
                    onChange={e => setCustomSpecialName(e.target.value)}
                    className="text-sm"
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {customSpecialName.length}/32
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium mb-2">Background Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.slice(1).map((color, i) => (
                      <button
                        key={i}
                        className={cn(
                          "w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow",
                          customSpecialBg === color && "ring-2 ring-primary ring-offset-1"
                        )}
                        style={{ background: color }}
                        onClick={() => {
                          setCustomSpecialBg(color);
                          setBg(color);
                        }}
                        aria-label={`Color ${i + 1}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={customSpecialBg.startsWith('#') ? customSpecialBg : '#ffffff'}
                      onChange={e => {
                        setCustomSpecialBg(e.target.value);
                        setBg(e.target.value);
                      }}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gray-300 cursor-pointer"
                      title="Custom color"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium mb-2">Icon</Label>
                  <ScrollArea className="w-full">
                    <div className="grid grid-cols-8 gap-1 p-2 border border-border rounded-lg">
                      {['🎉','🎂','⭐','🌟','💖','🔥','🎈','🎁','🍰','🥳','🌈','🏆','🎯','🚀','🎨','🎵'].map((icon, i) => (
                        <button
                          key={i}
                          className={cn(
                            "text-xl md:text-2xl rounded p-1 transition-colors",
                            customSpecialIcon === icon 
                              ? "bg-primary/20 border border-primary" 
                              : "hover:bg-primary/10"
                          )}
                          onClick={() => setCustomSpecialIcon(icon)}
                          type="button"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
                
                <div>
                  <Label className="text-sm font-medium mb-2">Festive Message</Label>
                  <Input
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Happy Me Day! 🎉"
                    value={customSpecialMsg}
                    onChange={e => setCustomSpecialMsg(e.target.value)}
                    className="text-sm"
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {customSpecialMsg.length}/60
                  </div>
                </div>
                
                <div className="pt-3 border-t border-border">
                  <Button
                    className="w-full"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => {
                      setCustomSpecialActive(true);
                      toast.success('Custom special day created!');
                    }}
                  >
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Activate Custom Special Day
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Preview Section - Mobile Optimized */}
      <Card className="border border-border/50">
        <CardContent className="pt-4 md:pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm md:text-base font-medium">Live Preview</Label>
              <div className="flex items-center gap-1 md:gap-2">
                {selectedSpecial && (
                  <Badge className="text-xs px-2 py-0.5">
                    <span className="mr-1">{selectedSpecial.icon}</span>
                    {selectedSpecial.category === 'birthday' ? 'Birthday' : 'Special'}
                  </Badge>
                )}
                {customSpecialActive && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Custom
                  </Badge>
                )}
                {uploadedImage && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    Meme
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Special Message Input */}
            {(selectedSpecial || customSpecialActive) && (
              <div className="space-y-2">
                <Label className="text-sm">Custom Festive Message</Label>
                <Input
                  type="text"
                  maxLength={60}
                  placeholder={selectedSpecial?.description || "Add your festive message..."}
                  value={customSpecialActive ? customSpecialMsg : customSpecialMessage}
                  onChange={e => customSpecialActive ? setCustomSpecialMsg(e.target.value) : setCustomSpecialMessage(e.target.value)}
                  className="text-sm"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Appears on your moment
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(customSpecialActive ? customSpecialMsg : customSpecialMessage).length}/60
                  </span>
                </div>
              </div>
            )}

            {celebrationPhotoSlots.length > 0 && (
              <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {selectedSpecial?.category === 'anniversary' ? 'Photos for your anniversary card' : 'Photo for the birthday card'}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedSpecial?.category === 'anniversary'
                      ? 'Add both partners. The photos will be cropped into the generated card.'
                      : 'Add the celebrant’s photo to the generated card.'}
                  </p>
                </div>
                <div className={cn('grid gap-3', celebrationPhotoSlots.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                  {celebrationPhotoSlots.map((label, index) => (
                    <div key={label} className="space-y-2">
                      <Label htmlFor={`celebration-photo-${index}`} className="text-xs font-medium">{label}</Label>
                      {celebrationPhotoPreviews[index] && (
                        <img
                          src={celebrationPhotoPreviews[index] || ''}
                          alt={`${label} preview`}
                          className="h-36 w-full rounded-lg border object-cover"
                        />
                      )}
                      <Input
                        id={`celebration-photo-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleCelebrationPhotoChange(index, event.target.files?.[0])}
                        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {/* Share to Feed Option */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-xl">
              <Switch
                id="share-to-feed"
                checked={isCelebration || shareToFeed}
                disabled={isCelebration}
                onCheckedChange={(v: boolean) => setShareToFeed(Boolean(v))}
                className={"transform scale-150 "+
                  "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-pink-500 "+
                  "data-[state=unchecked]:bg-purple-200 dark:data-[state=unchecked]:bg-purple-800 "+
                  "[&>div]:bg-white dark:[&>div]:bg-white shadow-lg border-2 data-[state=checked]:border-purple-600"
                }
                aria-label={isCelebration ? 'Celebration will be shared to Moments and main feed' : 'Share to Main Feed'}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="share-to-feed" className="text-base font-semibold cursor-pointer">
                    {isCelebration ? 'Share card as Moment + post' : 'Share to Main Feed'}
                  </Label>
                  <span className="text-xs text-muted-foreground">{isCelebration ? 'Automatic' : shareToFeed ? 'Visible' : 'Hidden'}</span>
                </div>
              </div>
              <Eye className="w-5 h-5 text-muted-foreground" />
            </div>
            
            {/* Live Preview */}
            <div className="space-y-2">
              <div style={previewStyle} className="relative">
                {/* Main Text */}
                <div className="relative z-10 px-2 md:px-4 break-words max-w-full mx-auto">
                  {text || 'Your text moment will appear here'}
                </div>
                
                {/* Special Day Overlay */}
                {(selectedSpecial || customSpecialActive) && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 flex items-center justify-between backdrop-blur-sm bg-gradient-to-t from-black/60 to-transparent">
                    {/* Icon */}
                    <div className="flex items-center gap-2">
                      <div className="bg-white/20 backdrop-blur-md rounded-full p-2">
                        <span className="text-xl md:text-2xl">
                          {customSpecialActive ? customSpecialIcon : selectedSpecial?.icon}
                        </span>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-xs md:text-sm font-semibold text-white truncate max-w-[80px]">
                          {customSpecialActive ? customSpecialName : selectedSpecial?.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* Message */}
                    <div className="bg-black/40 backdrop-blur-md rounded-lg md:rounded-xl px-2 md:px-3 py-1 md:py-2 max-w-[60%]">
                      <span className="text-xs md:text-sm font-semibold text-white truncate">
                        {customSpecialActive 
                          ? (customSpecialMsg || 'Celebrate!')
                          : (customSpecialMessage || selectedSpecial?.description || 'Celebrate!')
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Preview Info */}
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Font: {font}</span>
                  <span>Size: {fontSize}px</span>
                </div>
                <span className="text-xs">Real-time preview</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}
      
      {/* Submit Button */}
      <Button
        className="w-full h-12 md:h-14 text-sm md:text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all"
        disabled={!text.trim() || isUploading}
        onClick={handlePostMoment}
        size={isMobile ? "lg" : "lg"}
      >
        {isUploading ? (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Sharing...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
            <span>Share Special Moment</span>
          </div>
        )}
      </Button>
      
      {/* Stats Footer */}
      <div className="text-center pt-3 border-t border-border">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="space-y-1">
            <div className="text-lg md:text-xl font-bold text-primary">{staticSpecialDays.length}</div>
            <div className="text-xs text-muted-foreground">Holidays</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg md:text-xl font-bold text-pink-500">{birthdayUsers.length}</div>
            <div className="text-xs text-muted-foreground">Birthdays</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg md:text-xl font-bold text-purple-500">{specialBackgrounds.length}+</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {dayjs().format('MMM D, YYYY')}
        </p>
      </div>
    </div>
  );
};

export default TextMomentCreator;