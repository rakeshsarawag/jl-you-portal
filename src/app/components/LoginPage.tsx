import { useState } from 'react';
import { Mail, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import companyIcon from '../assets/logo.svg';
import { supabase } from '../utils/constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { t } from '../../i18n';

interface LoginPageProps {
  onLoginSuccess: (accessToken: string) => void;
  logoutReason?: 'idle_timeout' | null;
}

export function LoginPage({ onLoginSuccess, logoutReason }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast.error(`${t('login.sendOTPFailedPrefix')} ${error.message}`);
        return;
      }
      setOtpSent(true);
      toast.success(t('login.otpSent'));
    } catch {
      toast.error(t('login.unexpectedSendError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        toast.error(`${t('login.otpFailedPrefix')} ${error.message}`);
        return;
      }
      if (data.session?.access_token) {
        toast.success(t('login.loginSuccess'));
        onLoginSuccess(data.session.access_token);
      } else {
        toast.error(t('login.loginFailed'));
      }
    } catch {
      toast.error(t('login.unexpectedVerifyError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(`${t('login.loginFailedPrefix')} ${error.message}`);
        return;
      }
      if (data.session?.access_token) {
        toast.success(t('login.loginSuccess'));
        onLoginSuccess(data.session.access_token);
      } else {
        toast.error(t('login.loginFailed'));
      }
    } catch {
      toast.error(t('login.unexpectedLoginError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLoginMode = () => {
    setLoginMode(prev => prev === 'password' ? 'otp' : 'password');
    setOtpSent(false);
    setOtp('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md space-y-4">
        {logoutReason === 'idle_timeout' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {"You were signed out due to inactivity. Please sign in again."}
          </div>
        )}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={companyIcon} alt="Jeshan Labs" className="h-20 w-20 rounded-2xl shadow-lg" />
            </div>
            <CardTitle className="text-2xl font-bold">{t('login.portalTitle')}</CardTitle>
            <CardDescription>
              {otpSent
                ? t('login.verifyOTP')
                : loginMode === 'password'
                  ? t('login.signInPassword')
                  : t('login.signInOTP')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {otpSent ? (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">{t('login.verificationCode')}</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder={t('login.enterOTP')}
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    required
                    disabled={loading}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground">{t('login.sentTo')} {email}</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? t('login.verifying') : t('login.verifySignIn')}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => { setOtpSent(false); setOtp(''); }} disabled={loading}>
                  {t('login.backToEmail')}
                </Button>
              </form>
            ) : loginMode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('login.emailAddress')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('login.passwordPlaceholder')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <Lock className="h-4 w-4 mr-2" />
                  {loading ? t('login.signingIn') : t('login.signIn')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('login.emailAddress')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <Mail className="h-4 w-4 mr-2" />
                  {loading ? t('login.sendingOTP') : t('login.sendOTP')}
                </Button>
              </form>
            )}

            {/* Quick Fill — test credentials */}
            {!otpSent && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-center text-muted-foreground">{t('login.quickFill')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmail('rakesh.sarawag@jeshanlabs.com');
                      if (loginMode === 'password') setPassword('admin123');
                    }}
                    className="text-xs"
                  >
                    {t('login.fillAdmin')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmail('Rakesh.sarawag9@gmail.com');
                      if (loginMode === 'password') setPassword('Initial@123');
                    }}
                    className="text-xs"
                  >
                    {t('login.fillEmployee')}
                  </Button>
                </div>
              </div>
            )}

            {/* Login mode toggle */}
            {!otpSent && (
              <div className="mt-6 pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={toggleLoginMode}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {loginMode === 'password' ? t('login.switchToOTP') : t('login.switchToPassword')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
