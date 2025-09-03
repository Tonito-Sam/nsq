import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Globe, Users, UserCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [showEmailVerified, setShowEmailVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // For OTP-based reset, always show the form and clear any error
    setErrorMsg('');
    setShowForm(true);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      // Use the correct Supabase method for password reset with OTP
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token: otp,
        email: email,
        options: {
          redirectTo: undefined
        }
      });
      
      if (error) throw error;
      
      // After successful OTP verification, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });
      
      if (updateError) throw updateError;
      
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      setOtpError(error.message || "Failed to update password. Please try again.");
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // TypingHeroCard component
  function TypingHeroCard() {
    const sections = [
      { question: "Welcome to NexSq", answer: ["Where conversation and community meets commerce"] },
      { question: "What is NexSq?", answer: [
        "NexSq is a global digital square for communities, creators, and entrepreneurs.",
        "We connect people, ideas, and opportunities,",
        "empowering the next generation to build, bond, trade, and thrive."
      ] },
      { question: "NexSq offers", answer: ["Community", "studio for reels", "moments", "marketplace", "store-front manager", "payments", "and more.."] }
    ];

    const [currentSection, setCurrentSection] = useState(0);
    const [displayedQuestion, setDisplayedQuestion] = useState("");
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [showCursor, setShowCursor] = useState(true);
    const [phase, setPhase] = useState("question");

    const questionSpeed = 110;
    const lineDisplayTime = 2600;

    useEffect(() => {
      let timeout: NodeJS.Timeout;
      const currentSectionData = sections[currentSection];

      if (phase === "question" && displayedQuestion.length < currentSectionData.question.length) {
        timeout = setTimeout(() => {
          setDisplayedQuestion(currentSectionData.question.slice(0, displayedQuestion.length + 1));
        }, questionSpeed);
      } else if (phase === "question" && displayedQuestion.length === currentSectionData.question.length) {
        timeout = setTimeout(() => { setPhase("answer"); }, 1200);
      } else if (phase === "answer") {
        if (currentLineIndex < currentSectionData.answer.length - 1) {
          timeout = setTimeout(() => { setCurrentLineIndex((prev) => prev + 1); }, lineDisplayTime);
        } else {
          timeout = setTimeout(() => {
            setDisplayedQuestion(""); 
            setCurrentLineIndex(0); 
            setPhase("question"); 
            setCurrentSection((prev) => (prev + 1) % sections.length);
          }, 3200);
        }
      }

      return () => clearTimeout(timeout);
    }, [displayedQuestion, phase, currentSection, currentLineIndex, sections]);

    useEffect(() => { 
      const blink = setInterval(() => setShowCursor((c) => !c), 500); 
      return () => clearInterval(blink); 
    }, []);

    const renderAnswer = () => {
      if (phase === "answer") {
        const lines = sections[currentSection].answer;
        return (
          <div className="text-[#7c3aed] dark:text-white text-lg md:text-2xl text-center font-semibold mb-2 transition-all duration-500">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className={`transition-opacity duration-500 ${idx === currentLineIndex ? 'opacity-100' : 'opacity-40'} ${currentSection === 2 ? 'text-4xl md:text-6xl font-extrabold animate-pulse leading-tight' : ''}`}
                style={{ display: idx === currentLineIndex ? 'block' : 'none' }}
              >
                {line}
                {showCursor && idx === currentLineIndex && <span className="animate-pulse">|</span>}
              </div>
            ))}
          </div>
        );
      }
      return null;
    };

    return (
      <div className="w-full mb-6 flex flex-col items-center min-h-[220px]">
        <h2 className="text-3xl md:text-4xl font-extrabold text-[#7c3aed] dark:text-white text-center tracking-tight mb-4">
          {displayedQuestion}
          {phase === "question" && showCursor && <span className="animate-pulse">|</span>}
        </h2>
        {renderAnswer()}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
          <div className="absolute top-3/4 left-1/6 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-3000"></div>
        </div>

        <div className="relative z-10 flex w-full min-h-screen">
          {/* Left Side - Reset Password Form */}
          <div className="w-full lg:w-2/5 flex flex-col justify-center px-6 lg:px-12 py-6 bg-white dark:bg-[#18181b]/90 shadow-2xl lg:rounded-r-3xl relative z-10">
            <div className="max-w-md mx-auto w-full">
              {showEmailVerified ? (
                <div className="bg-white dark:bg-[#232323] rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Email Verified!
                  </h2>
                  <p className="mb-6 text-gray-600 dark:text-gray-300">
                    Your email has been successfully verified. You can now log in to your account.
                  </p>
                  <Button className="w-full" onClick={() => navigate("/auth")}>Go to Login</Button>
                </div>
              ) : showForm ? (
                <>
                  <div className="text-center mb-8">
                    <img 
                      src="/uploads/9de584d8-1087-4e32-8971-c629229627e3.png" 
                      alt="NexSq" 
                      className="h-16 w-auto mx-auto mb-6"
                    />
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      Reset Your Password
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                      Enter the OTP code from your email and your new password
                    </p>
                  </div>
                  <Card className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="relative">
                        <Input
                          type="email"
                          value={email}
                          readOnly
                          className="h-12 dark:bg-[#161616] dark:border-gray-600 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Enter OTP code"
                          value={otp}
                          onChange={e => setOtp(e.target.value)}
                          required
                          className="h-12 dark:bg-[#161616] dark:border-gray-600"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="New Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pl-10 pr-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="text-sm text-gray-500 ml-10 -mt-4">
                        Password must be at least 8 characters
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm New Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="pl-10 pr-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {otpError && <div className="text-red-600 text-sm mt-2">{otpError}</div>}
                      <Button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                        disabled={loading}
                      >
                        {loading ? 'Updating Password...' : 'Update Password'}
                      </Button>
                    </form>
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={() => navigate('/auth')}
                        className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium text-sm"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </Card>
                </>
              ) : errorMsg ? (
                <div className="bg-white dark:bg-[#232323] rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Link Error
                  </h2>
                  <p className="mb-6 text-gray-600 dark:text-gray-300">
                    {errorMsg}
                  </p>
                  <Button className="w-full" onClick={() => navigate("/auth")}>Go to Login</Button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Side - NexSq Positioning (Desktop Only) */}
          <div className="hidden lg:flex lg:w-3/5 items-center justify-center relative overflow-hidden px-0">
            <div className="absolute inset-0 bg-purple-50 dark:bg-[#7c3aed] transition-all duration-500"></div>
            
            {/* Faded favicon background */}
            <div
              className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
              style={{
                width: '420px',
                height: '420px',
                opacity: 0.10,
                backgroundImage: 'url(/favicon.ico)',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                filter: 'blur(0.5px)'
              }}
              aria-hidden="true"
            />
            
            <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-8 space-y-6">
              {/* Hero Section with Typing Animation */}
              <TypingHeroCard />

              {/* Modern Animated Benefit Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300">
                  <Globe className="h-6 w-6 text-[#7c3aed] dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-[#7c3aed] dark:text-white mb-1">Global Community</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Connect with users worldwide, break down barriers, and access new markets.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300">
                  <Users className="h-6 w-6 text-pink-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-pink-600 dark:text-white mb-1">Community & Collaboration</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Join a supportive network where your ideas matter and your impact is amplified.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300">
                  <UserCircle className="h-6 w-6 text-indigo-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-indigo-600 dark:text-white mb-1">Futuristic Innovation</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Experience next-gen features, seamless commerce, and a platform that evolves with you.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300">
                  <Lock className="h-6 w-6 text-purple-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-purple-600 dark:text-white mb-1">Digital Wallet Systems</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Secure peer-to-peer wallet enabling instant cross-border transactions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Desktop Only */}
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
    </>
  );
};

export default ResetPassword;
