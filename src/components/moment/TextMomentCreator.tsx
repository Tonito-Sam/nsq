import React, { useState } from 'react';
import { specialBackgrounds, SpecialBackground } from './specialBackgrounds';
import dayjs from 'dayjs';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

// Emoji pool for custom special day icons
const CUSTOM_ICONS = ['🎉','🎂','⭐','🌟','💖','🔥','🎈','🎁','🍰','🥳','🌈','🏆','🎵','🦄','🌻','🍀','🍕','🍔','🍦','🍩','🍿','🎬','🎮','🚀','🧁','🍫','🍓','🍉','🍒','🍇','🍊','🍋','🍎','🍏','🍌','🍍','🥥','🥝','🥑','🥦','🥕','🌽','🍅','🍆','🥔','🍠','🥨','🥐','🍞','🥯','🥖','🧀','🥚','🍳','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🥘','🍲','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🍡','🥟','🥠','🥡','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🧊','🥄','🍴','🍽️'];

// Utility to determine if a color is "light" or "dark"
function getContrastYIQ(bg: string): '#222' | '#fff' {
  // Remove url() and gradients for simplicity
  if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) return '#fff';
  if (bg.startsWith('url(')) return '#fff';
  // Extract hex color
  let hex = bg;
  if (hex.startsWith('#')) hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  // YIQ formula
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return yiq >= 180 ? '#222' : '#fff';
}

// Helper to get user's country (stub, replace with real logic if available)
function getUserCountry(user: any): string | null {
  // If you have user.country, use it. Otherwise, return null for global.
  return user?.country || null;
}

// Helper to check if today matches a special background's date
function isTodaySpecial(bg: SpecialBackground, userCountry: string | null): boolean {
  const today = dayjs();
  // Handle fixed date (MM-DD)
  if (typeof bg.date === 'string' && /^\d{2}-\d{2}$/.test(bg.date)) {
    const [month, day] = bg.date.split('-');
    if (today.format('MM-DD') !== `${month}-${day}`) return false;
  }
  // Handle rule-based (Mother's Day, etc.)
  if (typeof bg.date === 'object' && bg.date.rule) {
    // Example: Mother's Day (second Sunday in May)
    if (bg.date.rule === 'second-sunday-may') {
      const may = today.month() === 4; // 0-indexed, 4 = May
      const sunday = today.day() === 0;
      const second = Math.ceil(today.date() / 7) === 2;
      if (!(may && sunday && second)) return false;
    }
    // Add more rules as needed (Eid, Diwali, etc.)
    // If unknown rule, hide by default
    else return false;
  }
  // Show all special days to all users, regardless of country
  return true;
}

const PRESET_COLORS = [
  '#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
  'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
];

const FONTS = [
  'Arial', 'Georgia', 'Impact', 'Comic Sans MS', 'Courier New', 'Times New Roman',
];

const FONT_SIZES = [24, 32, 40, 48, 56];

interface TextMomentCreatorProps {
  user: any;
  onMomentCreated?: () => void;
  isUploading?: boolean;
  setIsUploading?: (v: boolean) => void;
}

const TextMomentCreator: React.FC<TextMomentCreatorProps> = ({ user, onMomentCreated, isUploading, setIsUploading }) => {
  const [text, setText] = useState('');
  const [bg, setBg] = useState<string>(PRESET_COLORS[0]);
  const [font, setFont] = useState(FONTS[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
  const [customColor, setCustomColor] = useState('');
  const [selectedSpecial, setSelectedSpecial] = useState<SpecialBackground | null>(null);
  const [customSpecialMessage, setCustomSpecialMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Custom special day state
  const [customSpecialActive, setCustomSpecialActive] = useState(false);
  const [customSpecialBg, setCustomSpecialBg] = useState<string>(PRESET_COLORS[1]);
  const [customSpecialIcon, setCustomSpecialIcon] = useState<string>(CUSTOM_ICONS[0]);
  const [customSpecialName, setCustomSpecialName] = useState('My Special Day');
  const [customSpecialMsg, setCustomSpecialMsg] = useState('');

  // Handle background selection
  const handleBgSelect = (color: string) => {
    setSelectedSpecial(null);
    setBg(color);
    setCustomSpecialActive(false);
  };

  // Handle special background selection
  const handleSpecialSelect = (bg: SpecialBackground) => {
    setSelectedSpecial(bg);
    // If background is a CSS gradient, use it; else, use image URL
    if (bg.background.startsWith('linear-gradient') || bg.background.startsWith('#')) {
      setBg(bg.background);
    } else {
      setBg(`url('${bg.background}')`);
    }
  };

  // Live preview style
  const previewBg = customSpecialActive ? customSpecialBg : (selectedSpecial ? selectedSpecial.background : bg);
  const previewStyle: React.CSSProperties = {
    background: previewBg,
    color: getContrastYIQ(previewBg),
    fontFamily: font,
    fontSize: fontSize,
    minHeight: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    borderRadius: 16,
    padding: 24,
  };

  const handlePostMoment = async () => {
    if (!user) return;
    if (!text.trim()) {
      setError('Text is required');
      return;
    }
    if ((customSpecialActive ? customSpecialMsg : customSpecialMessage).length > 60) {
      setError('Special message must be 60 characters or less');
      return;
    }
    setError(null);
    setIsUploading && setIsUploading(true);
    try {
      // Save text moment as a post with post_type: 'moment' and extra fields for bg/font/fontSize
      const insertObj: any = {
        user_id: user.id,
        content: text,
        post_type: 'moment',
        privacy: 'public',
        moment_type: 'text',
        moment_bg: previewBg,
        moment_font: font,
        moment_font_size: fontSize,
      };
      if (selectedSpecial) {
        insertObj.moment_special_message = customSpecialMessage.trim() || undefined;
        insertObj.moment_special_icon = selectedSpecial.icon;
        insertObj.moment_special_name = selectedSpecial.name;
        insertObj.moment_special_id = selectedSpecial.id;
      }
      if (customSpecialActive) {
        insertObj.is_custom_special_day = true;
        insertObj.moment_special_message = customSpecialMsg.trim() || undefined;
        insertObj.moment_special_icon = customSpecialIcon;
        insertObj.moment_special_name = customSpecialName;
      }
      const { error } = await supabase
        .from('posts')
        .insert(insertObj)
        .select()
        .single();
      if (error) throw error;
      if (onMomentCreated) onMomentCreated();
      setText('');
      setCustomColor('');
      setSelectedSpecial(null);
      setCustomSpecialMessage('');
      setCustomSpecialActive(false);
      setCustomSpecialBg(PRESET_COLORS[1]);
      setCustomSpecialIcon(CUSTOM_ICONS[0]);
      setCustomSpecialName('My Special Day');
      setCustomSpecialMsg('');
      setBg(PRESET_COLORS[0]);
      setFont(FONTS[0]);
      setFontSize(FONT_SIZES[2]);
    } catch (err: any) {
      setError(err.message || 'Failed to post moment');
    } finally {
      setIsUploading && setIsUploading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-md mx-auto">
    

        {/* Special Backgrounds for Today and Create Yours moved below */}

        <textarea
          className="w-full rounded border p-2 text-lg bg-background text-foreground border-border"
          rows={3}
          placeholder="Type your moment..."
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ fontFamily: font, fontSize }}
        />
        
        <div className="flex flex-wrap gap-2 items-center">
          {PRESET_COLORS.map((color, i) => (
            <button
              key={i}
              className="w-8 h-8 rounded-full border-2 border-white shadow"
              style={{ background: color, outline: bg === color ? '2px solid #333' : undefined }}
              onClick={() => handleBgSelect(color)}
              aria-label={`Color ${color}`}
            />
          ))}
          <input
            type="color"
            value={customColor || '#ffffff'}
            onChange={e => {
              setCustomColor(e.target.value);
              handleBgSelect(e.target.value);
            }}
            className="w-8 h-8 rounded-full border-2 border-gray-300 cursor-pointer"
            title="Pick custom color"
          />
        </div>
        
        <div className="flex gap-2 items-center">
          <select value={font} onChange={e => setFont(e.target.value)} className="border rounded p-1 bg-background text-foreground border-border">
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="border rounded p-1 bg-background text-foreground border-border ml-4">
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Special Days You Can Celebrate Today</h3>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold transition-all duration-200 ${customSpecialActive ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
              onClick={() => setCustomSpecialActive(v => !v)}
              type="button"
              style={{ minWidth: 90 }}
            >
              {customSpecialActive ? 'Close' : 'Create Yours'}
            </button>
          </div>
          {/* Animate custom special day section */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${customSpecialActive ? 'max-h-[600px] opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}`}
            style={{ willChange: 'max-height, opacity' }}
          >
            <div className="border rounded-lg p-3 bg-card border-border mb-2">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                {PRESET_COLORS.slice(1).map((color, i) => (
                  <button
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white shadow"
                    style={{ background: color, outline: customSpecialBg === color ? '2px solid #333' : undefined }}
                    onClick={() => { setCustomSpecialBg(color); setCustomSpecialActive(true); setBg(color); }}
                    aria-label={`Color ${color}`}
                  />
                ))}
                <input
                  type="color"
                  value={customSpecialBg || '#ffffff'}
                  onChange={e => { setCustomSpecialBg(e.target.value); setCustomSpecialActive(true); setBg(e.target.value); }}
                  className="w-7 h-7 rounded-full border-2 border-gray-300 cursor-pointer"
                  title="Pick custom color"
                />
              </div>
              <div className="flex flex-col gap-2 mb-2">
                <label className="text-xs font-medium text-foreground">Pick an icon:</label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto bg-background rounded p-1 border border-border">
                  {CUSTOM_ICONS.slice(0, 24).map((icon, i) => (
                    <button
                      key={i}
                      className={`text-xl rounded p-1 ${customSpecialIcon === icon ? 'bg-blue-200 dark:bg-blue-700' : ''}`}
                      onClick={() => { setCustomSpecialIcon(icon); setCustomSpecialActive(true); }}
                      type="button"
                    >{icon}</button>
                  ))}
                  {/* Expand for more icons if needed */}
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                <label className="text-xs font-medium text-foreground">Special day name:</label>
                <input
                  type="text"
                  maxLength={32}
                  className="w-full rounded border p-1 text-sm bg-background text-foreground border-border"
                  placeholder="e.g. My Birthday Bash"
                  value={customSpecialName}
                  onChange={e => { setCustomSpecialName(e.target.value); setCustomSpecialActive(true); }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Custom festive message (max 60 chars):</label>
                <input
                  type="text"
                  maxLength={60}
                  className="w-full rounded border p-1 text-sm bg-background text-foreground border-border"
                  placeholder="e.g. Happy Me Day!"
                  value={customSpecialMsg}
                  onChange={e => { setCustomSpecialMsg(e.target.value); setCustomSpecialActive(true); }}
                />
                <div className="text-xs text-muted-foreground text-right">{customSpecialMsg.length}/60</div>
              </div>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-3 pb-2">
            {specialBackgrounds.filter(bg => isTodaySpecial(bg, getUserCountry(user))).map(bg => (
              <button
                key={bg.id}
                className={`rounded-lg border-2 flex flex-col items-center justify-center ${selectedSpecial?.id === bg.id ? 'border-blue-500' : 'border-transparent'}`}
                style={{ width: 80, height: 80, background: bg.background, position: 'relative' }}
                title={bg.name}
                onClick={() => { handleSpecialSelect(bg); setCustomSpecialActive(false); }}
              >
                {bg.icon && <span style={{ fontSize: 28, position: 'absolute', top: 8, right: 8 }}>{bg.icon}</span>}
                <span className="text-xs font-semibold text-white drop-shadow mt-auto mb-2" style={{ textShadow: '0 1px 4px #000' }}>{bg.name}</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">These backgrounds are only available on special days for your country or the world.</div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Preview</h3>
          {selectedSpecial && (
            <div className="mb-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                Custom festive message (max 60 chars):
              </label>
              <input
                type="text"
                maxLength={60}
                className="w-full rounded border p-1 text-sm bg-background text-foreground border-border"
                placeholder={selectedSpecial.description || selectedSpecial.name}
                value={customSpecialMessage}
                onChange={e => setCustomSpecialMessage(e.target.value)}
              />
              <div className="text-xs text-muted-foreground text-right">{customSpecialMessage.length}/60</div>
            </div>
          )}
          <div style={previewStyle} className="relative overflow-hidden">
            {/* User text, centered */}
            <span style={{ width: '100%', zIndex: 1, color: getContrastYIQ(previewBg) }}>{text || 'Your text moment will appear here'}</span>
            {/* Bottom row: icon left, message right */}
            {(customSpecialActive || selectedSpecial) && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 8,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0 16px',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              >
                {/* Special icon bottom left */}
                <span
                  style={{
                    fontSize: 32,
                    textShadow: '0 2px 8px #0008',
                    background: 'rgba(0,0,0,0.10)',
                    borderRadius: 8,
                    padding: '2px 6px',
                    minWidth: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {customSpecialActive
                    ? customSpecialIcon
                    : selectedSpecial?.icon}
                </span>
                {/* Special message bottom right */}
                <span
                  style={{
                    fontSize: 16,
                    color: '#fff',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: 8,
                    padding: '2px 10px',
                    fontWeight: 600,
                    textShadow: '0 1px 4px #000',
                    marginLeft: 'auto',
                    marginRight: 0,
                    minWidth: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  {customSpecialActive
                    ? (customSpecialMsg || customSpecialName)
                    : (customSpecialMessage || selectedSpecial?.description || selectedSpecial?.name)}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          disabled={!text.trim() || isUploading}
          onClick={handlePostMoment}
        >
          {isUploading ? 'Sharing...' : 'Share Moment'}
        </Button>
      </div>
    </>
  );
};

export default TextMomentCreator;
