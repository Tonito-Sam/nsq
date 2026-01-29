import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://nexsq.com/reset-password'
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('A password reset email has been sent. Please copy the OTP code from your email and enter it on the next page.');
      setTimeout(() => {
        window.location.href = 'http://nexsq.com/reset-password';
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#18181b]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            {message && <div className="text-green-600 text-sm mt-2">{message}<br />You will be redirected to the password reset page shortly.</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
