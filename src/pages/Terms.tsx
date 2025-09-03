import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileText, Shield, Users, AlertTriangle, Gavel, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview', icon: <FileText className="h-5 w-5 mr-2" /> },
  { key: 'usage', label: 'Usage Rules', icon: <Shield className="h-5 w-5 mr-2" /> },
  { key: 'content', label: 'Content & IP', icon: <Users className="h-5 w-5 mr-2" /> },
  { key: 'liability', label: 'Liability & Disputes', icon: <Gavel className="h-5 w-5 mr-2" /> },
  { key: 'childsafety', label: 'Child Safety', icon: <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" /> },
];

const Terms = () => {
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
            Terms of Service
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-200 max-w-2xl mx-auto mb-4 font-medium">
            Legal Terms & Conditions for NexSq Platform
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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Terms of Service Overview</h2>
              
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200">Age Requirement</h3>
                </div>
                <p className="text-red-700 dark:text-red-200 text-lg font-semibold">
                  You must be at least 13 years old to use NexSq. Users under 18 require parental consent.
                </p>
              </div>

              <div className="space-y-6 text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                <p>
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                </p>
                
                <p>
                  Welcome to NexSq, operated by GG Empire (Pty) Ltd, a South African company. These Terms of Service ("Terms") govern your use of our platform, services, and applications.
                </p>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Key Points</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-blue-800 dark:text-blue-200">Acceptance</h4>
                    <p className="text-blue-700 dark:text-blue-300">By using NexSq, you agree to these terms and our Privacy Policy.</p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-green-800 dark:text-green-200">Global Platform</h4>
                    <p className="text-green-700 dark:text-green-300">NexSq operates globally while complying with local laws and regulations.</p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-purple-800 dark:text-purple-200">Commercial Use</h4>
                    <p className="text-purple-700 dark:text-purple-300">Users may engage in commerce, but must comply with applicable laws and our guidelines.</p>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                    <h4 className="font-bold text-lg mb-2 text-orange-800 dark:text-orange-200">Modifications</h4>
                    <p className="text-orange-700 dark:text-orange-300">We may update these terms with 30 days notice to users.</p>
                  </div>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl mt-8">
                  <h4 className="font-bold text-lg mb-3">Contact Information</h4>
                  <p><strong>Company:</strong> GG Empire (Pty) Ltd</p>
                  <p><strong>Jurisdiction:</strong> South Africa</p>
                  <p><strong>Email:</strong> legal@nexsq.com</p>
                  <p><strong>Address:</strong> [Company Address], South Africa</p>
                </div>
              </div>
            </Card>
          )}

          {tab === 'childsafety' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">NexSQ Child Safety Standards</h2>
              <div className="space-y-8 text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-6 rounded-xl mb-6">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">At NexSQ, the safety and well-being of minors using our platform is our highest priority. Our platform is designed to foster safe, meaningful, and respectful interactions while actively preventing harmful or inappropriate behavior.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">Who Can Use NexSQ?</h3>
                    <ul className="list-disc ml-5 text-blue-700 dark:text-blue-300 space-y-1">
                      <li><strong>Minimum Age:</strong> NexSQ is intended for individuals 13 years and older.</li>
                      <li><strong>Parental Supervision:</strong> Users under 18 years of age must have parental or guardian supervision when using the platform. We encourage parents and guardians to actively engage with their children’s online activity.</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-green-800 dark:text-green-200 mb-2">Content Moderation & Filtering</h3>
                    <ul className="list-disc ml-5 text-green-700 dark:text-green-300 space-y-1">
                      <li>Automated detection systems and human moderators actively monitor and remove inappropriate, harmful, or explicit content.</li>
                      <li>Prohibited content includes nudity, sexual content, hate speech, harassment, violence, exploitation, or any material that may endanger minors.</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-2">Account Protection & Privacy</h3>
                    <ul className="list-disc ml-5 text-purple-700 dark:text-purple-300 space-y-1">
                      <li>We follow strict privacy protocols and comply with international child safety and data protection regulations.</li>
                      <li>Location sharing, sensitive personal data, and private communication features are protected and controlled.</li>
                    </ul>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-red-800 dark:text-red-200 mb-2">Reporting, Blocking & Safety Tools</h3>
                    <ul className="list-disc ml-5 text-red-700 dark:text-red-300 space-y-1">
                      <li>All users can report inappropriate content, harassment, or safety concerns directly within the app.</li>
                      <li>Blocking tools and safety settings empower users to control their experience.</li>
                      <li>Our Safety Team promptly reviews all safety reports and takes appropriate action.</li>
                    </ul>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-200 mb-2">Educational Resources</h3>
                    <ul className="list-disc ml-5 text-indigo-700 dark:text-indigo-300 space-y-1">
                      <li>We provide resources within the platform to promote safe online behavior, digital literacy, and responsible community engagement for teens and parents.</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                    <h3 className="font-bold text-orange-800 dark:text-orange-200 mb-2">Continuous Review</h3>
                    <ul className="list-disc ml-5 text-orange-700 dark:text-orange-300 space-y-1">
                      <li>Our safety standards are regularly reviewed and updated to align with best practices, emerging threats, and regulatory requirements.</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-pink-50 dark:bg-pink-900/30 p-6 rounded-xl">
                  <h3 className="font-bold text-pink-800 dark:text-pink-200 mb-2">Parental Guidance</h3>
                  <ul className="list-disc ml-5 text-pink-700 dark:text-pink-300 space-y-1">
                    <li>We strongly recommend parents and guardians:</li>
                    <li>Review NexSQ's features and safety tools together with their teens.</li>
                    <li>Engage in open conversations about online safety, privacy, and responsible digital use.</li>
                    <li>Use parental supervision features on devices when available.</li>
                  </ul>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="font-bold mb-3">Contact Information</h3>
                  <ul className="text-gray-700 dark:text-gray-300">
                    <li><strong>Email:</strong> safety@nexsq.com</li>
                    <li><strong>Phone:</strong> +27 61 526 6887 (9 AM – 5 PM SAST, Mon–Fri)</li>
                    <li><strong>Mailing Address:</strong> NexSQ Safety Team, 56 Park Lodge, 268 Second Road, Northwold, Johannesburg, 2188</li>
                  </ul>
                </div>
                <p className="text-center text-base text-gray-600 dark:text-gray-400 mt-6">
                  At NexSQ, we are committed to protecting young users and ensuring that our digital ecosystem remains safe, respectful, and empowering for everyone.
                </p>
              </div>
            </Card>
          )}

          {tab === 'usage' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Usage Rules & Guidelines</h2>
              
              <div className="space-y-8">
                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Permitted Uses</h3>
                  <ul className="space-y-2 text-green-700 dark:text-green-300">
                    <li>• Create and share original content</li>
                    <li>• Engage in legitimate commerce and trade</li>
                    <li>• Connect with communities and build networks</li>
                    <li>• Use our digital wallet for legal transactions</li>
                    <li>• Participate in educational and professional discussions</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">Prohibited Activities</h3>
                  <ul className="space-y-2 text-red-700 dark:text-red-300">
                    <li>• Harassment, hate speech, or discriminatory content</li>
                    <li>• Illegal activities or content</li>
                    <li>• Spam, fake accounts, or automated abuse</li>
                    <li>• Intellectual property infringement</li>
                    <li>• Financial fraud or money laundering</li>
                    <li>• Distribution of malware or harmful software</li>
                    <li>• Adult content involving minors</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Account Responsibilities</h3>
                  <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                    <li>• Maintain accurate and up-to-date information</li>
                    <li>• Protect your account credentials</li>
                    <li>• Comply with applicable laws in your jurisdiction</li>
                    <li>• Report violations and suspicious activities</li>
                    <li>• Respect other users' rights and privacy</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Enforcement</h3>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Violations may result in content removal, account suspension, or permanent termination. 
                    We reserve the right to take appropriate action based on the severity of the violation.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {tab === 'content' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Content & Intellectual Property</h2>
              
              <div className="space-y-8">
                <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200 mb-4">Your Content Rights</h3>
                  <p className="text-purple-700 dark:text-purple-300 mb-3">
                    You retain ownership of content you create and post on NexSq. However, by posting content, you grant us:
                  </p>
                  <ul className="space-y-2 text-purple-700 dark:text-purple-300">
                    <li>• A worldwide, non-exclusive license to use, display, and distribute your content</li>
                    <li>• Rights to modify content for technical requirements (formatting, compression)</li>
                    <li>• Permission to include your content in our services and promotional materials</li>
                    <li>• Rights that survive account termination for legally required retention</li>
                  </ul>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-200 mb-4">Platform Rights</h3>
                  <p className="text-indigo-700 dark:text-indigo-300">
                    NexSq, our logo, trademarks, and proprietary technology are owned by GG Empire (Pty) Ltd. 
                    Users may not copy, modify, or create derivative works without express permission.
                  </p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4">Copyright & DMCA</h3>
                  <p className="text-orange-700 dark:text-orange-300 mb-3">
                    We respect intellectual property rights. To report copyright infringement:
                  </p>
                  <ul className="space-y-2 text-orange-700 dark:text-orange-300">
                    <li>• Send notice to: dmca@nexsq.com</li>
                    <li>• Include specific identification of copyrighted work</li>
                    <li>• Provide contact information and good faith statement</li>
                    <li>• We will investigate and take appropriate action</li>
                  </ul>
                </div>

                <div className="bg-teal-50 dark:bg-teal-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-teal-800 dark:text-teal-200 mb-4">Commercial Content</h3>
                  <p className="text-teal-700 dark:text-teal-300">
                    Users may sell products and services through NexSq. You are responsible for:
                    product quality, customer service, legal compliance, and applicable taxes.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {tab === 'liability' && (
            <Card className="p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Liability & Dispute Resolution</h2>
              
              <div className="space-y-8">
                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-4">Limitation of Liability</h3>
                  <p className="text-red-700 dark:text-red-300 mb-3">
                    NexSq is provided "as is" without warranties. We limit our liability to the maximum extent permitted by law:
                  </p>
                  <ul className="space-y-2 text-red-700 dark:text-red-300">
                    <li>• No liability for indirect, incidental, or consequential damages</li>
                    <li>• Maximum liability limited to amounts paid to us in the 12 months prior</li>
                    <li>• No responsibility for user-generated content or third-party actions</li>
                    <li>• Service availability not guaranteed</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Indemnification</h3>
                  <p className="text-blue-700 dark:text-blue-300">
                    Users agree to indemnify and hold NexSq harmless from claims arising from:
                    your use of the platform, violation of these terms, infringement of rights, 
                    or your commercial activities on the platform.
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-4">Dispute Resolution</h3>
                  <div className="text-green-700 dark:text-green-300 space-y-3">
                    <p><strong>Step 1:</strong> Direct negotiation - Contact us at legal@nexsq.com</p>
                    <p><strong>Step 2:</strong> Mediation - Through agreed neutral mediator</p>
                    <p><strong>Step 3:</strong> Arbitration - Binding arbitration under South African law</p>
                    <p><strong>Jurisdiction:</strong> South African courts for non-arbitrable matters</p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Termination</h3>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Either party may terminate this agreement at any time. Upon termination:
                    access to services ends immediately, data may be deleted after 30 days,
                    and certain provisions survive termination.
                  </p>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                  <h3 className="text-xl font-bold mb-4">Governing Law</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    These terms are governed by South African law. Any disputes will be resolved
                    in accordance with South African legal procedures and jurisdiction.
                  </p>
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
                <li><a href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</a></li>
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

export default Terms;
