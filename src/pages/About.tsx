import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Users, Globe, Heart, Zap, BarChart2, Award, TrendingUp, BookOpen, Layers, Globe2, UserCheck2, Wallet, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'platform', label: 'Platform', icon: <Globe2 className="h-5 w-5 mr-2" /> },
  { key: 'impact', label: 'Impact', icon: <BarChart2 className="h-5 w-5 mr-2" /> },
  { key: 'sdgs', label: 'SDGs', icon: <Award className="h-5 w-5 mr-2" /> },
  { key: 'foundation', label: 'Foundation', icon: <Heart className="h-5 w-5 mr-2 text-pink-500" /> },
  { key: 'company', label: 'Company & Vision', icon: <Zap className="h-5 w-5 mr-2 text-yellow-500" /> },
  { key: 'pep', label: 'PEP', icon: <Wallet className="h-5 w-5 mr-2 text-green-500" /> },
];

const About = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('platform');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#e0e7ff] to-[#f0fdfa] dark:from-[#18181b] dark:via-[#312e81] dark:to-[#0f172a]">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-12">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')}
            className="mb-4 flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <img 
            src="/lovable-uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" 
            alt="NexSq" 
            className="h-24 w-auto mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight text-left">
            Welcome to NexSq
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-200 max-w-2xl mx-auto mb-4 font-medium text-left">
            The Next Generation Digital Square
          </p>
          <div className="flex gap-2 mt-8 mb-4 flex-wrap">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`inline-flex items-center px-5 py-2 rounded-full font-semibold text-base transition shadow ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900'}`}
                onClick={() => setTab(t.key)}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
        {tab === 'platform' && (
          <>
            <div className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-left">
              NexSq is more than a platform. We are a global digital ecosystem built to foster connection, collaboration, and commerce for creators, entrepreneurs, and communities who want to shape the future. Born from the vision of "what's next," NexSq is the evolution of 1VoiceSquare, reimagined for a world that's borderless, economically-empowered, and driven by innovation for today and beyond.
            </div>
            <div className="flex flex-wrap gap-4 mb-8">
              <span className="inline-block bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 px-4 py-2 rounded-full font-semibold text-base shadow">Global by Design</span>
              <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold text-base shadow">Empowerment First</span>
              <span className="inline-block bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-4 py-2 rounded-full font-semibold text-base shadow">Innovation at the Core</span>
              <span className="inline-block bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200 px-4 py-2 rounded-full font-semibold text-base shadow">Community & Collaboration</span>
            </div>
          </>
        )}
        <div className="mb-10">
          {tab === 'pep' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0 text-left">
              <div className="max-w-3xl mx-auto text-lg text-gray-700 dark:text-gray-200 leading-relaxed mb-6 text-left">
                <img src="/lovable-uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" alt="NexSq Logo" className="h-16 w-auto mb-6 rounded-xl shadow" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Private Equity Participation (PEP)</h2>
                <div className="bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900 rounded-xl p-5 mb-8 border-l-4 border-blue-500 dark:border-blue-400 shadow">
                  <span className="block text-lg md:text-xl font-semibold text-blue-700 dark:text-blue-200 mb-2">Why are we seeking Private Equity Participation?</span>
                  <span className="block text-base text-gray-700 dark:text-gray-200">NexSq is at a pivotal moment: our platform is built, our vision is clear, and our early traction is strong. To accelerate our go-to-market launch, drive user adoption, and build a thriving digital ecosystem, we are opening a limited equity round for visionary investors who want to shape the future of digital opportunity in Africa and beyond. Your investment will fuel rapid growth, innovation, and impact at scale.</span>
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-4 mb-8 justify-between items-stretch">
                  <div className="flex flex-col justify-center items-center flex-1 min-w-[180px] bg-gradient-to-r from-green-400 to-blue-500 text-white px-6 py-4 rounded-2xl shadow font-bold text-lg">
                    <BarChart2 className="h-7 w-7 mb-1" />
                    <span>ASK</span>
                    <span className="text-xl font-extrabold mt-1">$1,200,000 USD</span>
                  </div>
                  <div className="flex flex-col justify-center items-center flex-1 min-w-[180px] bg-gradient-to-r from-blue-500 to-green-400 text-white px-6 py-4 rounded-2xl shadow font-bold text-lg">
                    <Zap className="h-7 w-7 mb-1" />
                    <span>OFFER</span>
                    <span className="text-xl font-extrabold mt-1">20% Equity</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 items-center mb-8">
                  <Button
                    onClick={() => window.open('/about-onepager', '_blank')}
                    className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow hover:scale-105 transition-transform"
                  >
                    View NexSq PEP One-Pager
                  </Button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">See full details: shareholding, ROI, and user/investor benefits.</span>
                </div>
                    <h4 className="font-bold text-lg mb-4 text-blue-700 dark:text-blue-300">Projected User Growth (2025-2030)</h4>
      <div className="w-full h-64 bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900 rounded-xl p-4 shadow-inner border border-blue-200 dark:border-blue-800 mb-4">
        <div className="flex h-full items-end justify-between gap-2">
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-400 to-blue-300 dark:from-blue-500 dark:to-blue-400" style={{ height: '10%' }}></div>
            <span className="text-xs mt-2">2025</span>
            <span className="text-xs font-bold">20,000</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-400 to-indigo-300 dark:from-indigo-500 dark:to-indigo-400" style={{ height: '20%' }}></div>
            <span className="text-xs mt-2">2026</span>
            <span className="text-xs font-bold">200,000</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-green-400 to-green-300 dark:from-green-500 dark:to-green-400" style={{ height: '40%' }}></div>
            <span className="text-xs mt-2">2027</span>
            <span className="text-xs font-bold">1,000,000</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-500 dark:to-orange-400" style={{ height: '60%' }}></div>
            <span className="text-xs mt-2">2028</span>
            <span className="text-xs font-bold">3,000,000</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-500 dark:to-yellow-400" style={{ height: '80%' }}></div>
            <span className="text-xs mt-2">2029</span>
            <span className="text-xs font-bold">5,000,000</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-pink-400 to-pink-300 dark:from-pink-500 dark:to-pink-400" style={{ height: '100%' }}></div>
            <span className="text-xs mt-2">2030</span>
            <span className="text-xs font-bold">10,000,000</span>
          </div>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-4">Ambitious growth: 20,000 → 10,000,000 users by 2030</span>

                <div className="mb-8">
                  <h5 className="font-bold text-base mb-2 text-green-700 dark:text-green-300">Why will NexSq grow this fast?</h5>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-4 py-3 rounded-xl shadow text-base"><TrendingUp className="h-5 w-5" />Massive untapped market: 400M+ young Africans online by 2025.</div>
                    <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 px-4 py-3 rounded-xl shadow text-base"><Globe className="h-5 w-5" />Multi-platform launch (web, Android, iOS) for viral adoption.</div>
                    <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 px-4 py-3 rounded-xl shadow text-base"><Users className="h-5 w-5" />Influencer, merchant, and partner onboarding at scale.</div>
                    <div className="flex items-center gap-2 bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100 px-4 py-3 rounded-xl shadow text-base"><Award className="h-5 w-5" />Proven viral growth playbooks and referral incentives.</div>
                  </div>
                </div>
                
                {/* Revenue */}
      <h4 className="font-bold text-lg mb-4 text-blue-700 dark:text-blue-300">Projected Platform Revenue (2026-2030)</h4>
      <div className="w-full h-64 bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900 rounded-xl p-4 shadow-inner border border-blue-200 dark:border-blue-800 mb-4">
        <div className="flex h-full items-end justify-between gap-2">
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-400 to-indigo-300 dark:from-indigo-500 dark:to-indigo-400" style={{ height: '5%' }}></div>
            <span className="text-xs mt-2">2026</span>
            <span className="text-xs font-bold">$365K</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-green-400 to-green-300 dark:from-green-500 dark:to-green-400" style={{ height: '15%' }}></div>
            <span className="text-xs mt-2">2027</span>
            <span className="text-xs font-bold">$1.1M</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-500 dark:to-orange-400" style={{ height: '30%' }}></div>
            <span className="text-xs mt-2">2028</span>
            <span className="text-xs font-bold">$3.3M</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-500 dark:to-yellow-400" style={{ height: '60%' }}></div>
            <span className="text-xs mt-2">2029</span>
            <span className="text-xs font-bold">$9.9M</span>
          </div>
          <div className="flex flex-col-reverse items-center flex-1 h-full">
            <div className="w-full rounded-t-lg bg-gradient-to-t from-pink-400 to-pink-300 dark:from-pink-500 dark:to-pink-400" style={{ height: '100%' }}></div>
            <span className="text-xs mt-2">2030</span>
            <span className="text-xs font-bold">$29.6M</span>
          </div>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-4">Assumes 200 transactions/day at $5 each in 2026, with daily transactions tripling every year (200% annual growth).</span>
   
     <div className="mb-8">
                  <h5 className="font-bold text-base mb-2 text-green-700 dark:text-green-300">What drives this revenue?</h5>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-4 py-3 rounded-xl shadow text-base"><TrendingUp className="h-5 w-5" />Consistent daily transactions from a growing user base.</div>
                    <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 px-4 py-3 rounded-xl shadow text-base"><Globe className="h-5 w-5" />Diverse revenue streams: marketplace fees, subscriptions, digital services.</div>
                    <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 px-4 py-3 rounded-xl shadow text-base"><Users className="h-5 w-5" />Merchant and partner onboarding at scale.</div>
                    <div className="flex items-center gap-2 bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100 px-4 py-3 rounded-xl shadow text-base"><Award className="h-5 w-5" />Viral growth and referral incentives.</div>
                  </div>
                </div>
                <h3 className="font-bold text-2xl mb-4 text-blue-700 dark:text-blue-300">Why Invest in NexSq?</h3>
                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-4 py-3 rounded-xl shadow text-base"><TrendingUp className="h-5 w-5" />First-mover advantage in a high-growth digital market.</div>
                  <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 px-4 py-3 rounded-xl shadow text-base"><Globe className="h-5 w-5" />Scalable, multi-platform technology (web, Android, iOS).</div>
                  <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 px-4 py-3 rounded-xl shadow text-base"><Users className="h-5 w-5" />Strong founding team and Kingdom-minded mission.</div>
                  <div className="flex items-center gap-2 bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100 px-4 py-3 rounded-xl shadow text-base"><Award className="h-5 w-5" />Early traction: 200+ test users, ready for go-to-market.</div>
                  <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 px-4 py-3 rounded-xl shadow text-base"><Wallet className="h-5 w-5" />Clear path to revenue via marketplace, subscriptions, and digital services.</div>
                </div>
                <div className="mb-8">
                  <h3 className="font-bold text-xl mb-2 text-blue-700 dark:text-blue-300">Why this Valuation?</h3>
                  <ul className="list-disc list-inside mb-6 space-y-3">
                    <li>Significant development investment: fully functional web platform, Android and iOS versions.</li>
                    <li>Current user base: 200+ onboarded test users actively using and providing feedback.</li>
                    <li>Modern, scalable technology stack and unique positioning in the digital square/marketplace space.</li>
                  </ul>
                  <h3 className="font-bold text-xl mb-2 text-green-700 dark:text-green-300">What We Want to Achieve with This Investment</h3>
                  <ul className="list-disc list-inside mb-6 space-y-3">
                    <li>Go-to-market launch of NexSq across web, Android, and iOS.</li>
                    <li>Promote the platform to drive user adoption and engagement.</li>
                    <li>Attract merchants, vendors, and new users to build a vibrant ecosystem.</li>
                    <li>Expand marketing, partnerships, and support for rapid growth.</li>
                  </ul>
                  <div className="mt-8 flex flex-col items-start">
                    <a
                      href="/lovable-uploads/nexsq-pep-onepager.pdf"
                      download
                      className="inline-block bg-gradient-to-r from-green-500 to-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow hover:scale-105 transition-transform mb-2"
                    >
                      Download NexSq PEP One-Pager (PDF)
                    </a>
                    <span className="text-sm text-gray-500 dark:text-gray-400">For interested investors: Click to download our one-page pitch deck.</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {tab === 'foundation' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">NexSq Foundation</h2>
              <p className="text-lg text-gray-700 dark:text-gray-200 max-w-3xl mx-auto mb-8">
                As Kingdom-minded owners, our greatest impact will be measured by how we serve communities across nations. When NexSq generates revenue, the majority of our profits and proceeds will be dedicated to these initiatives:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-pink-500 bg-gradient-to-br from-pink-100 via-pink-50 to-white dark:from-pink-900 dark:via-pink-800 dark:to-gray-900">
                  <Heart className="h-8 w-8 text-pink-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Feeding Nations</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Supporting food security programs to ensure no one goes hungry.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-blue-900 dark:via-blue-800 dark:to-gray-900">
                  <BookOpen className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Sponsoring Students</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Providing scholarships and educational support at all levels.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-green-500 bg-gradient-to-br from-green-100 via-green-50 to-white dark:from-green-900 dark:via-green-800 dark:to-gray-900">
                  <Home className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Shelter & Housing</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Offering shelter and housing support to those in need.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-yellow-500 bg-gradient-to-br from-yellow-100 via-yellow-50 to-white dark:from-yellow-900 dark:via-yellow-800 dark:to-gray-900">
                  <Zap className="h-8 w-8 text-yellow-500 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Financial Pillar for Churches</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Supporting churches and faith-based organizations financially.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-purple-500 bg-gradient-to-br from-purple-100 via-purple-50 to-white dark:from-purple-900 dark:via-purple-800 dark:to-gray-900">
                  <Layers className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Wisdom & Wealth Building</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Investing in knowledge and wealth-building opportunities for communities.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-red-500 bg-gradient-to-br from-red-100 via-red-50 to-white dark:from-red-900 dark:via-red-800 dark:to-gray-900">
                  <UserCheck2 className="h-8 w-8 text-red-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Healthcare & Hospitals</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Building hospitals, healthcare facilities, and clearing hospital bills for the vulnerable.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-indigo-500 bg-gradient-to-br from-indigo-100 via-indigo-50 to-white dark:from-indigo-900 dark:via-indigo-800 dark:to-gray-900">
                  <Award className="h-8 w-8 text-indigo-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Altars & Temples</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">Constructing altars and temples in different nations to support spiritual growth and community.</p>
                </div>
              </div>
              <div className="flex mt-10">
                <span className="inline-block bg-gradient-to-r from-pink-500 to-yellow-400 text-white px-6 py-2 rounded-full font-bold text-lg shadow">Impacting Nations. Advancing the Kingdom.</span>
              </div>
            </Card>
          )}
          {tab === 'company' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0 text-left">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Company & Vision</h2>
              <div className="max-w-3xl mx-auto text-lg text-gray-700 dark:text-gray-200 leading-relaxed mb-6">
                <div className="flex flex-col mb-6">
                  <span className="block text-base font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-2">Our Massive Transformative Purpose</span>
                  <span className="relative inline-block px-6 py-3 rounded-xl font-bold text-lg md:text-xl text-purple-800 dark:text-purple-200 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900 shadow-md mb-2 border border-purple-200 dark:border-purple-800 text-left">
                    To unlock the entrepreneurial potential of underserved regions and the world by building the most inclusive digital square, where conversation, community, and commerce converge to create opportunity for the next generation.
                    <br />
                    <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">(Africa is our core, but our vision is global.)</span>
                  </span>
                </div>
                <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950 rounded-2xl p-6 shadow-inner border border-blue-100 dark:border-blue-900 mb-6">
                  <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-4 font-medium">
                    At NexSQ, we envision a thriving digital ecosystem where young Africans, regardless of background, borders, or bandwidth, can connect, collaborate, and commercialize their ideas. Our Massive Transformative Purpose is to build a future where access to opportunity is no longer a privilege, but a shared platform.
                  </p>
                  <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 font-medium">
                    We are not just creating a social network. We are shaping the world's next digital square, where voices rise, commerce flows, and communities build the future together.
                  </p>
                </div>
                <div className="mb-8">
                  <div className="bg-gradient-to-r from-yellow-100 via-orange-50 to-white dark:from-yellow-900 dark:via-orange-900 dark:to-gray-900 rounded-2xl p-6 shadow-inner border border-yellow-200 dark:border-yellow-800 flex flex-col mb-6">
                    <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300 mb-2 uppercase tracking-wider">Parent Company: GG Empire</span>
                    <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 font-medium mb-2 max-w-2xl">
                      NexSq is the flagship product of <b>GG Empire</b>, a pioneering digital innovation and impact company based in South Africa. GG Empire is dedicated to building platforms that fuse technology, entrepreneurship, and empowerment—igniting new possibilities for Africa and the world.
                    </p>
                    <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 font-medium mb-2 max-w-2xl">
                      With a portfolio spanning MindCoachConsulting.com, AmiraCollections.com, and 1VoiceSquare (now NexSq), GG Empire is on a mission to shape the future of digital opportunity, one bold idea at a time.
                    </p>
                    <a href="https://www.ggempire.co.za" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow hover:scale-105 transition-transform">Discover GG Empire</a>
                  </div>
                  <div className="bg-gradient-to-r from-gray-100 via-blue-50 to-white dark:from-gray-900 dark:via-blue-900 dark:to-gray-800 rounded-2xl p-6 shadow-inner border border-blue-200 dark:border-blue-800 flex flex-col">
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-300 mb-4 uppercase tracking-wider">Founders & Leadership</span>
                    <div className="w-full max-w-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center bg-white/80 dark:bg-[#232946] rounded-xl shadow p-4 border border-blue-100 dark:border-blue-800">
                        <div className="flex-shrink-0 w-16 h-16 bg-blue-200 dark:bg-blue-900 rounded-full flex items-center justify-center text-2xl font-bold text-blue-700 dark:text-blue-200 mr-4">
                          TS
                        </div>
                        <div>
                          <div className="font-bold text-lg text-gray-900 dark:text-white">Tonito Samuel</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">Founder & Exec VP</div>
                        </div>
                      </div>
                      <div className="flex items-center bg-white/80 dark:bg-[#232946] rounded-xl shadow p-4 border border-blue-100 dark:border-blue-800">
                        <div className="flex-shrink-0 w-16 h-16 bg-pink-200 dark:bg-pink-900 rounded-full flex items-center justify-center text-2xl font-bold text-pink-700 dark:text-pink-200 mr-4">
                          LO
                        </div>
                        <div>
                          <div className="font-bold text-lg text-gray-900 dark:text-white">Lydia Olose</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">Exec Admin / CEO, Amira Luxury Collection</div>
                        </div>
                      </div>
                      <div className="flex items-center bg-white/80 dark:bg-[#232946] rounded-xl shadow p-4 border border-blue-100 dark:border-blue-800">
                        <div className="flex-shrink-0 w-16 h-16 bg-green-200 dark:bg-green-900 rounded-full flex items-center justify-center text-2xl font-bold text-green-700 dark:text-green-200 mr-4">
                          GO
                        </div>
                        <div>
                          <div className="font-bold text-lg text-gray-900 dark:text-white">George Ottobong</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">Director of Logistics</div>
                        </div>
                      </div>
                      <div className="flex items-center bg-white/80 dark:bg-[#232946] rounded-xl shadow p-4 border border-blue-100 dark:border-blue-800">
                        <div className="flex-shrink-0 w-16 h-16 bg-purple-200 dark:bg-purple-900 rounded-full flex items-center justify-center text-2xl font-bold text-purple-700 dark:text-purple-200 mr-4">
                          OO
                        </div>
                        <div>
                          <div className="font-bold text-lg text-gray-900 dark:text-white">Oluwakoyejo Oluwatosin</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">Director Business Development & Head of Strategy</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <span className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full font-bold text-lg shadow">NexSq: The Next Generation Digital Square</span>
                </div>
              </div>
            </Card>
          )}
          {tab === 'platform' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0 text-left">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">What is NexSq?</h2>
              <p className="text-lg text-gray-700 dark:text-gray-200 max-w-3xl mx-auto mb-6 text-left">
                <span className="block text-xl font-bold text-blue-700 dark:text-blue-300 mb-2 text-left">Where conversation and community meets commerce.</span>
                NexSq is a global digital square for communities, creators, and entrepreneurs. We connect people, ideas, and opportunities, empowering the next generation to build, bond, trade, and thrive.
              </p>
              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="flex items-start gap-4">
                  <Globe className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">Global Community</h3>
                    <p className="text-gray-600 dark:text-gray-300">Connect with users worldwide, break down barriers, and access new markets.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Users className="h-8 w-8 text-green-600 dark:text-green-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">Empowerment & Monetization</h3>
                    <p className="text-gray-600 dark:text-gray-300">Monetize your content, launch your business, and access tools for growth.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Zap className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">Futuristic Innovation</h3>
                    <p className="text-gray-600 dark:text-gray-300">Experience next-gen features, seamless commerce, and a platform that evolves with you.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Heart className="h-8 w-8 text-pink-600 dark:text-pink-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">Community & Collaboration</h3>
                    <p className="text-gray-600 dark:text-gray-300">Join a supportive network where your ideas matter and your impact is amplified.</p>
                  </div>
                </div>
              </div>
              <div className="mt-10">
                <Button 
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-bold rounded-full shadow-lg"
                >
                  Get Started Today
                </Button>
              </div>
            </Card>
          )}
          {tab === 'impact' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0 text-left">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Impact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-blue-900 dark:via-blue-800 dark:to-gray-900">
                  <BookOpen className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Empowering Entrepreneurs</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">We empower entrepreneurs, especially in underserved regions, with digital stores and a powerful marketplace (My Store and Square Page) that lets anyone sell across borders, reach new markets, and grow their business.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-green-500 bg-gradient-to-br from-green-100 via-green-50 to-white dark:from-green-900 dark:via-green-800 dark:to-gray-900">
                  <Layers className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Economic Inclusion</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">We break down cross-border barriers, promote intra-regional trade, and foster economic activity for all.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-purple-500 bg-gradient-to-br from-purple-100 via-purple-50 to-white dark:from-purple-900 dark:via-purple-800 dark:to-gray-900">
                  <UserCheck2 className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Job Creation & Micro-Income</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">We enable freelancers, artisans, and knowledge workers to monetize their skills and create new income streams.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-indigo-500 bg-gradient-to-br from-indigo-100 via-indigo-50 to-white dark:from-indigo-900 dark:via-indigo-800 dark:to-gray-900">
                  <Award className="h-8 w-8 text-indigo-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Youth Innovation & Leadership</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">We serve as a launchpad for young creators and leaders to express, build, and grow.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-cyan-500 bg-gradient-to-br from-cyan-100 via-cyan-50 to-white dark:from-cyan-900 dark:via-cyan-800 dark:to-gray-900">
                  <BarChart2 className="h-8 w-8 text-cyan-600 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Data-Driven Community Development</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">We provide dashboards and insights to support evidence-based decisions for partners and communities.</p>
                </div>
                <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-cyan-700 bg-gradient-to-br from-cyan-200 via-cyan-100 to-white dark:from-cyan-800 dark:via-cyan-700 dark:to-gray-900">
                  <Wallet className="h-8 w-8 text-cyan-700 mb-2" />
                  <h3 className="font-bold text-lg mb-1 text-center">Peer-to-Peer & Digital Wallet Systems</h3>
                  <p className="text-gray-700 dark:text-gray-200 text-center">NexSq features a secure peer-to-peer wallet and digital wallet system, enabling users to send, receive, and manage funds instantly across borders. This empowers commerce, micro-payments, and financial inclusion for all.</p>
                </div>
              </div>
              <div className="mt-10">
                <h3 className="text-2xl font-extrabold mb-6 text-blue-700 dark:text-blue-300 tracking-tight text-left">How We Measure Impact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-blue-500 hover:scale-105 transition-transform">
                    <Users className="h-8 w-8 text-blue-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Entrepreneurs & Creators Empowered</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Tracking the number of people who launch, grow, or monetize on NexSq.</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-green-500 hover:scale-105 transition-transform">
                    <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Jobs & Micro-Income Created</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Measuring new jobs, gigs, and income opportunities generated by the platform.</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-purple-500 hover:scale-105 transition-transform">
                    <Globe className="h-8 w-8 text-purple-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Cross-Border Collaboration</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Tracking transactions, partnerships, and projects across regions and countries.</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-pink-500 hover:scale-105 transition-transform">
                    <Heart className="h-8 w-8 text-pink-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Community Engagement</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Measuring active participation, knowledge sharing, and meaningful connections.</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-yellow-500 hover:scale-105 transition-transform">
                    <BookOpen className="h-8 w-8 text-yellow-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Digital Literacy & Inclusion</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Tracking digital skills, access, and inclusion for underserved communities.</div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-indigo-500 hover:scale-105 transition-transform">
                    <Award className="h-8 w-8 text-indigo-600 mb-2" />
                    <div className="font-bold text-lg mb-1">Partnerships & Ecosystem</div>
                    <div className="text-gray-600 dark:text-gray-300 text-base">Measuring collaborations with NGOs, governments, and ecosystem partners.</div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {tab === 'sdgs' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0 text-left">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">UN Sustainable Development Goals (SDGs)</h2>
              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="flex items-start gap-4">
                  <Award className="h-8 w-8 text-green-600 dark:text-green-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">#1 No Poverty</h3>
                    <p className="text-gray-600 dark:text-gray-300">Income through entrepreneurship and digital opportunity.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">#8 Decent Work & Economic Growth</h3>
                    <p className="text-gray-600 dark:text-gray-300">Job creation, digital skills, and economic empowerment.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Layers className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">#9 Industry, Innovation, Infrastructure</h3>
                    <p className="text-gray-600 dark:text-gray-300">Building digital platforms and infrastructure for the future.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <UserCheck2 className="h-8 w-8 text-pink-600 dark:text-pink-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">#10 Reduced Inequalities</h3>
                    <p className="text-gray-600 dark:text-gray-300">Inclusive access and opportunity for all.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Globe2 className="h-8 w-8 text-yellow-600 dark:text-yellow-300" />
                  <div>
                    <h3 className="font-bold text-lg mb-1">#17 Partnerships for the Goals</h3>
                    <p className="text-gray-600 dark:text-gray-300">Cross-country collaboration and global partnerships.</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <footer className="hidden lg:block bg-white dark:bg-[#161616] border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="/about" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">About</a></li>
                <li><a href="/careers" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><a href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Terms</a></li>
                <li><a href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</a></li>
                <li><a href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cookies</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Help Center</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Developers</h3>
              <ul className="space-y-2">
                <li><a href="/developers" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">API</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Blog</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Community</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} NexSq. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;