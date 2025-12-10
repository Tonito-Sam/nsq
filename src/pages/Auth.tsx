import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, User, Mail, Lock, UserCircle, Megaphone, Globe, Users } from 'lucide-react';

// Typing animation for hero card with three sections
function TypingHeroCard() {
  const sections = [
    {
      question: "Welcome to NexSq",
      answer: ["Where conversation and community meets commerce"]
    },
    {
      question: "What is NexSq?",
      answer: [
        "NexSq is a global digital square for communities, creators, and entrepreneurs.",
        "We connect people, ideas, and opportunities,",
        "empowering the next generation to build, bond, trade, and thrive."
      ]
    },
    {
      question: "NexSq offers",
      answer: ["Community", "studio for reels", "moments", "marketplace", "store-front manager", "payments", "and more.."]
    }
  ];

  const [currentSection, setCurrentSection] = useState(0);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState("question");
  // Slower typing and longer display for readability
  const questionSpeed = 110;
  const lineDisplayTime = 2600;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const currentSectionData = sections[currentSection];

    if (phase === "question" && displayedQuestion.length < currentSectionData.question.length) {
      timeout = setTimeout(() => {
        setDisplayedQuestion(currentSectionData.question.slice(0, displayedQuestion.length + 1));
      }, questionSpeed);
    } else if (phase === "question" && displayedQuestion.length === currentSectionData.question.length) {
      timeout = setTimeout(() => {
        setPhase("answer");
      }, 1200);
    } else if (phase === "answer") {
      if (currentLineIndex < currentSectionData.answer.length - 1) {
        timeout = setTimeout(() => {
          setCurrentLineIndex((prev) => prev + 1);
        }, lineDisplayTime);
      } else {
        // All lines shown, move to next section
        timeout = setTimeout(() => {
          setDisplayedQuestion("");
          setCurrentLineIndex(0);
          setPhase("question");
          setCurrentSection((prev) => (prev + 1) % sections.length);
        }, 3200);
      }
    }
    return () => timeout && clearTimeout(timeout);
  }, [displayedQuestion, phase, currentSection, currentLineIndex]);

  useEffect(() => {
    const blink = setInterval(() => setShowCursor((c) => !c), 500);
    return () => clearInterval(blink);
  }, []);

  const renderAnswer = () => {
    if (phase === "answer") {
      const lines = sections[currentSection].answer;
      return (
        <div className={`text-[#7c3aed] dark:text-white text-lg md:text-2xl text-center font-semibold mb-2 transition-all duration-500`}>
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

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Modern feature cards for right side
  const features = [
    {
      icon: <Megaphone className="h-10 w-10 text-purple-400" />,
      title: "Amplify Your Voice",
      description: "Creators, entrepreneurs, and changemakers — your voice deserves reach, impact, and revenue."
    },
    {
      icon: <Globe className="h-10 w-10 text-blue-400" />,
      title: "Built for Our Realities",
      description: "Made for emerging markets and global voices. Local challenges, global opportunities."
    },
    {
      icon: <Users className="h-10 w-10 text-pink-400" />,
      title: "Join a Movement",
      description: "A collective of doers, dreamers, and digital builders shaping the future together."
    }
  ];

  useEffect(() => {
    if (user) {
      // After login/session restore, try to return user to their last visited route
      try {
        const last = localStorage.getItem('last_route');
        const lastTs = Number(localStorage.getItem('last_route_ts') || '0');
        const skipPrefixes = ['/auth', '/forgot-password', '/reset-password', '/email-confirmed'];
        const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        const isRecent = last && lastTs && now - lastTs < MAX_AGE_MS;
        if (isRecent && !skipPrefixes.some(p => last!.startsWith(p))) {
          navigate(last!);
        } else {
          // older than 24h or missing, go to main feed (root '/'). Restored to canonical '/'
          navigate('/');
        }
      } catch (e) {
        navigate('/');
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent!",
        description: "Check your email for instructions to reset your password.",
      });
      setShowForgotPassword(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation for username, first name, last name
    const forbiddenWord = /admin/i;
    const suspiciousChars = /[^a-zA-Z0-9_\- ]/;
    if (!isLogin) {
      if (forbiddenWord.test(username) || forbiddenWord.test(firstName) || forbiddenWord.test(lastName)) {
        toast({
          title: "Invalid Name",
          description: 'Username, first name, and last name cannot contain "admin".',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (suspiciousChars.test(username) || suspiciousChars.test(firstName) || suspiciousChars.test(lastName)) {
        toast({
          title: "Invalid Characters",
          description: 'No special characters or symbols allowed in username, first name, or last name.',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        // Check if user profile is incomplete and redirect to edit profile
        const { data: userResult } = await supabase.auth.getUser();
        if (userResult?.user) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('first_name, last_name, username')
            .eq('id', userResult.user.id)
            .single();
          if (!dbUser || !dbUser.first_name || !dbUser.last_name || !dbUser.username) {
            navigate('/profile/edit');
            return;
          }
        }
        // Navigate to last saved route if available
        try {
          const last = localStorage.getItem('last_route');
          const lastTs = Number(localStorage.getItem('last_route_ts') || '0');
          const skipPrefixes = ['/auth', '/forgot-password', '/reset-password', '/email-confirmed'];
          const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
          const now = Date.now();
          const isRecent = last && lastTs && now - lastTs < MAX_AGE_MS;
          if (isRecent && !skipPrefixes.some(p => last!.startsWith(p))) {
            navigate(last!);
          } else {
            navigate('/');
          }
        } catch (e) {
          navigate('/');
        }
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        // FIX: wrap metadata in 'data' for Supabase
        const { error } = await signUp(email, password, {
          data: {
            username,
            first_name: firstName,
            last_name: lastName,
          }
        });
        if (error) {
          console.error('Sign up error:', error);
          throw error;
        }
        // Update the users table with profile info after registration
        const { data: userResult } = await supabase.auth.getUser();
        if (userResult?.user) {
          await supabase
            .from('users')
            .update({
              first_name: firstName,
              last_name: lastName,
              username: username,
            })
            .eq('id', userResult.user.id);
        }
        // Clear form fields and show confirmation
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setFirstName('');
        setLastName('');
        setShowConfirmation(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] flex">
        {/* Left Side - Forgot Password Form */}
        <div className="w-full lg:w-2/5 flex flex-col justify-center px-6 lg:px-12 py-12">
          <div className="max-w-md mx-auto w-full">
            <div className="text-center mb-8">
              <img 
                src="/lovable-uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" 
                alt="NexSq" 
                className="h-16 w-auto mx-auto mb-6"
              />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Reset Password
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Enter your email address to receive a password reset link
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - Platform Showcase (Desktop Only) */}
        <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-purple-600 via-blue-500 to-purple-700 text-white p-12 relative overflow-hidden">
          {/* Floating Elements */}
          <div className="absolute top-20 left-10 w-24 h-24 bg-white/20 rounded-full"></div>
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-white/10 rounded-full"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/15 rounded-full"></div>

          <div className="relative z-10 max-w-2xl mx-auto flex flex-col justify-center">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Your Voice, Your World, Your Square.
              </h2>
              <p className="text-purple-100 text-lg">
                Join our community of thinkers, creators, & innovators shaping the world
              </p>
            </div>

            <div className="space-y-6">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className={`bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20 transition-all duration-500 hover:bg-white/20 hover:-translate-y-1 ${
                    currentFeature === index ? 'ring-2 ring-white/30' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-white">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-purple-100 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <div className="text-3xl font-bold">2,453</div>
              <p className="text-purple-200">active voices today</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] flex flex-col items-center justify-center">
        <Card className="max-w-md w-full mx-auto p-8 text-center animate-fade-in-up">
          <img src="/lovable-uploads/9de584d8-1087-4e32-8971-c629229627e3.png" alt="1VoiceSquare" className="h-16 w-auto mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Account Created!</h2>
          <p className="mb-6 text-gray-700 dark:text-gray-300">A confirmation email has been sent to <span className="font-semibold">your email address</span>.<br />Please check your inbox and follow the link to activate your account.</p>
          <Button
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            onClick={() => {
              setShowConfirmation(false);
              setIsLogin(true);
              // Optionally clear any session
              if (typeof supabase !== 'undefined' && supabase.auth) {
                supabase.auth.signOut();
              }
              navigate('/auth');
            }}
          >
            Return to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute top-3/4 left-1/6 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-3000"></div>
      </div>

      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left Side - Form */}
        <div className="w-full lg:w-2/5 flex flex-col justify-center px-6 lg:px-12 py-6 bg-white dark:bg-[#18181b]/90 shadow-2xl lg:rounded-r-3xl relative z-10">
          <div className="max-w-md mx-auto w-full">
            <div className="text-center mb-6">
              <img 
                src="/lovable-uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" 
                alt="NexSq" 
                className="h-16 w-auto mx-auto mb-4 drop-shadow-xl"
              />
              {/* Conditional sign-in statement for returning vs. first-time users */}
              {isLogin ? (
                <p className="text-base md:text-lg font-medium text-[#7c3aed] dark:text-white text-center tracking-tight leading-snug">
                  {localStorage.getItem('rememberMe') === 'true'
                    ? 'Welcome back to your NexSq experience'
                    : 'Welcome, log in to begin your NexSq journey'}
                </p>
              ) : (
                <>
                  <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                    Create Your Account
                  </h2>
                  <p className="mt-2 text-base text-gray-500 dark:text-gray-400 font-medium">
                    Start your journey with NexSq.
                  </p>
                </>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <Input
                        type="text"
                        placeholder="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="pl-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                      />
                    </div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <Input
                        type="text"
                        placeholder="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="pl-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="pl-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                    />
                  </div>
                </>
              )}
              
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {!isLogin && (
                <>
                  <div className="text-sm text-gray-500 ml-10 -mt-2">
                    Password must be at least 8 characters
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-12 dark:bg-[#161616] dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </>
              )}

              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                disabled={loading}
              >
                {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
              </Button>
            </form>

            {!isLogin && (
              <div className="mt-4 text-center text-sm text-gray-500 px-4">
                <p>By signing up, you agree to the{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>,{' '}
                  <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>,{' '}
                  including <a href="/cookies" className="text-blue-600 hover:underline">Cookie Use</a>.
                </p>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-700 hover:text-purple-900 dark:text-purple-400 font-semibold underline underline-offset-2"
              >
                {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
              </button>
            </div>
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
            {/* Hero Section: What is NexSq? with Typing Animation - Now outside card */}
            <TypingHeroCard />

            {/* Modern Animated Benefit Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300 animate-fade-in-up">
                  <Globe className="h-6 w-6 text-[#7c3aed] dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-[#7c3aed] dark:text-white mb-1">Global Community</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Connect with users worldwide, break down barriers, and access new markets.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300 animate-fade-in-up delay-100">
                  <Users className="h-6 w-6 text-pink-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-pink-600 dark:text-white mb-1">Community & Collaboration</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Join a supportive network where your ideas matter and your impact is amplified.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300 animate-fade-in-up delay-200">
                  <UserCircle className="h-6 w-6 text-indigo-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-indigo-600 dark:text-white mb-1">Futuristic Innovation</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Experience next-gen features, seamless commerce, and a platform that evolves with you.</p>
                </div>
                <div className="bg-white/80 dark:bg-[#7c3aed]/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20 flex flex-col items-center shadow-xl hover:scale-105 transition-transform duration-300 animate-fade-in-up delay-300">
                  <Lock className="h-6 w-6 text-purple-500 dark:text-white mb-2 drop-shadow-lg" />
                  <h3 className="text-sm font-bold text-purple-600 dark:text-white mb-1">Digital Wallet Systems</h3>
                  <p className="text-gray-700 dark:text-white text-center text-xs">Secure peer-to-peer wallet enabling instant cross-border transactions.</p>
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
                <li><a href="/privacy-policy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</a></li>
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

export default Auth;
