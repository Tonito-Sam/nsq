import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile, getMediaUrl } from '@/utils/mediaUtils';
import { DEFAULT_TARGET_COUNTRIES } from '@/utils/targetCountries';
import ReactCountryFlag from 'react-country-flag';
import { 
  Zap, 
  Target, 
  Globe, 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Rocket,
  Shield,
  Sparkles,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react';

const CampaignCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ real_balance: 0, virtual_balance: 100, total_balance: 100 });
  const location = useLocation();
    const [postId, setPostId] = useState<string | null>(null);
    const [postData, setPostData] = useState<any | null>(null);
    const [messageOverride, setMessageOverride] = useState<string | null>(null);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);
    const [destinationUrl, setDestinationUrl] = useState<string>('');
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');

  // form state
  const [name, setName] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [days, setDays] = useState<number>(7);
  const [startAt, setStartAt] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [targetJson, setTargetJson] = useState('{"countries": ["US"], "age_min": 18}');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(DEFAULT_TARGET_COUNTRIES.slice());
  const [countrySearch, setCountrySearch] = useState('');
  const [showAllCountries, setShowAllCountries] = useState(false);
  const ageGroupOptions = ['13-17','18-24','25-34','35-44','45-54','55-64','65+'];
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>(['18-24','25-34']);
  const [interestsInput, setInterestsInput] = useState('');
  const [showAdvancedTarget, setShowAdvancedTarget] = useState(false);

  const getCountryName = (iso?: string) => {
    if (!iso) return iso || '';
    try {
      // Use Intl.DisplayNames when available
      // Fallback to ISO code if not supported
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dn = typeof Intl !== 'undefined' && (Intl as any).DisplayNames ? new (Intl as any).DisplayNames(['en'], { type: 'region' }) : null;
      if (dn) return dn.of(iso.toUpperCase()) || iso.toUpperCase();
    } catch (e) {
      // ignore
    }
    return iso.toUpperCase();
  };
  const [objective, setObjective] = useState('impressions');
  const [budgetModel, setBudgetModel] = useState<'fixed' | 'daily'>('daily');
  const [autoRenew, setAutoRenew] = useState(true);
  const [audienceSize, setAudienceSize] = useState(1000);
  const [bidStrategy, setBidStrategy] = useState('auto');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [estimatedReach, setEstimatedReach] = useState(0);
  const [estimatedImpressions, setEstimatedImpressions] = useState(0);

  // Pricing defaults
  // Pricing defaults
  // Boost per day is $0.75 (75 cents)
  const BOOST_DAILY = 0.75; // boost per day
  const AD_DAILY = 1.0; // ad campaign per day

  // Preset templates
  const campaignTemplates = [
    { id: 'brand-awareness', name: 'Brand Awareness', objective: 'impressions', budget: 50, days: 14, audience: 'broad' },
    { id: 'engagement', name: 'High Engagement', objective: 'engagement', budget: 75, days: 7, audience: 'targeted' },
    { id: 'quick-boost', name: 'Quick Boost', objective: 'boost_post', budget: 25, days: 3, audience: 'broad' },
    { id: 'custom', name: 'Custom', objective: 'impressions', budget: 0, days: 7, audience: 'custom' }
  ];

  useEffect(() => {
    if (!user) return;
    fetchWallet();
    calculateEstimates();

    let channel: any;
    try {
      channel = supabase.channel(`wallets-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => setTimeout(fetchWallet, 100))
        .subscribe();
    } catch (e) {
      console.warn('wallet realtime subscribe failed', e);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user, budget, days, objective, audienceSize]);

  // Read postId from query params for quick-boost flows
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = params.get('postId');
    setPostId(p || null);
    if (p) {
      // If the user came from a boost CTA, switch objective to boost_post and adjust defaults
      setObjective('boost_post');
      setBudgetModel('daily');
      setDays(1);
      // fetch the post preview
      (async () => {
        try {
          const { data, error } = await supabase.from('posts').select('*').eq('id', p).single();
          if (!error && data) {
            setPostData(data);
            setMessageOverride(data.content || '');
            // set media preview if present
            const mediaUrl = data.image_url || data.video_url || (data.media_urls && data.media_urls[0]) || null;
            if (mediaUrl) setAttachedPreviewUrl(getMediaUrl(mediaUrl));
          }
        } catch (e) {
          console.error('fetch post preview failed', e);
        }
      })();
    }
  }, [location.search]);

  useEffect(() => {
    calculateEstimates();
  }, [budget, days, objective, audienceSize]);

  const fetchWallet = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('real_balance, virtual_balance, total_balance')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setWallet({
          real_balance: data.real_balance || 0,
          virtual_balance: data.virtual_balance || 100,
          total_balance: data.total_balance || ((data.real_balance || 0) + (data.virtual_balance || 100))
        });
      } else if (error && error.code === 'PGRST116') {
        // No wallet record found, create one with initial virtual balance (same behaviour as Wallet page)
        const initialVirtualBalance = 100;
        const { data: newWallet, error: insertError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            real_balance: 0,
            virtual_balance: initialVirtualBalance,
            total_balance: initialVirtualBalance,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!insertError && newWallet) {
          setWallet({ real_balance: 0, virtual_balance: initialVirtualBalance, total_balance: initialVirtualBalance });
        }
      }
    } catch (e) { console.error('fetchWallet', e); }
  };

  const calculateEstimates = () => {
    let dailyBudget = 0;
    if (budgetModel === 'fixed') {
      const totalBudget = Number(budget || 0);
      dailyBudget = totalBudget / Math.max(1, days);
    } else {
      dailyBudget = Number(budget || (objective === 'boost_post' ? BOOST_DAILY : AD_DAILY));
      // enforce minimum daily rates: boosts have BOOST_DAILY min, ads have AD_DAILY min
      if (objective === 'boost_post') {
        dailyBudget = Math.max(dailyBudget, BOOST_DAILY);
      } else {
        dailyBudget = Math.max(dailyBudget, AD_DAILY);
      }
    }

    const totalBudget = dailyBudget * days;
    const costPerImpression = 0.001; // $1 per 1000 impressions
    const costPerEngagement = 0.05; // $0.05 per engagement
    
    if (objective === 'impressions') {
      const impressions = Math.floor(totalBudget / costPerImpression);
      const reach = Math.floor(impressions * 0.3); // Rough estimate: 30% reach rate
      setEstimatedImpressions(impressions);
      setEstimatedReach(reach);
    } else if (objective === 'engagement') {
      const engagements = Math.floor(totalBudget / costPerEngagement);
      const reach = Math.floor(engagements * 10); // Rough estimate
      setEstimatedImpressions(engagements * 5); // Estimate 5 impressions per engagement
      setEstimatedReach(reach);
    } else {
      const impressions = Math.floor(totalBudget / 0.0005); // Cheaper for boost posts
      setEstimatedImpressions(impressions);
      setEstimatedReach(Math.floor(impressions * 0.4));
    }
  };

  const previewCharge = () => {
    let totalBudget = 0;
    if (budgetModel === 'fixed') {
      totalBudget = Number(budget || 0);
    } else {
      let dailyBudget = Number(budget || (objective === 'boost_post' ? BOOST_DAILY : AD_DAILY));
      if (objective === 'boost_post') {
        dailyBudget = Math.max(dailyBudget, BOOST_DAILY);
      } else {
        dailyBudget = Math.max(dailyBudget, AD_DAILY);
      }
      totalBudget = dailyBudget * Math.max(1, days);
    }

    if (!totalBudget || totalBudget <= 0) return { virtual: 0, real: 0, total: 0 };
    const virtualAvail = Number(wallet.virtual_balance || 0);
    const chargeVirtual = Math.min(virtualAvail, totalBudget);
    const remainder = +(totalBudget - chargeVirtual).toFixed(2);
    return { 
      virtual: +chargeVirtual.toFixed(2), 
      real: remainder,
      total: totalBudget
    };
  };

  const validateForm = () => {
    setFormError(null);
    const charges = previewCharge();
    
    if (charges.total <= 0) { 
      setFormError('Budget must be greater than 0'); 
      return false; 
    }
    
    if (charges.real > wallet.real_balance) {
      setFormError(`Insufficient real balance. Need $${charges.real.toFixed(2)} but have $${wallet.real_balance.toFixed(2)}`);
      return false;
    }
    
    if (showAdvancedTarget) {
      try {
        JSON.parse(targetJson);
      } catch (e) {
        setFormError('Target JSON is invalid');
        return false;
      }
    }
    
    return true;
  };

  const applyTemplate = (template: any) => {
    setName(template.name);
    setObjective(template.objective);
    if (template.budget > 0) {
      setBudget(template.budget.toString());
      setBudgetModel('fixed');
    }
    setDays(template.days);
    if (template.audience === 'broad') {
      const t = { countries: ['US', 'CA', 'GB', 'AU'], age_min: 18, age_max: 65 };
      setTargetJson(JSON.stringify(t));
      setSelectedCountries(['US','CA','GB','AU']);
      setSelectedAgeGroups(['18-24','25-34','35-44','45-54','55-64']);
      setInterestsInput('');
      setAudienceSize(5000);
    } else if (template.audience === 'targeted') {
      const t = { countries: ['US'], age_min: 25, age_max: 44, interests: ['technology', 'business'] };
      setTargetJson(JSON.stringify(t));
      setSelectedCountries(['US']);
      setSelectedAgeGroups(['25-34','35-44']);
      setInterestsInput('technology,business');
      setAudienceSize(2000);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!validateForm()) return;
    
    setCreating(true);
    try {
      const budgetNum = previewCharge().total;
      let targetOptions: any = {};
      if (showAdvancedTarget) {
        targetOptions = JSON.parse(targetJson || '{}');
      } else {
        const interests = interestsInput.split(',').map(s => s.trim()).filter(Boolean);
        if (showAllCountries) {
          targetOptions.all_countries = true;
        } else {
          let countries = selectedCountries.slice();
          if (!countries || countries.length === 0) countries = DEFAULT_TARGET_COUNTRIES.slice();
          if (countries.length) targetOptions.countries = countries;
        }
        if (selectedAgeGroups && selectedAgeGroups.length) targetOptions.age_groups = selectedAgeGroups;
        if (interests.length) targetOptions.interests = interests;
      }
      targetOptions.auto_renew = !!autoRenew;
      targetOptions.audience_size = audienceSize;
      targetOptions.bid_strategy = bidStrategy;

      const payload: any = {
        user_id: user.id,
        post_id: postId || null,
        name: name || `Campaign ${new Date().toISOString().slice(0, 10)}`,
        objective: objective || 'impressions',
        budget_usd: budgetNum,
        start_at: startAt || new Date(Date.now() + 86400000).toISOString(),
        target_options: targetOptions,
        metadata: {
          budget_model: budgetModel,
          estimated_reach: estimatedReach,
          estimated_impressions: estimatedImpressions,
          audience_size: audienceSize,
          bid_strategy: bidStrategy
        }
      };

      const resp = await fetch('/api/campaigns', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || JSON.stringify(j));
      
      // Show success and navigate
      navigate('/campaigns');
    } catch (e: any) {
      console.error('create campaign error', e);
      setFormError(e.message || 'Could not create campaign');
    } finally { 
      setCreating(false); 
    }
  };

  const charges = previewCharge();

  const getDailyBudgetDisplay = () => {
    if (budgetModel === 'fixed') {
      const total = Number(budget || 0);
      return (total / Math.max(1, days)).toFixed(2);
    }
    let daily = Number(budget || (objective === 'boost_post' ? BOOST_DAILY : AD_DAILY));
    if (objective === 'boost_post') {
      daily = Math.max(daily, BOOST_DAILY);
    } else {
      daily = Math.max(daily, AD_DAILY);
    }
    return daily.toFixed(2);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')} className="rounded-full">
                <Clock className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
                <p className="text-muted-foreground">Launch a powerful advertising campaign in minutes</p>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              <Sparkles className="h-3 w-3 mr-2" />
              AI Powered
            </Badge>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Campaign Builder */}
            <div className="lg:col-span-2 space-y-8">
              {/* Template Selector */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Rocket className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Campaign Templates</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {campaignTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant={template.id === 'custom' ? 'default' : 'outline'}
                        className="h-auto py-4 flex flex-col items-center justify-center gap-2"
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="text-lg font-medium">{template.name}</div>
                        {template.budget > 0 && (
                          <div className="text-sm text-muted-foreground">${template.budget}</div>
                        )}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Details */}
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Campaign Details</h3>
                      </div>
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Enter campaign name"
                        className="text-lg h-12"
                      />
                    </div>

                      {/* If boosting a specific post, show a preview and editable creative fields */}
                      {postData && (
                        <Card className="mt-4">
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <img src={postData.user?.avatar_url || '/placeholder.svg'} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                                <div className="flex-1">
                                  <div className="font-medium">{postData.user?.full_name || postData.user?.username || 'User'}</div>
                                  <div className="text-sm text-muted-foreground">Original post preview</div>
                                  <div className="mt-2">
                                    <Textarea value={messageOverride || ''} onChange={e => setMessageOverride(e.target.value)} rows={4} />
                                  </div>
                                  {attachedPreviewUrl && (
                                    <div className="mt-3">
                                      {attachedPreviewUrl.endsWith('.mp4') || attachedPreviewUrl.includes('video') ? (
                                        <video src={attachedPreviewUrl} controls className="max-h-48 rounded-lg" />
                                      ) : (
                                        <img src={attachedPreviewUrl} alt="preview" className="max-h-48 rounded-lg object-contain" />
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center gap-2">
                                    <input type="file" accept="image/*,video/*" onChange={e => {
                                      const f = e.target.files && e.target.files[0];
                                      if (!f) return;
                                      setAttachedFile(f);
                                      try { setAttachedPreviewUrl(URL.createObjectURL(f)); } catch(e){}
                                    }} />
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 gap-2">
                                    <Input placeholder="Destination URL (optional)" value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} />
                                    <Input placeholder="WhatsApp number (optional)" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Budget Model
                        </label>
                        <Tabs value={budgetModel} onValueChange={(v: any) => setBudgetModel(v)} className="w-full">
                          <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="daily">Daily</TabsTrigger>
                            <TabsTrigger value="fixed">Lifetime</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {budgetModel === 'daily' ? 'Daily Budget' : 'Total Budget'} (USD)
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={budget}
                              onChange={e => setBudget(e.target.value)}
                              placeholder={budgetModel === 'daily' ? "e.g., 10.00 per day" : "e.g., 100.00 total"}
                              type="number"
                              min="0"
                              step="0.01"
                              className="pl-9"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Duration
                        </label>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[days]}
                            onValueChange={([value]) => setDays(value)}
                            min={1}
                            max={30}
                            step={1}
                            className="flex-1"
                          />
                          <div className="w-16">
                            <Input
                              value={days}
                              onChange={e => setDays(Number(e.target.value) || 1)}
                              type="number"
                              min="1"
                              max="30"
                              className="text-center"
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Starts: {new Date(startAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Objective Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Objective
                      </label>
                      <Select value={objective} onValueChange={setObjective}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select objective" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="impressions">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              <span>Brand Awareness (Impressions)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="engagement">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>Engagement</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="boost_post">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              <span>Boost Post</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Targeting */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Audience Targeting
                      </label>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">Audience Size</span>
                            <span className="text-sm font-medium">{audienceSize.toLocaleString()} people</span>
                          </div>
                          <Slider
                            value={[audienceSize]}
                            onValueChange={([value]) => setAudienceSize(value)}
                            min={100}
                            max={10000}
                            step={100}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium block mb-2">Audience Targeting (easy)</label>
                          <div className="grid sm:grid-cols-1 gap-3">
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">Countries</label>
                                <label className="inline-flex items-center text-xs">
                                  <input type="checkbox" checked={showAllCountries} onChange={e => setShowAllCountries(e.target.checked)} className="mr-2" />
                                  <span>Show to all countries</span>
                                </label>
                              </div>

                              {!showAllCountries && (
                                <div className="mt-2 border rounded-md bg-muted/5">
                                  <div className="p-2">
                                    <input
                                      type="text"
                                      placeholder="Search country ISO (e.g. US, NG)..."
                                      value={countrySearch}
                                      onChange={e => setCountrySearch(e.target.value)}
                                      className="w-full px-3 py-2 text-sm bg-transparent border rounded-md"
                                    />
                                  </div>
                                  <div className="max-h-44 overflow-auto p-2">
                                    {DEFAULT_TARGET_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).map(code => {
                                      const checked = selectedCountries.includes(code);
                                      return (
                                        <label key={code} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/10 rounded">
                                          <input type="checkbox" checked={checked} onChange={() => {
                                            if (checked) setSelectedCountries(prev => prev.filter(x => x !== code));
                                            else setSelectedCountries(prev => [...prev, code]);
                                          }} />
                                          <span className="text-sm font-medium flex items-center gap-2">
                                            <ReactCountryFlag
                                              countryCode={code}
                                              svg
                                              style={{ width: '1.4em', height: '1.4em' }}
                                              title={getCountryName(code)}
                                            />
                                            <span className="truncate">{getCountryName(code)} <span className="text-xs text-muted-foreground">({code})</span></span>
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <div className="p-2 text-xs text-muted-foreground">
                                    Selected: {selectedCountries.length} countries
                                  </div>
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="text-xs text-muted-foreground">Age Groups</label>
                              <div className="mt-2 border rounded-md p-2 bg-muted/5">
                                {ageGroupOptions.map(group => {
                                  const checked = selectedAgeGroups.includes(group);
                                  return (
                                    <label key={group} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/10 rounded">
                                      <input type="checkbox" checked={checked} onChange={() => {
                                        if (checked) setSelectedAgeGroups(prev => prev.filter(x => x !== group));
                                        else setSelectedAgeGroups(prev => [...prev, group]);
                                      }} />
                                      <span className="text-sm">{group}</span>
                                    </label>
                                  );
                                })}
                                <div className="text-xs text-muted-foreground mt-2">Selected: {selectedAgeGroups.length}</div>
                              </div>
                            </div>

                            <div className="sm:col-span-1">
                              <label className="text-xs text-muted-foreground">Interests (comma-separated)</label>
                              <Input value={interestsInput} onChange={e => setInterestsInput(e.target.value)} placeholder="technology,business,food" />
                            </div>
                          </div>
                          <div className="mt-2 text-sm">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={showAdvancedTarget} onChange={e => setShowAdvancedTarget(e.target.checked)} />
                              <span className="text-xs">Show advanced JSON</span>
                            </label>
                          </div>
                          {showAdvancedTarget && (
                            <div className="mt-2">
                              <label className="text-sm font-medium block mb-2">Targeting Options (JSON)</label>
                              <Textarea
                                value={targetJson}
                                onChange={e => setTargetJson(e.target.value)}
                                placeholder='{"countries": ["US"], "age_min": 18, "interests": []}'
                                rows={6}
                                className="font-mono text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bid Strategy */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Bid Strategy</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['auto', 'lowest', 'maximize'].map((strategy) => (
                          <Button
                            key={strategy}
                            variant={bidStrategy === strategy ? 'default' : 'outline'}
                            onClick={() => setBidStrategy(strategy)}
                            className="capitalize"
                          >
                            {strategy === 'auto' && 'Auto-bid'}
                            {strategy === 'lowest' && 'Lowest Cost'}
                            {strategy === 'maximize' && 'Maximize'}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Auto-renew */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
                        <div>
                          <div className="font-medium">Auto-renew Campaign</div>
                          <div className="text-sm text-muted-foreground">Automatically renew with same budget</div>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        Recommended
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Preview & Summary */}
            <div className="space-y-8">
              {/* Wallet Balance */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Your Balance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Virtual</span>
                      <span className="text-2xl font-bold text-blue-600">${wallet.virtual_balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Real</span>
                      <span className="text-2xl font-bold text-green-600">${wallet.real_balance.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Available</span>
                        <span className="text-2xl font-bold">${wallet.total_balance.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Preview */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Cost Preview</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Daily Budget</span>
                      <span className="font-medium">${getDailyBudgetDisplay()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Budget</span>
                      <span className="text-xl font-bold">${previewCharge().total.toFixed(2)}</span>
                    </div>
                    <div className="space-y-2 pt-4 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Virtual Balance</span>
                        <span className="text-blue-600">-${charges.virtual.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Real Balance</span>
                        <span className="text-green-600">-${charges.real.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex justify-between font-bold">
                        <span>Remaining Balance</span>
                        <span>${(wallet.total_balance - charges.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estimated Results */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Estimated Results</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Estimated Reach</span>
                        <span className="font-bold">{estimatedReach.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min(100, (estimatedReach / 10000) * 100)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Estimated Impressions</span>
                        <span className="font-bold">{estimatedImpressions.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min(100, (estimatedImpressions / 50000) * 100)} className="h-2" />
                    </div>
                    <div className="text-sm text-muted-foreground pt-2">
                      Estimates based on your targeting and budget. Actual results may vary.
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="sticky top-4 space-y-4">
                {formError && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="text-sm font-medium text-destructive">{formError}</div>
                  </div>
                )}
                
                <div className="grid gap-3">
                  <Button 
                    size="lg" 
                    onClick={handleCreate} 
                    disabled={creating || !name}
                    className="h-14 text-base"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Campaign...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Launch Campaign
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => navigate('/campaigns')}
                    className="h-12"
                  >
                    Cancel
                  </Button>
                </div>
                
                <div className="text-xs text-center text-muted-foreground">
                  By clicking "Launch Campaign", you agree to our Terms of Service
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
};

export default CampaignCreate;