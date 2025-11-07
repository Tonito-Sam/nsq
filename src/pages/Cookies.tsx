import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Cookie, Settings, Target, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview', icon: <Cookie className="h-5 w-5 mr-2" /> },
  { key: 'types', label: 'Cookie Types', icon: <Settings className="h-5 w-5 mr-2" /> },
  { key: 'manage', label: 'Manage Cookies', icon: <Shield className="h-5 w-5 mr-2" /> },
  { key: 'third-party', label: 'Third-Party', icon: <Target className="h-5 w-5 mr-2" /> },
];

const Cookies = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#e0e7ff] to-[#f0fdfa] dark:from-[#18181b] dark:via-[#312e81] dark:to-[#0f172a]">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-12 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
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
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            Cookie Policy
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-200 max-w-2xl mx-auto mb-4 font-medium">
            How We Use Cookies and Similar Technologies
          </p>
          <div className="flex justify-center gap-2 mt-8 mb-4 flex-wrap">
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

        <div className="mb-10">
          {tab === 'overview' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Cookie Policy Overview</h2>
              
              <div className="space-y-6 text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                <p>
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                </p>
                
                <p>
                  This Cookie Policy explains how NexSq uses cookies and similar technologies to provide, 
                  improve, and protect our services. We are committed to transparency about our data practices.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">What are Cookies?</h3>
                  <p className="text-blue-700 dark:text-blue-200">
                    Cookies are small text files stored on your device when you visit websites. They help websites 
                    remember your preferences, keep you logged in, and provide personalized experiences.
                  </p>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Why We Use Cookies</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-green-800 dark:text-green-200">Essential Functions</h4>
                    <p className="text-green-700 dark:text-green-300">Keep you logged in, remember preferences, and ensure security.</p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-purple-800 dark:text-purple-200">Performance</h4>
                    <p className="text-purple-700 dark:text-purple-300">Monitor site performance and identify areas for improvement.</p>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-orange-800 dark:text-orange-200">Personalization</h4>
                    <p className="text-orange-700 dark:text-orange-300">Customize content and recommendations based on your interests.</p>
                  </div>
                  
                  <div className="bg-teal-50 dark:bg-teal-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-teal-800 dark:text-teal-200">Analytics</h4>
                    <p className="text-teal-700 dark:text-teal-300">Understand how users interact with our platform.</p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mt-8">
                  <h4 className="font-bold text-lg mb-3 text-yellow-800 dark:text-yellow-200">Your Choices</h4>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    You can control cookie settings through your browser or our preference center. 
                    Some cookies are essential for the platform to function properly.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {tab === 'types' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Types of Cookies We Use</h2>
              
              <div className="space-y-8">
                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl border-l-4 border-red-500">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">Essential Cookies (Required)</h3>
                  <p className="text-red-700 dark:text-red-300 mb-3">
                    These cookies are necessary for the website to function and cannot be disabled.
                  </p>
                  <ul className="space-y-2 text-red-700 dark:text-red-300">
                    <li>• <strong>Authentication:</strong> Keep you logged in securely</li>
                    <li>• <strong>Security:</strong> Protect against fraud and abuse</li>
                    <li>• <strong>Preferences:</strong> Remember your language and settings</li>
                    <li>• <strong>Load Balancing:</strong> Distribute traffic efficiently</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl border-l-4 border-blue-500">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Performance Cookies (Optional)</h3>
                  <p className="text-blue-700 dark:text-blue-300 mb-3">
                    Help us understand how visitors interact with our website.
                  </p>
                  <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                    <li>• <strong>Analytics:</strong> Google Analytics, internal metrics</li>
                    <li>• <strong>Performance:</strong> Page load times, error tracking</li>
                    <li>• <strong>Usage:</strong> Most popular content and features</li>
                    <li>• <strong>Testing:</strong> A/B testing for improvements</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl border-l-4 border-green-500">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Functional Cookies (Optional)</h3>
                  <p className="text-green-700 dark:text-green-300 mb-3">
                    Enable enhanced functionality and personalization.
                  </p>
                  <ul className="space-y-2 text-green-700 dark:text-green-300">
                    <li>• <strong>Personalization:</strong> Content recommendations</li>
                    <li>• <strong>Social Features:</strong> Social media integration</li>
                    <li>• <strong>Chat Support:</strong> Live chat functionality</li>
                    <li>• <strong>Video:</strong> Video player preferences</li>
                  </ul>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl border-l-4 border-purple-500">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">Marketing Cookies (Optional)</h3>
                  <p className="text-purple-700 dark:text-purple-300 mb-3">
                    Used to deliver relevant advertisements and measure campaign effectiveness.
                  </p>
                  <ul className="space-y-2 text-purple-700 dark:text-purple-300">
                    <li>• <strong>Advertising:</strong> Display relevant ads</li>
                    <li>• <strong>Retargeting:</strong> Show ads on other websites</li>
                    <li>• <strong>Social Media:</strong> Facebook, Twitter advertising</li>
                    <li>• <strong>Analytics:</strong> Measure ad performance</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Cookie Duration</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Session Cookies</h4>
                      <p className="text-gray-700 dark:text-gray-300">Deleted when you close your browser</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Persistent Cookies</h4>
                      <p className="text-gray-700 dark:text-gray-300">Remain for a specified period (up to 2 years)</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {tab === 'manage' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Manage Your Cookie Preferences</h2>
              
              <div className="space-y-8">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">NexSq Cookie Settings</h3>
                  <p className="text-blue-700 dark:text-blue-300 mb-4">
                    Use our preference center to control which cookies you accept:
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Open Cookie Preferences
                  </Button>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Browser Settings</h3>
                  <p className="text-green-700 dark:text-green-300 mb-4">
                    You can also control cookies through your browser settings:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 text-green-700 dark:text-green-300">
                    <div>
                      <h4 className="font-semibold mb-2">Chrome</h4>
                      <p>Settings → Privacy and Security → Cookies</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Firefox</h4>
                      <p>Options → Privacy & Security → Cookies</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Safari</h4>
                      <p>Preferences → Privacy → Cookies</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Edge</h4>
                      <p>Settings → Cookies and Site Permissions</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Impact of Disabling Cookies</h3>
                  <ul className="space-y-2 text-yellow-700 dark:text-yellow-300">
                    <li>• You may need to log in repeatedly</li>
                    <li>• Personalized features may not work</li>
                    <li>• Some parts of the site may not function properly</li>
                    <li>• You may see less relevant content</li>
                  </ul>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">Mobile Apps</h3>
                  <p className="text-purple-700 dark:text-purple-300 mb-3">
                    Mobile apps use similar technologies:
                  </p>
                  <ul className="space-y-2 text-purple-700 dark:text-purple-300">
                    <li>• <strong>App Preferences:</strong> Control data collection in app settings</li>
                    <li>• <strong>Device Settings:</strong> Manage advertising preferences</li>
                    <li>• <strong>Opt-out:</strong> Use platform-specific opt-out tools</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Additional Resources</h3>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• <a href="https://allaboutcookies.org" className="text-blue-600 hover:underline">All About Cookies</a></li>
                    <li>• <a href="https://youronlinechoices.eu" className="text-blue-600 hover:underline">Your Online Choices (EU)</a></li>
                    <li>• <a href="https://optout.networkadvertising.org" className="text-blue-600 hover:underline">Network Advertising Initiative (US)</a></li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {tab === 'third-party' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Third-Party Cookies & Services</h2>
              
              <div className="space-y-8">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Analytics Services</h3>
                  <div className="space-y-4 text-blue-700 dark:text-blue-300">
                    <div>
                      <h4 className="font-semibold">Google Analytics</h4>
                      <p>Web analytics service that tracks user behavior</p>
                      <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                    <div>
                      <h4 className="font-semibold">Mixpanel</h4>
                      <p>Product analytics for user engagement tracking</p>
                      <a href="https://mixpanel.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Advertising Partners</h3>
                  <div className="space-y-4 text-green-700 dark:text-green-300">
                    <div>
                      <h4 className="font-semibold">Google Ads</h4>
                      <p>Display targeted advertisements</p>
                      <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                    <div>
                      <h4 className="font-semibold">Facebook Ads</h4>
                      <p>Social media advertising and retargeting</p>
                      <a href="https://facebook.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">Social Media Integration</h3>
                  <div className="space-y-4 text-purple-700 dark:text-purple-300">
                    <div>
                      <h4 className="font-semibold">Social Login</h4>
                      <p>Login with Google, Facebook, or other social accounts</p>
                    </div>
                    <div>
                      <h4 className="font-semibold">Share Buttons</h4>
                      <p>Share content on social media platforms</p>
                    </div>
                    <div>
                      <h4 className="font-semibold">Embedded Content</h4>
                      <p>YouTube videos, Twitter feeds, etc.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4">Support & Communication</h3>
                  <div className="space-y-4 text-orange-700 dark:text-orange-300">
                    <div>
                      <h4 className="font-semibold">Intercom</h4>
                      <p>Customer support chat system</p>
                      <a href="https://intercom.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                    <div>
                      <h4 className="font-semibold">Zendesk</h4>
                      <p>Help desk and support ticketing</p>
                      <a href="https://zendesk.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">Payment Processing</h3>
                  <div className="space-y-4 text-red-700 dark:text-red-300">
                    <div>
                      <h4 className="font-semibold">Stripe</h4>
                      <p>Payment processing for transactions</p>
                      <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                    <div>
                      <h4 className="font-semibold">PayPal</h4>
                      <p>Alternative payment processing</p>
                      <a href="https://paypal.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Managing Third-Party Cookies</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Third-party services have their own privacy policies and cookie controls. 
                    You can opt out of many advertising cookies through:
                  </p>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• Industry opt-out pages (NAI, DAA)</li>
                    <li>• Individual service privacy settings</li>
                    <li>• Browser privacy extensions</li>
                    <li>• Our cookie preference center</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
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
                <li><a href="/privacy-policy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</a></li>
                <li><a href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cookies</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="/help" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Help Center</a></li>
                <li><a href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Developers</h3>
              <ul className="space-y-2">
                <li><a href="/api" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">API</a></li>
                <li><a href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="/blog" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Blog</a></li>
                <li><a href="/community" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Community</a></li>
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

export default Cookies;
