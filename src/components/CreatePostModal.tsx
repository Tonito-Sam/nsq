import React, { useState, useRef, useEffect } from 'react';
// --- AI Helpers and imports only ---
import axios from 'axios';
import { extractHashtagsFromText as extractHashtagsUtil, escapeRegExp } from '@/utils/hashtagUtils';
import keywordExtractor from 'keyword-extractor';
import Sentiment from 'sentiment';
// --- AI Helpers ---

// Simple spam keywords list (used by isSpam)
const spamKeywords: string[] = [
  'free', 'win', 'winner', 'prize', 'money', 'cash', 'urgent', 'offer', 'click', 'buy now', 'subscribe', 'credit', 'loan', 'cheap', 'discount', 'deal'
];

function isSpam(text: string) {
  const lower = text.toLowerCase();
  if (spamKeywords.some((word: string) => lower.includes(word))) return true;
  return false;
}

// Hashtag generation (return more suggestions by default)
function generateHashtags(text: string, maxCount = 8) {
  const keywords = keywordExtractor.extract(text, { language: 'english', remove_digits: true, return_changed_case: true, remove_duplicates: true });
  // return up to `maxCount` compacted hashtags
  return keywords.slice(0, maxCount).map(k => `#${k.replace(/\s+/g, '')}`);
}

// re-exported helpers from utils/hashtagUtils for tests and reuse
const extractHashtagsFromText = extractHashtagsUtil;

// Sentiment analysis
const sentiment = new Sentiment();
function getSentiment(text: string) {
  return sentiment.analyze(text);
}

// Toxicity detection (HuggingFace Inference API, free tier)
async function checkToxicity(text: string) {
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/unitary/toxic-bert',
      { inputs: text },
      { headers: { Authorization: '' } }
    );
    return response.data;
  } catch (e) {
    return null;
  }
}

// Language translation (LibreTranslate API)
async function translateText(text: string, targetLang = 'en') {
  try {
    const res = await axios.post('https://libretranslate.de/translate', {
      q: text,
      source: 'auto',
      target: targetLang,
      format: 'text'
    });
    return res.data.translatedText;
  } catch (e) {
    return null;
  }
}

// Image captioning (Replicate BLIP API)
async function getImageCaption(imageUrl: string) {
  try {
    const res = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: 'blip',
        input: { image: imageUrl }
      },
      { headers: { Authorization: 'Token YOUR_REPLICATE_API_TOKEN' } }
    );
    return res.data?.prediction || '';
  } catch (e) {
    return '';
  }
}

// Voice-to-text (Web Speech API)
function useSpeechToText(onResult: (text: string) => void) {
  const recognitionRef = React.useRef<any>(null);
  const [listening, setListening] = React.useState(false);

  const start = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };
  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };
  return { start, stop, listening };
}

import leoProfanity from 'leo-profanity';

// Add custom life-threatening words to leo-profanity
const customThreatWords = [
  'murder', 'murdered', 'murdering', 'kill', 'killed', 'killing', 'stab', 'stabbed', 'stabbing', 'assassinate', 'assassinated', 'assassinating', 'slaughter', 'slaughtered', 'slaughtering', 'execute', 'executed', 'behead', 'beheaded', 'beheading', 'decapitate', 'decapitated', 'decapitating', 'strangle', 'strangled', 'strangling', 'shoot', 'shot', 'shooting', 'hang', 'hanged', 'hanging', 'lynch', 'lynched', 'lynching', 'poison', 'poisoned', 'poisoning', 'drown', 'drowned', 'drowning', 'suffocate', 'suffocated', 'suffocating', 'burn alive', 'burned alive', 'burning alive', 'torture', 'tortured', 'torturing', 'massacre', 'massacred', 'massacring', 'suicide', 'suicidal', 'homicide', 'homicidal', 'manslaughter', 'genocide', 'genocidal', 'exterminate', 'exterminated', 'exterminating', 'eliminate', 'eliminated', 'eliminating', 'terminate', 'terminated', 'terminating', 'butcher', 'butchered', 'butchering', 'bludgeon', 'bludgeoned', 'bludgeoning', 'maim', 'maimed', 'maiming', 'disembowel', 'disemboweled', 'disemboweling', 'disfigure', 'disfigured', 'disfiguring', 'rape', 'raped', 'raping', 'abduct', 'abducted', 'abducting', 'kidnap', 'kidnapped', 'kidnapping', 'molest', 'molested', 'molesting', 'abuse', 'abused', 'abusing', 'assault', 'assaulted', 'assaulting', 'batter', 'battered', 'battering', 'beat', 'beaten', 'beating', 'threaten', 'threatened', 'threatening', 'terrorize', 'terrorized', 'terrorizing', 'violate', 'violated', 'violating'
];
leoProfanity.add(customThreatWords);
import * as nsfwjs from 'nsfwjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Play,
  Pause,
  Music,
  Volume2,
  Calendar, 
  Mic, 
  MicOff, 
  X, 
  Send,
  BarChart2,
  Paperclip,
  MapPin,
  Sparkles,
  Heart,
  Zap,
  Lock,
  Users,
  Globe,
  Plus,
  ChevronDown,
  ChevronUp,
  Square
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/mediaUtils';

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}

export const CreatePostModal = ({ open, onOpenChange, groupId }: CreatePostModalProps) => {
  // --- AI UI State ---
  const [spamWarning, setSpamWarning] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [sentimentResult, setSentimentResult] = useState<any>(null);
  const [toxicityResult, setToxicityResult] = useState<any>(null);
  const [translated, setTranslated] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  // Show the AI assistant panel by default so users immediately see hashtag suggestions
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [hashtagCounts, setHashtagCounts] = useState<Record<string, number>>({});
  const [hashtagCountsLoading, setHashtagCountsLoading] = useState(false);

  // Voice-to-text (AI, not voice recording)
  const [voiceText, setVoiceText] = useState('');
  const [isVoiceToText, setIsVoiceToText] = useState(false);
  const speechToText = useSpeechToText((text: string) => {
    setVoiceText(text);
    setIsVoiceToText(false);
  });

  // NSFWJS model state
  const [nsfwModel, setNsfwModel] = useState<nsfwjs.NSFWJS | null>(null);
  
  // Load NSFWJS model once
  useEffect(() => {
    if (!nsfwModel) {
      nsfwjs.load().then(setNsfwModel);
    }
  }, [nsfwModel]);

  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'event' | 'voice' | 'poll'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPosting, setIsPosting] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([
    { text: '', media: null as File | null },
    { text: '', media: null as File | null }
  ]);
  const [eventBanner, setEventBanner] = useState<File | null>(null);
  const [eventBannerUrl, setEventBannerUrl] = useState<string>('');
  const [eventDescription, setEventDescription] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  // Image filters
  const filtersList = [
    { id: 'none', label: 'Original' },
    { id: 'grayscale', label: 'Grayscale' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'bright', label: 'Bright' },
    { id: 'contrast', label: 'High Contrast' },
    { id: 'vibrant', label: 'Vibrant' },
    { id: 'cool', label: 'Cool' },
    { id: 'warm', label: 'Warm' },
    { id: 'lomo', label: 'Lomo' },
    { id: 'blur', label: 'Soft Blur' },
  ];
  // Image filter states
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string>('');
  const [filtering, setFiltering] = useState(false);
  // Sound-bank and background audio
  const [soundBank, setSoundBank] = useState<any[]>([]);
  const [selectedSound, setSelectedSound] = useState<any | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const [backgroundVolume, setBackgroundVolume] = useState<number>(0.6);
  const [voiceVolume, setVoiceVolume] = useState<number>(1);
  const [playBackgroundDuringRecording, setPlayBackgroundDuringRecording] = useState<boolean>(true);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  // Slideshow state for multiple images
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const slideshowIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add emoji/icon to each feeling
  const feelingsList = [
    { label: 'Happy', emoji: '😊' },
    { label: 'Excited', emoji: '🤩' },
    { label: 'Blessed', emoji: '🙏' },
    { label: 'Grateful', emoji: '💖' },
    { label: 'Motivated', emoji: '🚀' },
    { label: 'Inspired', emoji: '✨' },
    { label: 'Accomplished', emoji: '🏆' },
    { label: 'Proud', emoji: '😌' },
    { label: 'Celebrating', emoji: '🎉' },
    { label: 'Loved', emoji: '❤️' },
    { label: 'Relaxed', emoji: '😌' },
    { label: 'Focused', emoji: '🎯' },
    { label: 'Energetic', emoji: '⚡' },
    { label: 'Hopeful', emoji: '🌈' },
    { label: 'Confident', emoji: '😎' },
    { label: 'Curious', emoji: '🧐' },
    { label: 'Peaceful', emoji: '🕊️' },
    { label: 'Thankful', emoji: '🙏' },
    { label: 'Surprised', emoji: '😲' },
    { label: 'Content', emoji: '😌' },
    { label: 'Cheerful', emoji: '😁' },
    { label: 'Victorious', emoji: '🏅' },
    { label: 'Promoted', emoji: '💼' },
    { label: 'Graduated', emoji: '🎓' },
    { label: 'Engaged', emoji: '💍' },
    { label: 'Married', emoji: '👰‍♀️' },
    { label: 'Birthday', emoji: '🎂' },
    { label: 'Anniversary', emoji: '💐' },
    { label: 'New Job', emoji: '🧑‍💼' },
    { label: 'New Home', emoji: '🏡' },
    { label: 'Awarded', emoji: '🏆' },
    { label: 'Honored', emoji: '🎖️' },
    { label: 'Welcoming Baby', emoji: '👶' },
    { label: 'Traveling', emoji: '✈️' },
    { label: 'Reunited', emoji: '🤗' },
    { label: 'Healed', emoji: '💪' },
    { label: 'Recovered', emoji: '🌱' },
    { label: 'Supportive', emoji: '🤝' },
    { label: 'Support Needed', emoji: '🆘' },
    { label: 'Remembering', emoji: '🕯️' },
    { label: 'Reflective', emoji: '🤔' },
    { label: 'Remorseful', emoji: '😔' },
    { label: 'Missing Someone', emoji: '😢' },
    { label: 'Sympathetic', emoji: '🤍' },
    { label: 'Saddened', emoji: '😞' },
    { label: 'Anxious', emoji: '😬' },
    { label: 'Stressed', emoji: '😣' },
    { label: 'Tired', emoji: '😴' },
    { label: 'Overwhelmed', emoji: '🥵' },
    { label: 'Determined', emoji: '💪' },
    { label: 'Strong', emoji: '🦾' },
    { label: 'Resilient', emoji: '🌻' },
    { label: 'Brave', emoji: '🦁' },
    { label: 'Challenged', emoji: '🧗' },
    { label: 'Learning', emoji: '📚' },
    { label: 'Growing', emoji: '🌱' },
    { label: 'Thankful for Friends', emoji: '🧑‍🤝‍🧑' },
    { label: 'Thankful for Family', emoji: '👨‍👩‍👧‍👦' },
    { label: 'Thankful for Community', emoji: '🌍' },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevTypedHashtagsRef = useRef<string[]>([]);

  // Load sound bank manifest
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/sounds.json');
        if (!res.ok) return;
        const data = await res.json();
        setSoundBank(Array.isArray(data) ? data : []);
      } catch (e) {
        setSoundBank([]);
      }
    })();
  }, []);

  const mapFilterToCss = (f: string) => {
    switch (f) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(60%)';
      case 'vintage': return 'sepia(30%) contrast(1.1) saturate(0.9)';
      case 'bright': return 'brightness(1.15) saturate(1.05)';
      case 'contrast': return 'contrast(1.3) saturate(1.05)';
      case 'vibrant': return 'contrast(1.05) saturate(1.35)';
      case 'cool': return 'sepia(5%) hue-rotate(200deg) saturate(0.95)';
      case 'warm': return 'sepia(10%) hue-rotate(-15deg) saturate(1.05)';
      case 'lomo': return 'contrast(1.3) saturate(1.4)';
      case 'blur': return 'blur(2px) brightness(0.98)';
      default: return 'none';
    }
  };

  

  const filterMap: Record<string, string> = {
    none: 'none',
    grayscale: 'grayscale(1)',
    sepia: 'sepia(0.6)',
    vintage: 'sepia(0.4) saturate(1.2) contrast(1.05) brightness(0.95)',
    bright: 'brightness(1.08) contrast(1.05)'
  };

  const generateFilteredBlob = async (file: File, filterKey: string): Promise<Blob> => {
    const filter = filterMap[filterKey] || 'none';
    // Use createImageBitmap for better performance
    const imgBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imgBitmap.width;
    canvas.height = imgBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.filter = filter === 'none' ? 'none' : filter;
    // Fill background white to avoid black backgrounds when exporting JPEGs
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgBitmap, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.92));
  };

  // Update filtered preview when filter or selectedFiles changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (selectedFilter === 'none' || selectedFiles.length === 0 || !selectedFiles[0].type.startsWith('image/')) {
        // clear filtered preview
        setFiltering(false);
        setFilteredPreviewUrl('');
        return;
      }
      setFiltering(true);
      try {
        const blob = await generateFilteredBlob(selectedFiles[0], selectedFilter);
        if (!mounted) return;
        const url = URL.createObjectURL(blob);
        // revoke previous
        setFilteredPreviewUrl((prev) => {
          try { if (prev) URL.revokeObjectURL(prev); } catch (e) {}
          return url;
        });
      } catch (e) {
        console.warn('filter failed', e);
        setFilteredPreviewUrl('');
      } finally {
        if (mounted) setFiltering(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedFilter, selectedFiles]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      const firstFile = files[0];
      if (firstFile.type.startsWith('image/')) {
        setPostType('image');
        setAiLoading(true);
        const url = URL.createObjectURL(firstFile);
        try {
          const cap = await getImageCaption(url);
          setCaption(cap);
        } catch {
          setCaption('');
        }
        setAiLoading(false);
      } else if (firstFile.type.startsWith('video/')) {
        setPostType('video');
      } else if (firstFile.type.startsWith('audio/')) {
        setPostType('voice');
      }
    }
  };

  // AI: Live feedback as user types
  useEffect(() => {
    let text = content;
    if (voiceText) text += ' ' + voiceText;
    if (!text.trim()) {
      setSpamWarning(null);
      prevTypedHashtagsRef.current = [];
      setHashtags([]);
      setSentimentResult(null);
      setToxicityResult(null);
      setTranslated('');
      return;
    }
    
    setSpamWarning(isSpam(text) ? '⚠️ This post looks like spam.' : null);
    // Include any explicit hashtags the user typed (e.g. #hello) so they show up immediately
  const typed = extractHashtagsFromText(text);
    const auto = generateHashtags(text);
    // Merge with typed first so explicit tags show up prominently
    const merged = Array.from(new Set([...typed, ...auto]));
    setHashtags(merged);
    // Toast when the user types a new explicit hashtag
    try {
      const prev = prevTypedHashtagsRef.current || [];
      const newlyTyped = typed.filter(t => !prev.includes(t));
      if (newlyTyped.length > 0) {
        // show one toast summarizing new tags
        toast({ description: `Added hashtag${newlyTyped.length > 1 ? 's' : ''} ${newlyTyped.join(', ')}` });
      }
      prevTypedHashtagsRef.current = typed;
    } catch (e) {
      // swallow toast errors
    }
    setSentimentResult(getSentiment(text));
    
    setAiLoading(true);
    checkToxicity(text).then(res => {
      setToxicityResult(res);
      setAiLoading(false);
    });
    
    translateText(text, 'en').then(res => setTranslated(res || ''));
  }, [content, voiceText]);

  // Fetch recent hashtag usage counts (used to surface popularity next to suggested hashtags)
  useEffect(() => {
    if (!showAiPanel) return;
    let mounted = true;
    (async () => {
      setHashtagCountsLoading(true);
      try {
        // Look back 30 days for trending counts
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase.from('posts').select('content').gte('created_at', since).limit(500);
        if (error) throw error;
        const freq: Record<string, number> = {};
        (data || []).forEach((p: any) => {
          const tags = (p.content || '').match(/#\w+/g) || [];
          tags.forEach((t: string) => {
            const k = t.substring(1).toLowerCase();
            freq[k] = (freq[k] || 0) + 1;
          });
        });
        if (mounted) setHashtagCounts(freq);
      } catch (e) {
        console.warn('Could not fetch hashtag counts', e);
      } finally {
        if (mounted) setHashtagCountsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [showAiPanel]);

  useEffect(() => {
    if (voiceText) {
      setContent(prev => prev + (prev ? ' ' : '') + voiceText);
      setVoiceText('');
    }
  }, [voiceText]);

  useEffect(() => {
    // reset slideshow when selected files change
    setSlideshowIndex(0);
    setSlideshowPlaying(false);
    if (selectedFiles.length === 0 || !selectedFiles[0].type.startsWith('image/')) {
      setCaption('');
    }
  }, [selectedFiles]);

  // slideshow auto-advance
  useEffect(() => {
    if (slideshowPlaying && selectedFiles.length > 1) {
      slideshowIntervalRef.current = setInterval(() => {
        setSlideshowIndex(i => (i + 1) % selectedFiles.length);
      }, 3000);
      // start background audio if selected
      if (selectedSound && !backgroundAudioRef.current) {
        try {
          const a = new Audio(selectedSound.url);
          a.crossOrigin = 'anonymous';
          a.volume = backgroundVolume;
          a.loop = true;
          a.play().catch(() => {});
          backgroundAudioRef.current = a;
        } catch (e) {}
      }
    } else {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
        slideshowIntervalRef.current = null;
      }
      // pause background audio if playing for slideshow
      try {
        // only pause if not used elsewhere
        if (backgroundAudioRef.current && !isRecording) {
          backgroundAudioRef.current.pause();
          backgroundAudioRef.current = null;
        }
      } catch (e) {}
    }
    return () => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
        slideshowIntervalRef.current = null;
      }
    };
  }, [slideshowPlaying, selectedFiles.length, selectedSound, backgroundVolume, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0); // Reset duration
      
      // Play backing track locally while recording so the user can sing-along (MediaRecorder records mic-only)
      if (selectedSound && playBackgroundDuringRecording) {
        try {
          const bg = new Audio(selectedSound.url);
          bg.volume = backgroundVolume;
          bg.crossOrigin = 'anonymous';
          backgroundAudioRef.current = bg;
          // start playback slightly delayed to ensure DOM handles
          setTimeout(() => {
            bg.play().catch(() => {});
          }, 150);
        } catch (e) {
          console.warn('Could not play background audio during recording', e);
        }
      }

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          // enforce max duration (60s)
          if (next >= 60) {
            // auto-stop when reaching limit
            try { stopRecording(); } catch {}
            return 60;
          }
          return next;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // stop background preview if playing
      try {
        backgroundAudioRef.current?.pause();
        backgroundAudioRef.current = null;
      } catch (e) {}
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    try {
      backgroundAudioRef.current?.pause();
      backgroundAudioRef.current = null;
    } catch (e) {}
  };

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, { text: '', media: null }]);
  };

  const handlePollOptionChange = (idx: number, value: string) => {
    setPollOptions(options => options.map((opt, i) => i === idx ? { ...opt, text: value } : opt));
  };

  const handlePollOptionMedia = (idx: number, file: File | null) => {
    setPollOptions(options => options.map((opt, i) => i === idx ? { ...opt, media: file } : opt));
  };

  const handleRemovePollOption = (idx: number) => {
    setPollOptions(options => options.filter((_, i) => i !== idx));
  };

  const handleEventBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEventBanner(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventBannerUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setEventBannerUrl('');
    }
  };

  const scanImageFile = async (file: File) => {
    if (!nsfwModel) return false;
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new window.Image();
        img.onload = async () => {
          const predictions = await nsfwModel.classify(img);
          // Evaluate predictions with stricter rules to avoid false positives.
          // Only block when porn/hentai probabilities are high. "Sexy" alone
          // often flags non-nude images (swimwear, cleavage, short sleeves),
          // so we ignore it as a sole reason to block.
          const probs: Record<string, number> = {};
          (predictions || []).forEach((p: any) => { probs[p.className] = p.probability; });
          const porn = probs['Porn'] || 0;
          const hentai = probs['Hentai'] || 0;
          const sexy = probs['Sexy'] || 0;

          // Blocking logic:
          // - Block if Porn or Hentai probability is clearly high (>= 0.7)
          // - Block if combined Porn+Hentai is very high (>= 0.8)
          // - Do NOT block for "Sexy" alone to reduce false positives on swimwear/short sleeves
          const nsfw = (porn >= 0.7) || (hentai >= 0.7) || ((porn + hentai) >= 0.8);
          // Keep a debug log for future tuning. Only log in non-production to
          // avoid noisy output in production while ensuring `sexy` is referenced
          // so the TypeScript `noUnusedLocals` rule does not complain.
          try {
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.debug('NSFW scores', { porn, hentai, sexy, nsfw, file: file.name });
            }
          } catch (e) {}
          resolve(Boolean(nsfw));
        };
        img.onerror = () => resolve(false);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  };

  const scanVideoFile = async (file: File, frameCount = 3) => {
    if (!nsfwModel) return false;
    return new Promise<boolean>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.src = URL.createObjectURL(file);
      video.currentTime = 0;
      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        let nsfwFound = false;
        for (let i = 1; i <= frameCount; i++) {
          if (nsfwFound) break;
          const time = (duration * i) / (frameCount + 1);
          video.currentTime = time;
          await new Promise(r => {
            video.onseeked = r;
          });
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = new window.Image();
          img.src = canvas.toDataURL();
          await new Promise(r => { img.onload = r; });
          const predictions = await nsfwModel.classify(img);
          const probs: Record<string, number> = {};
          (predictions || []).forEach((p: any) => { probs[p.className] = p.probability; });
          const porn = probs['Porn'] || 0;
          const hentai = probs['Hentai'] || 0;
          // Use the same stricter rules as image scanning to reduce false positives
          nsfwFound = (porn >= 0.7) || (hentai >= 0.7) || ((porn + hentai) >= 0.8);
        }
        resolve(nsfwFound);
      };
      video.onerror = () => resolve(false);
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!content.trim() && selectedFiles.length === 0 && !audioBlob) {
      return;
    }

    // --- SUSPICIOUS URL DETECTION ---
    // Block posts with suspicious or non-standard URLs (e.g., bush.instance.app/?fbclid=...)
    const suspiciousUrlPattern = /(?:https?:\/\/)?(?:[\w-]+\.)?(bush\.instance\.app|instance\.app|linktr\.ee|bit\.ly|t\.me|wa\.me|tinyurl\.com|goo\.gl|rebrand\.ly|cutt\.ly|rb\.gy|shorte\.st|adf\.ly|is\.gd|fb\.me|lnkd\.in|discord\.gg|discordapp\.com|joinchat|\.onion|\.xyz|\.ru|\.cn|\.tk|\.ml|\.ga|\.cf|\.gq|\.work|\.zip|\.mov)(\/[\w\-\?=&#%\.]*)?/i;
    if (suspiciousUrlPattern.test(content)) {
      toast({
        description: 'Your post contains a suspicious or non-standard link and cannot be posted.',
        variant: 'destructive',
      });
      setIsPosting(false);
      return;
    }

    setIsPosting(true);
    try {
      let mediaUrl = '';
      let voiceNoteUrl = '';
      let bannerUrl = '';

      // --- TEXT MODERATION ---
      const cleanContent = leoProfanity.clean(content.trim());
      const cleanPollQuestion = leoProfanity.clean(pollQuestion);
      const cleanPollOptions = pollOptions.map(opt => ({
        ...opt,
        text: leoProfanity.clean(opt.text)
      }));

      // --- IMAGE & VIDEO MODERATION ---
      if (selectedFiles.length > 0 && nsfwModel) {
        for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
            const isNsfw = await scanImageFile(file);
            if (isNsfw) {
              toast({
                description: 'One or more images contain NSFW content and cannot be posted.',
                variant: 'destructive',
              });
              setIsPosting(false);
              return;
            }
          } else if (file.type.startsWith('video/')) {
            const isNsfw = await scanVideoFile(file, 3);
            if (isNsfw) {
              toast({
                description: 'One or more videos contain NSFW content and cannot be posted.',
                variant: 'destructive',
              });
              setIsPosting(false);
              return;
            }
          }
        }
      }

      // Note: media files are uploaded after the post is created (MEDIA GRID LOGIC section)

      // Upload voice note
      if (audioBlob) {
        const voiceFile = new File([audioBlob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
        voiceNoteUrl = await uploadFile(voiceFile, 'posts', 'voice/', user.id);
      }

      // Upload event banner
      if (postType === 'event' && eventBanner) {
        bannerUrl = await uploadFile(eventBanner, 'event-banners', '', user.id);
      }

      // Prepare post data
      const postData: any = {
        user_id: user.id,
        content: cleanContent,
        post_type: postType,
        privacy,
        media_url: mediaUrl || null,
        voice_note_url: voiceNoteUrl || null,
        voice_duration: recordingDuration || null,
        location: location || null,
        feeling: feeling || null,
      };

      // Persist explicit typed hashtags (if any) into post metadata
      try {
        const explicitTags = extractHashtagsFromText(cleanContent || '');
        postData.hashtags = explicitTags.length > 0 ? explicitTags : null;
      } catch (e) {
        postData.hashtags = null;
      }

      // Attach selected background audio metadata if present (sound-bank only)
      if (selectedSound) {
        postData.background_audio_url = selectedSound.url || null;
        postData.background_audio_meta = {
          id: selectedSound.id,
          title: selectedSound.title,
          duration: selectedSound.duration,
          license: selectedSound.license,
        };
        postData.audio_mix_meta = {
          backgroundVolume: backgroundVolume,
          voiceVolume: voiceVolume,
          offsetMs: 0,
        };
      }

      if (groupId) {
        postData.group_id = groupId;
      }

      // Add event-specific data
      if (postType === 'event') {
        postData.event_date = eventDate || null;
        postData.event_location = eventLocation || null;
        postData.event_banner = bannerUrl || null;
        postData.event_description = eventDescription || null;
      }

      // Try inserting post. If the `hashtags` column does not exist in the remote
      // DB (moved files / schema mismatch), retry without hashtags to avoid hard
      // crash and provide a helpful message to the admin/deployer.
      let post: any = null;
      try {
        const resp = await supabase.from('posts').insert(postData).select().single();
        if (resp.error) throw resp.error;
        post = resp.data;
      } catch (err: any) {
        const msg = (err?.message || '').toString();
        const hashtagsMissing = /could not find the '?hashtags'? column|column .*?hashtags.*?does not exist/i.test(msg);
        if (hashtagsMissing && postData.hashtags) {
          // Retry without hashtags property
          const cleaned = { ...postData };
          delete cleaned.hashtags;
          try {
            const resp2 = await supabase.from('posts').insert(cleaned).select().single();
            if (resp2.error) throw resp2.error;
            post = resp2.data;
            toast({ description: 'Post created, but the database does not have a `hashtags` column. Please run the latest migration to persist typed hashtags.' });
          } catch (err2: any) {
            throw err2 || err;
          }
        } else {
          throw err;
        }
      }

      // --- POLL LOGIC ---
      if (postType === 'poll') {
        const { data: poll, error: pollError } = await supabase
          .from('polls')
          .insert({
            post_id: post.id,
            question: cleanPollQuestion,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();
        if (pollError) throw pollError;
        
        const pollOptionsData = await Promise.all(
          cleanPollOptions.filter(opt => opt.text.trim() !== '').map(async (opt) => {
            let mediaUrl = null;
            if (opt.media) {
              mediaUrl = await uploadFile(opt.media, 'polloptions', 'media/', user.id);
            }
            return {
              poll_id: poll.id,
              option_text: opt.text,
              media_url: mediaUrl,
            };
          })
        );
        
        console.log('Poll options to insert:', pollOptionsData);
        let pollOptionsInsertResult: any[] | null = null;
        if (pollOptionsData.length > 0) {
          const { error: optionsError, data: optionsInsertResult } = await supabase
            .from('poll_options')
            .insert(pollOptionsData);
          pollOptionsInsertResult = optionsInsertResult as any[] | null;
          console.log('Poll options insert result:', optionsInsertResult, 'Error:', optionsError);
          if (optionsError) throw optionsError;
        }

        if (pollOptionsInsertResult && pollOptionsInsertResult.length > 0) {
          const firstOptionId = pollOptionsInsertResult[0].id;
          await supabase
            .from('poll_votes')
            .insert({
              poll_id: poll.id,
              option_id: firstOptionId,
              user_id: user.id,
            });
        }
      }

      // --- MEDIA GRID LOGIC ---
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
  mediaUrls = await Promise.all(selectedFiles.map(async (file) => {
          // If file is an image and user selected a filter, upload the filtered image for each image
          if (file.type.startsWith('image/') && selectedFilter && selectedFilter !== 'none') {
            try {
              const filteredBlob = await generateFilteredBlob(file, selectedFilter);
              const filteredFile = new File([filteredBlob], `filtered-${file.name}`, { type: 'image/jpeg' });
              return await uploadFile(filteredFile, 'posts', 'media/', user.id);
            } catch (e) {
              console.warn('Failed to generate/upload filtered image, falling back to original', e);
              return await uploadFile(file, 'posts', 'media/', user.id);
            }
          }
          return await uploadFile(file, 'posts', 'media/', user.id);
        }));
      }
      if (mediaUrls.length > 0) {
        await supabase.from('posts').update({ media_urls: mediaUrls }).eq('id', post.id);
      }

      toast({
        description: "Post created successfully!",
      });

      // Reset form
      setContent('');
      setSelectedFiles([]);
      setAudioBlob(null);
      setRecordingDuration(0);
  setSelectedSound(null);
      setPostType('text');
    setSlideshowIndex(0);
    setSlideshowPlaying(false);
      setEventDate('');
      setEventLocation('');
      setFeeling('');
      setLocation('');
      setPollQuestion('');
      setPollOptions([
        { text: '', media: null },
        { text: '', media: null }
      ]);
      setEventBanner(null);
      setEventBannerUrl('');
      setEventDescription('');
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        description: error.message || "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    if (!navigator.geolocation) {
      toast({ description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
      setDetectingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en`);
        const data = await res.json();
        if (data && data.address) {
          const { city, town, village, country, name, road } = data.address;
          const loc = [name, road, city, town, village, country].filter(Boolean).join(', ');
          setLocation(loc || `${latitude},${longitude}`);
        } else {
          setLocation(`${latitude},${longitude}`);
        }
      } catch (e) {
        toast({ description: 'Could not detect location.', variant: 'destructive' });
      }
      setDetectingLocation(false);
    }, () => {
      toast({ description: 'Could not get your location.', variant: 'destructive' });
      setDetectingLocation(false);
    });
  };

  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public': return <Globe className="h-4 w-4" />;
      case 'friends': return <Users className="h-4 w-4" />;
      case 'private': return <Lock className="h-4 w-4" />;
    }
  };

  const getSentimentIcon = () => {
    if (!sentimentResult) return null;
    if (sentimentResult.score > 0) return <Heart className="h-4 w-4 text-red-500" />;
    if (sentimentResult.score < 0) return <Zap className="h-4 w-4 text-yellow-500" />;
    return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#161616] border-none shadow-2xl">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12 ring-2 ring-blue-500 ring-offset-2">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {user?.user_metadata?.first_name?.[0] || user?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-lg text-gray-900 dark:text-white">Create Post</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiPanel(!showAiPanel)}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {showAdvancedOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-200px)] pr-2">
          {/* Post Type Selection - Modern Grid */}
          <div className="grid grid-cols-6 gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            {[
              { type: 'text', icon: <span className="font-bold text-lg">Aa</span>, label: 'Text' },
              { type: 'image', icon: <ImageIcon className="h-5 w-5" />, label: 'Photo' },
              { type: 'video', icon: <VideoIcon className="h-5 w-5" />, label: 'Video' },
              { type: 'event', icon: <Calendar className="h-5 w-5" />, label: 'Event' },
              { type: 'voice', icon: <Mic className="h-5 w-5" />, label: 'Voice' },
              { type: 'poll', icon: <BarChart2 className="h-5 w-5" />, label: 'Poll' },
            ].map((item) => (
              <Button
                key={item.type}
                variant={postType === item.type ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  if (item.type === 'image' || item.type === 'video') {
                    fileInputRef.current?.click();
                  } else {
                    setPostType(item.type as any);
                  }
                }}
                className={`flex flex-col items-center gap-1 h-16 transition-all duration-200 ${
                  postType === item.type 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            ))}
          </div>

          {/* Content Area with Enhanced UI */}
          <div className="relative">
            <Textarea
              placeholder={`What's on your mind, ${user?.user_metadata?.first_name || 'there'}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 text-lg placeholder-gray-400 bg-white dark:bg-gray-900 rounded-xl transition-all duration-200"
              disabled={isPosting}
            />
            {content && (
              <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                {getSentimentIcon()}
                <span className="text-xs text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                  {content.length}/500
                </span>
              </div>
            )}
          </div>

          {/* Voice-to-Text - Enhanced */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl">
            <div className="flex items-center space-x-3">
              <Button
                type="button"
                size="sm"
                variant={isVoiceToText || speechToText.listening ? 'default' : 'outline'}
                onClick={() => {
                  if (!speechToText.listening) {
                    setIsVoiceToText(true);
                    speechToText.start();
                  } else {
                    setIsVoiceToText(false);
                    speechToText.stop();
                  }
                }}
                disabled={isPosting}
                className={`transition-all duration-200 ${
                  speechToText.listening 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {speechToText.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="ml-2">
                  {speechToText.listening ? 'Stop Voice-to-Text' : 'Voice-to-Text'}
                </span>
              </Button>
              {speechToText.listening && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                    Listening...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* AI Panel - Contextual */}
          {showAiPanel && (
            <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-800 dark:text-purple-200">AI Assistant</span>
                </div>
                {aiLoading && (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-purple-600">Analyzing...</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          const res = await fetch('/sounds.json');
                          if (!res.ok) throw new Error('Failed to load');
                          const data = await res.json();
                          setSoundBank(Array.isArray(data) ? data : []);
                        } catch (e) {
                          console.warn('Could not refresh sound bank', e);
                        }
                      }}>Refresh</Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open('/admin/soundbank', '_blank')}>More tracks</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* TEXT POST AI SERVICES */}
              {postType === 'text' && (
                <>
                  {hashtags.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Suggested hashtags:</span>
                      <div className="flex flex-wrap gap-2">
                        {hashtags.map((h) => {
                          const key = h.replace('#', '').toLowerCase();
                          const count = hashtagCounts[key] || 0;
                            const presentInContent = new RegExp(`(^|\\s)${escapeRegExp(h)}(\\s|$)`, 'i').test(content);
                            return (
                              <button
                                key={h}
                                type="button"
                                className={`px-3 py-1 rounded-full transition-all duration-200 hover:scale-105 text-sm font-medium flex items-center gap-2 ${presentInContent ? 'bg-green-600 text-white' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200'}`}
                                onClick={() => {
                                  setContent((prev) => {
                                    const regex = new RegExp(`(^|\\s)${h}(\\s|$)`, 'i');
                                    if (regex.test(prev)) return prev;
                                    return prev.trim() + (prev.trim() ? ' ' : '') + h;
                                  });
                                }}
                              >
                                <span>{h}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/0 px-1">{hashtagCountsLoading ? '...' : `#${count}`}</span>
                              </button>
                            );
                        })}
                      </div>
                    </div>
                  )}
                  {sentimentResult && (
                    <div className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-sm font-medium">Sentiment:</span>
                      <div className="flex items-center space-x-2">
                        {getSentimentIcon()}
                        <span className="text-sm">
                          {sentimentResult.score > 0 ? 'Positive' : sentimentResult.score < 0 ? 'Negative' : 'Neutral'}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {sentimentResult.score}
                        </span>
                      </div>
                    </div>
                  )}
                  {toxicityResult && Array.isArray(toxicityResult) && toxicityResult.length > 0 && (
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-sm font-medium mb-2 block">Content Analysis:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {toxicityResult.map((r: any, i: number) => (
                          <div key={i} className={`text-xs p-2 rounded ${r.score > 0.7 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}> 
                            {r.label}: {(r.score * 100).toFixed(1)}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {translated && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Translation:</span>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-1">{translated}</p>
                    </div>
                  )}
                  {spamWarning && (
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">{spamWarning}</span>
                    </div>
                  )}
                </>
              )}

              {/* IMAGE/VIDEO POST AI SERVICES */}
              {(postType === 'image' || postType === 'video') && (
                <>
                  {caption && (
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Image/Video Caption:</span>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">{caption}</p>
                    </div>
                  )}
                  {/* Add more visual AI features here as needed */}
                </>
              )}
            </div>
          )}

          {/* File Preview - Enhanced Grid */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="relative group">
                  <div className="relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 aspect-square">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={filteredPreviewUrl || URL.createObjectURL(file)}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : file.type.startsWith('video/') ? (
                      <video
                        src={URL.createObjectURL(file)}
                        className="w-full h-full object-cover"
                        controls
                      />
                    ) : file.type.startsWith('audio/') ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-blue-500">
                        <Mic className="h-8 w-8 text-white" />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                    onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Image editing: split into 3 cards - Filters | Background Sound | Audio Recording */}
          {selectedFiles.length > 0 && selectedFiles[0].type.startsWith('image/') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filters Card */}
              <div className="space-y-3 p-4 bg-gray-900/60 dark:bg-gray-800/60 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">Edit Photo</div>
                  <div className="text-sm text-gray-300">{filtering ? 'Applying filter...' : (selectedFilter === 'none' ? 'Original' : (filtersList.find(f => f.id === selectedFilter)?.label || selectedFilter))}</div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                    {selectedFiles.length > 1 ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <img
                          src={URL.createObjectURL(selectedFiles[slideshowIndex])}
                          alt={`Slide ${slideshowIndex + 1}`}
                          className="w-full h-full object-contain"
                          style={{ filter: mapFilterToCss(selectedFilter), backgroundColor: 'transparent' }}
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                          <button
                            onClick={() => setSlideshowPlaying(p => !p)}
                            className="p-2 rounded-full bg-black/30 text-white hover:scale-105 transition-transform"
                            aria-label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}
                          >
                            {slideshowPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <div className="text-xs text-white bg-black/40 px-2 py-1 rounded">{slideshowIndex + 1}/{selectedFiles.length}</div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={filteredPreviewUrl || (selectedFiles[0] && URL.createObjectURL(selectedFiles[0]))}
                        alt="Preview"
                        className="w-full h-full object-contain"
                        style={{ filter: mapFilterToCss(selectedFilter), backgroundColor: 'transparent' }}
                      />
                    )}
                  </div>

                  <div className="w-full">
                    <div className="grid grid-cols-4 gap-3">
                      {filtersList.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFilter(f.id)}
                          className={`flex flex-col items-center text-xs transition-all ${selectedFilter === f.id ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
                        >
                          <div className="w-20 h-20 overflow-hidden rounded-md bg-gray-800">
                            <img
                              src={URL.createObjectURL(selectedFiles[0])}
                              alt={f.label}
                              className="w-full h-full object-cover"
                              style={{ filter: mapFilterToCss(f.id) }}
                            />
                          </div>
                          <div className="mt-1 text-center text-gray-200">{f.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Sound Card */}
              <div className="space-y-3 p-4 bg-gray-900/60 dark:bg-gray-800/60 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-gray-300" />
                    <span className="font-semibold text-white">Background Sound</span>
                  </div>
                  <div className="text-xs text-gray-400">sound-bank only</div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${!selectedSound ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="background-sound" checked={!selectedSound} onChange={() => setSelectedSound(null)} className="mr-2" />
                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-white">Ø</div>
                        <div className="text-sm">No background</div>
                      </div>
                      <div className="text-xs text-gray-300">—</div>
                    </label>

                    {soundBank.length === 0 && (
                      <div className="text-sm text-gray-400 p-2">No tracks available. Click "More tracks" to manage the sound-bank.</div>
                    )}

                    {soundBank.map((s: any) => (
                      <label key={s.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedSound?.id === s.id ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" name="background-sound" value={s.id} checked={selectedSound?.id === s.id} onChange={() => setSelectedSound(s)} className="mr-2" />
                          <button
                            onClick={(ev) => {
                              ev.preventDefault();
                              ev.stopPropagation();
                              // toggle preview
                              if (playingSoundId === s.id) {
                                try {
                                  backgroundAudioRef.current?.pause();
                                  backgroundAudioRef.current = null;
                                } catch (e) {}
                                setPlayingSoundId(null);
                                return;
                              }
                              try {
                                if (backgroundAudioRef.current) {
                                  try { backgroundAudioRef.current.pause(); } catch (e) {}
                                  backgroundAudioRef.current = null;
                                }
                                const a = new Audio(s.url);
                                a.crossOrigin = 'anonymous';
                                a.volume = backgroundVolume;
                                a.onended = () => setPlayingSoundId(null);
                                a.play().then(() => {
                                  backgroundAudioRef.current = a;
                                  setPlayingSoundId(s.id);
                                }).catch(err => {
                                  console.warn('Preview playback blocked', err);
                                  setPlayingSoundId(null);
                                });
                              } catch (e) { console.warn(e); setPlayingSoundId(null); }
                            }}
                            className="p-2 rounded-md bg-gray-900/30">
                            {playingSoundId === s.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <div className="flex flex-col">
                            <div className="font-medium text-sm">{s.title}</div>
                            <div className="text-xs text-gray-400">{s.duration}s</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          <Volume2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <input className="flex-1 min-w-0 w-full" type="range" min={0} max={1} step={0.01} value={backgroundVolume} onChange={(e) => {
                            const v = Number(e.target.value);
                            setBackgroundVolume(v);
                            if (backgroundAudioRef.current) backgroundAudioRef.current.volume = v;
                          }} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audio Recording Card (inline for image posts) */}
              <div className="space-y-3 p-4 bg-gray-900/60 dark:bg-gray-800/60 rounded-xl">
                <div className="text-sm text-gray-300 mb-2">Voice overlay</div>
                <div className="flex items-center gap-3">
                  {!audioBlob && !isRecording ? (
                    // modern circular record icon button
                    <button
                      onClick={startRecording}
                      aria-label="Start recording"
                      className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="9" fill="white" opacity="0.06" />
                        <circle cx="12" cy="12" r="5" fill="white" />
                      </svg>
                    </button>
                  ) : isRecording ? (
                    <div className="flex items-center gap-2">
                      <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white">■</button>
                      <div className="text-sm text-red-400">Recording — {formatDuration(recordingDuration)}</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <audio controls src={URL.createObjectURL(audioBlob as Blob)} className="w-40" />
                      <div className="flex flex-col">
                        <div className="text-sm text-gray-200">Recorded — {formatDuration(recordingDuration)}</div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={startRecording}>Re-record</Button>
                          <Button size="sm" variant="ghost" onClick={clearRecording}>Remove</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Voice Recording UI - Enhanced with proper controls */}
          {postType === 'voice' && (
            <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  {!isRecording && !audioBlob && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={isPosting}
                        aria-label="Start recording"
                        className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform mb-4"
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" fill="white" opacity="0.06" />
                          <circle cx="12" cy="12" r="6" fill="white" />
                        </svg>
                      </button>
                      <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ready to Record
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Tap the record icon to start your voice note
                      </div>
                    </div>
                  )}
                  
                  {isRecording && (
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg relative">
                          <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping"></div>
                          <div className="absolute inset-2 rounded-full bg-red-400 animate-pulse"></div>
                          <div className="relative z-10">
                            <div className="w-4 h-4 bg-white rounded-sm"></div>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                          {formatDuration(recordingDuration)}
                        </div>
                        <div className="text-lg text-gray-700 dark:text-gray-300 mb-4">Recording...</div>
                        <Button
                          type="button"
                          size="lg"
                          onClick={stopRecording}
                          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200"
                        >
                          <Square className="h-5 w-5 mr-2" />
                          Stop Recording
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {audioBlob && !isRecording && (
                    <div className="w-full space-y-4">
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                          <Mic className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="text-center mb-4">
                        <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Recording Complete
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Duration: {formatDuration(recordingDuration)}
                        </div>
                      </div>
                      <audio controls src={URL.createObjectURL(audioBlob)} className="w-full mb-4" />
                      <div className="flex justify-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startRecording}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          <Mic className="h-4 w-4 mr-1" />
                          Re-record
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearRecording}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Event UI - Enhanced */}
          {postType === 'event' && (
            <div className="space-y-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border-2 border-green-200 dark:border-green-700">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-200">Event Details</span>
              </div>
              
              <Input
                type="text"
                placeholder="Event Title"
                value={content}
                onChange={e => setContent(e.target.value)}
                className="border-2 border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  type="date"
                  placeholder="Event Date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="border-2 border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                />
                <Input
                  type="text"
                  placeholder="Event Location"
                  value={eventLocation}
                  onChange={e => setEventLocation(e.target.value)}
                  className="border-2 border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                />
              </div>
              
              <Input
                type="file"
                accept="image/*"
                onChange={handleEventBannerSelect}
                className="border-2 border-green-200 dark:border-green-700"
              />
              
              {eventBannerUrl && (
                <div className="relative">
                  <img src={eventBannerUrl} alt="Event Banner Preview" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-6 w-6 rounded-full"
                    onClick={() => {
                      setEventBanner(null);
                      setEventBannerUrl('');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <Textarea
                placeholder="Event Description"
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                className="border-2 border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                rows={3}
              />
            </div>
          )}

          {/* Advanced Options - Collapsible */}
          {showAdvancedOptions && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-fade-in">
              <div className="flex items-center space-x-2 mb-3">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Advanced Options</span>
              </div>
              
              {/* Location */}
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Add location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="whitespace-nowrap"
                >
                  {detectingLocation ? 'Detecting...' : 'Detect'}
                </Button>
              </div>
              
              {/* Feeling */}
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-gray-500" />
                <select
                  value={feeling}
                  onChange={e => setFeeling(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <option value="">How are you feeling?</option>
                  {feelingsList.map(f => (
                    <option key={f.label} value={f.label}>{f.emoji} {f.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Privacy */}
              <div className="flex items-center space-x-2">
                {getPrivacyIcon()}
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as 'public' | 'friends' | 'private')}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends</option>
                  <option value="private">🔒 Private</option>
                </select>
              </div>

              {/* Background Sound (sound-bank only) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Background Sound</span>
                  </div>
                  <div className="text-xs text-gray-400">sound-bank only</div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="adv-bg-sound" checked={!selectedSound} onChange={() => setSelectedSound(null)} />
                      <span className="text-sm">No background</span>
                    </label>
                    {soundBank.map((s: any) => (
                      <label key={s.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="adv-bg-sound" value={s.id} checked={selectedSound?.id === s.id} onChange={() => setSelectedSound(s)} />
                          <div className="flex flex-col">
                            <div className="font-medium text-sm">{s.title}</div>
                            <div className="text-xs text-gray-400">{s.duration}s</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            try {
                              const a = new Audio(s.url);
                              a.volume = backgroundVolume;
                              a.play().catch(() => {});
                            } catch (e) {}
                          }}>Preview</Button>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Background Volume</label>
                    <input className="flex-1 min-w-0 w-full" type="range" min={0} max={1} step={0.05} value={backgroundVolume} onChange={(e) => setBackgroundVolume(Number(e.target.value))} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Voice Volume</label>
                    <input className="flex-1 min-w-0 w-full" type="range" min={0} max={1} step={0.05} value={voiceVolume} onChange={(e) => setVoiceVolume(Number(e.target.value))} />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input id="play-during-recording" type="checkbox" checked={playBackgroundDuringRecording} onChange={e => setPlayBackgroundDuringRecording(e.target.checked)} />
                  <label htmlFor="play-during-recording" className="text-sm text-gray-600">Play background while recording (recorded voice remains mic-only)</label>
                </div>
              </div>
            </div>
          )}

          {/* Poll UI - Enhanced */}
          {postType === 'poll' && (
            <div className="space-y-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-700">
              <div className="flex items-center space-x-2 mb-3">
                <BarChart2 className="h-5 w-5 text-orange-600" />
                <span className="font-semibold text-orange-800 dark:text-orange-200">Create Poll</span>
              </div>
              
              <Input
                placeholder="Ask a question..."
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                className="border-2 border-orange-200 dark:border-orange-700 focus:border-orange-500 dark:focus:border-orange-400 text-lg"
              />
              
              <div className="space-y-3">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
                    <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <Input
                      placeholder={`Option ${idx + 1}`}
                      value={opt.text}
                      onChange={e => handlePollOptionChange(idx, e.target.value)}
                      className="flex-1 border-none focus:ring-0"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => document.getElementById(`poll-media-input-${idx}`)?.click()}
                      className="h-8 w-8"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                      id={`poll-media-input-${idx}`}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      onChange={e => handlePollOptionMedia(idx, e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemovePollOption(idx)}
                      disabled={pollOptions.length <= 2}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddPollOption}
                className="w-full border-2 border-dashed border-orange-300 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          )}

          {/* Submit Button - Enhanced */}
          <Button
            onClick={handleSubmit}
            disabled={isPosting || (!content.trim() && selectedFiles.length === 0 && !audioBlob)}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPosting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Creating Post...
              </div>
            ) : (
              <div className="flex items-center">
                <Send className="h-5 w-5 mr-3" />
                Share Post
              </div>
            )}
          </Button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
      </DialogContent>
    </Dialog>
  );
};

