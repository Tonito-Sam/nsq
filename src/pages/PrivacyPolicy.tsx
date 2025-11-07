import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview', icon: <Shield className="h-5 w-5 mr-2" /> },
  { key: 'collection', label: 'Data Collection', icon: <Database className="h-5 w-5 mr-2" /> },
  { key: 'usage', label: 'Data Usage', icon: <Eye className="h-5 w-5 mr-2" /> },
  { key: 'rights', label: 'Your Rights', icon: <UserCheck className="h-5 w-5 mr-2" /> },
];

const PrivacyPolicy = () => {
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
            NexSQ Privacy Policy
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-200 max-w-2xl mx-auto mb-4 font-medium">
            Effective Date: 20/10/2025 — Last Updated: 20/10/2025
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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Privacy Policy Overview</h2>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
                <div className="flex items-center mb-4">
                  <Shield className="h-6 w-6 text-blue-600 mr-3" />
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">Age Requirements & Parental Consent</h3>
                </div>
                <p className="text-blue-700 dark:text-blue-200 text-lg">
                  Users must be at least 13 years old. For users under 18, parental consent is required. 
                  We implement additional protections for younger users in compliance with COPPA and international standards.
                </p>
              </div>

              <div className="space-y-6 text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                <div className="space-y-6 text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                  <p>
                    GG Empire (Pty) Ltd ("NexSQ," "we," "our," "us") operates the NexSQ platform (the "App" and "Website" at https://nexsq.com). This Privacy Policy explains how we collect, use, disclose, and protect your personal information. By using NexSQ, you agree to the terms of this Privacy Policy.
                  </p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">1. Privacy Policy Overview</h3>
                  <p>
                    At NexSQ, we are committed to:
                  </p>
                  <ul className="list-disc pl-6">
                    <li>Transparency: Clearly explaining what data we collect and why.</li>
                    <li>User Control: Allowing you to manage your privacy and account settings.</li>
                    <li>Security: Protecting your data with industry-standard safeguards.</li>
                    <li>Compliance: Adhering to GDPR, POPIA, COPPA, CCPA, and other international privacy laws.</li>
                  </ul>

                  <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl mt-4">
                    <h4 className="font-bold text-lg mb-3">Data Protection Officer (DPO)</h4>
                    <p><strong>Email:</strong> privacy@nexsq.com</p>
                    <p><strong>Address:</strong> 56 Park Lodge, 268 Second Road, Northwold, Johannesburg, South Africa</p>
                    <p><strong>Response Time:</strong> Within 30 days</p>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">2. Age Requirements & Parental Consent</h3>
                  <p>Users must be at least 13 years old to use NexSQ. Users under 18 require parental/guardian consent.</p>
                  <p>Additional safeguards for minors include:</p>
                  <ul className="list-disc pl-6">
                    <li>Limited data collection</li>
                    <li>Enhanced privacy defaults</li>
                    <li>Restricted commercial data use</li>
                    <li>Parental verification</li>
                  </ul>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">3. Information We Collect</h3>
                  <h4 className="font-semibold mt-3">a) Information You Provide</h4>
                  <ul className="list-disc pl-6">
                    <li>Account Info: Name, email, username, password</li>
                    <li>Profile Data: Bio, location, profile picture, interests</li>
                    <li>Content: Posts, comments, messages, media uploads</li>
                    <li>Payment Info: Wallet, transactions, purchases</li>
                    <li>Verification: ID documents for compliance/security</li>
                  </ul>

                  <h4 className="font-semibold mt-3">b) Automatically Collected</h4>
                  <ul className="list-disc pl-6">
                    <li>Device Info: Model, OS, browser, IP address</li>
                    <li>Usage Data: App interactions, searches, clicks</li>
                    <li>Location Data: With permission, approximate or precise</li>
                    <li>Cookies & Tracking: Session data, preferences, analytics</li>
                    <li>Performance Data: Crashes, errors, response times</li>
                  </ul>

                  <h4 className="font-semibold mt-3">c) Third-Party Sources</h4>
                  <ul className="list-disc pl-6">
                    <li>Social Logins: Data from connected accounts</li>
                    <li>Partners: Business partners, shipping providers, payment processors</li>
                    <li>Public Sources: Publicly available information</li>
                    <li>Analytics Providers: Aggregated usage statistics</li>
                  </ul>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">4. How We Use Your Data</h3>
                  <h4 className="font-semibold mt-3">Core Services</h4>
                  <ul className="list-disc pl-6">
                    <li>Provide and maintain NexSQ services</li>
                    <li>Enable accounts and authentication</li>
                    <li>Facilitate content sharing, communities, and marketplace transactions</li>
                    <li>Process payments and wallet transactions</li>
                    <li>Provide customer support</li>
                  </ul>

                  <h4 className="font-semibold mt-3">Personalization & Recommendations</h4>
                  <ul className="list-disc pl-6">
                    <li>Customize feeds, connections, and community suggestions</li>
                    <li>Offer relevant content and responsible advertising</li>
                  </ul>

                  <h4 className="font-semibold mt-3">Safety & Security</h4>
                  <ul className="list-disc pl-6">
                    <li>Detect fraud, abuse, and prohibited content</li>
                    <li>Enforce community guidelines</li>
                    <li>Verify identities for trust and compliance</li>
                  </ul>

                  <h4 className="font-semibold mt-3">Analytics & Improvement</h4>
                  <ul className="list-disc pl-6">
                    <li>Analyze app performance and usage trends</li>
                    <li>Develop and test new features (AI, translations, trend dashboards)</li>
                    <li>Generate anonymized research insights</li>
                  </ul>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">5. Legal Basis for Processing</h3>
                  <ul className="list-disc pl-6">
                    <li>Contract: Services you requested</li>
                    <li>Legitimate Interest: Security, analytics, app improvement</li>
                    <li>Consent: Marketing, cookies, optional features</li>
                    <li>Legal Obligation: Compliance with laws/regulations</li>
                  </ul>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">6. Data Retention</h3>
                  <ul className="list-disc pl-6">
                    <li>Account Data: Until deletion</li>
                    <li>Financial Records: 7 years for compliance</li>
                    <li>Support Tickets: 3 years</li>
                    <li>Analytics Data: Anonymized after 2 years</li>
                  </ul>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">7. Your Privacy Rights</h3>
                  <p>Access, Rectification, Deletion, Portability, Restriction/Objection, Withdraw Consent.</p>
                  <p>Exercise rights via in-app privacy settings or email: <strong>privacy@nexsq.com</strong> (verification may be required). Response: Within 30 days.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">8. International Data Transfers</h3>
                  <p>Data may be transferred outside your country. Safeguards include standard contractual clauses, adequacy decisions, encryption, and user consent.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">9. Children’s Privacy</h3>
                  <p>NexSQ does not knowingly collect data from children under 13. Any such data will be deleted immediately.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">10. Data Security</h3>
                  <p>Encryption (SSL/TLS) in transit, encrypted storage for sensitive data, access controls, monitoring, and audits per industry-standard practices.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">11. Third-Party Services</h3>
                  <p>Analytics: Google Firebase, AI insights. Payment Processors: Stripe, PayPal, local gateways. Logistics Partners. AI content moderation services.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">12. Updates to This Policy</h3>
                  <p>This policy is posted at <a href="https://nexsq.com/privacy-policy" className="text-blue-600">https://nexsq.com/privacy-policy</a>. Effective date will be updated when policy changes.</p>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">13. Contact & Complaints</h3>
                  <p>Data Protection Officer: <strong>privacy@nexsq.com</strong></p>
                  <p>Local Authorities: Contact your local data protection authority. In South Africa: Information Regulator.</p>
                </div>
              </div>
            </Card>
          )}

          {tab === 'collection' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Data Collection</h2>
              
              <div className="space-y-8">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Information You Provide</h3>
                  <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                    <li>• <strong>Account Information:</strong> Name, email, username, password</li>
                    <li>• <strong>Profile Data:</strong> Bio, location, profile picture, interests</li>
                    <li>• <strong>Content:</strong> Posts, comments, messages, media uploads</li>
                    <li>• <strong>Payment Info:</strong> Financial details for wallet and transactions</li>
                    <li>• <strong>Verification:</strong> ID documents for security and compliance</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Automatically Collected</h3>
                  <ul className="space-y-2 text-green-700 dark:text-green-300">
                    <li>• <strong>Usage Data:</strong> How you interact with our platform</li>
                    <li>• <strong>Device Info:</strong> Device type, OS, browser, IP address</li>
                    <li>• <strong>Location:</strong> General location (with permission)</li>
                    <li>• <strong>Cookies:</strong> Session data, preferences, analytics</li>
                    <li>• <strong>Performance:</strong> App crashes, response times, errors</li>
                  </ul>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">Third-Party Sources</h3>
                  <ul className="space-y-2 text-purple-700 dark:text-purple-300">
                    <li>• <strong>Social Logins:</strong> Data from connected social accounts</li>
                    <li>• <strong>Partners:</strong> Information from business partners</li>
                    <li>• <strong>Public Sources:</strong> Publicly available information</li>
                    <li>• <strong>Analytics:</strong> Aggregated usage statistics</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Special Protections for Minors</h3>
                  <p className="text-yellow-700 dark:text-yellow-300 mb-3">
                    For users under 18, we implement additional safeguards:
                  </p>
                  <ul className="space-y-2 text-yellow-700 dark:text-yellow-300">
                    <li>• Limited data collection and processing</li>
                    <li>• Enhanced privacy settings by default</li>
                    <li>• Parental consent verification processes</li>
                    <li>• Restricted commercial data usage</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {tab === 'usage' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">How We Use Your Data</h2>
              
              <div className="space-y-8">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-200 mb-4">Core Platform Services</h3>
                  <ul className="space-y-2 text-indigo-700 dark:text-indigo-300">
                    <li>• Provide and maintain NexSq services</li>
                    <li>• Enable user accounts and authentication</li>
                    <li>• Facilitate content sharing and social features</li>
                    <li>• Process payments and wallet transactions</li>
                    <li>• Provide customer support</li>
                  </ul>
                </div>

                <div className="bg-teal-50 dark:bg-teal-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-teal-800 dark:text-teal-200 mb-4">Personalization & Recommendations</h3>
                  <ul className="space-y-2 text-teal-700 dark:text-teal-300">
                    <li>• Customize your feed and content recommendations</li>
                    <li>• Suggest connections and communities</li>
                    <li>• Provide relevant advertising</li>
                    <li>• Improve user experience</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">Safety & Security</h3>
                  <ul className="space-y-2 text-red-700 dark:text-red-300">
                    <li>• Detect and prevent fraud and abuse</li>
                    <li>• Enforce community guidelines and terms</li>
                    <li>• Verify user identity when required</li>
                    <li>• Protect against security threats</li>
                  </ul>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4">Analytics & Improvement</h3>
                  <ul className="space-y-2 text-orange-700 dark:text-orange-300">
                    <li>• Analyze platform usage and performance</li>
                    <li>• Develop new features and services</li>
                    <li>• Conduct research and testing</li>
                    <li>• Generate anonymized insights</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Legal Basis for Processing</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">We process your data based on:</p>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• <strong>Contract:</strong> To provide services you've requested</li>
                    <li>• <strong>Legitimate Interest:</strong> For security, analytics, and improvements</li>
                    <li>• <strong>Consent:</strong> For marketing and optional features</li>
                    <li>• <strong>Legal Obligation:</strong> To comply with applicable laws</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {tab === 'rights' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Your Privacy Rights</h2>
              
              <div className="space-y-8">
                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Access & Control</h3>
                  <ul className="space-y-2 text-green-700 dark:text-green-300">
                    <li>• <strong>Access:</strong> Request a copy of your personal data</li>
                    <li>• <strong>Rectification:</strong> Correct inaccurate information</li>
                    <li>• <strong>Deletion:</strong> Request deletion of your data</li>
                    <li>• <strong>Portability:</strong> Export your data in a usable format</li>
                    <li>• <strong>Restriction:</strong> Limit how we process your data</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Privacy Settings</h3>
                  <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                    <li>• Control who can see your profile and content</li>
                    <li>• Manage data sharing preferences</li>
                    <li>• Opt out of personalized advertising</li>
                    <li>• Control notifications and communications</li>
                  </ul>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">How to Exercise Your Rights</h3>
                  <div className="text-purple-700 dark:text-purple-300 space-y-3">
                    <p><strong>Online:</strong> Use privacy settings in your account</p>
                    <p><strong>Email:</strong> Contact privacy@nexsq.com</p>
                    <p><strong>Response Time:</strong> Within 30 days</p>
                    <p><strong>Verification:</strong> We may need to verify your identity</p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Data Retention</h3>
                  <ul className="space-y-2 text-yellow-700 dark:text-yellow-300">
                    <li>• Account data: Until account deletion</li>
                    <li>• Financial records: 7 years for compliance</li>
                    <li>• Support tickets: 3 years</li>
                    <li>• Analytics data: Anonymized after 2 years</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">International Transfers</h3>
                  <p className="text-red-700 dark:text-red-300 mb-3">
                    As a global platform, we may transfer data internationally. We ensure adequate protection through:
                  </p>
                  <ul className="space-y-2 text-red-700 dark:text-red-300">
                    <li>• Standard contractual clauses</li>
                    <li>• Adequacy decisions</li>
                    <li>• Appropriate safeguards</li>
                    <li>• User consent where required</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Contact & Complaints</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">
                    If you have concerns about our privacy practices:
                  </p>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• Contact our Data Protection Officer: privacy@nexsq.com</li>
                    <li>• File a complaint with your local data protection authority</li>
                    <li>• In South Africa: Contact the Information Regulator</li>
                    <li>Contact info for the South African Information Regulator:</li>
                    <li>Website: https://www.justice.gov.za/inforeg/</li>
                    <li>Email: inforeg@justice.gov.za</li>
                    <li>Phone: +27 (0)12 406 4818</li>
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

export default PrivacyPolicy;
