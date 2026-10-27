import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Mail, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import companyIcon from '../assets/logo.svg';
import { supabase } from '../utils/constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { t } from '../../i18n';

interface LoginPageProps {
  onLoginSuccess: (accessToken: string, userId: string) => Promise<boolean>;
  onPasswordResetComplete: () => Promise<void>;
  logoutReason?: 'idle_timeout' | null;
  passwordRecovery?: boolean;
}

export function LoginPage({
  onLoginSuccess,
  onPasswordResetComplete,
  logoutReason,
  passwordRecovery = false,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(`${t('login.resetEmailFailedPrefix')} ${error.message}`);
        return;
      }
      setResetEmailSent(true);
      toast.success(t('login.resetEmailSent'));
    } catch {
      toast.error(t('login.unexpectedResetError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('login.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('login.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(`${t('login.passwordUpdateFailedPrefix')} ${error.message}`);
        return;
      }
      toast.success(t('login.passwordUpdated'));
      setNewPassword('');
      setConfirmPassword('');
      await onPasswordResetComplete();
    } catch {
      toast.error(t('login.unexpectedPasswordUpdateError'));
    } finally {
      setLoading(false);
    }
  };

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
        const accepted = await onLoginSuccess(
          data.session.access_token,
          data.session.user.id,
        );
        if (accepted) {
          toast.success(t('login.loginSuccess'));
        } else {
          toast.error('Backend server is unavailable. Sign-in is blocked until service is restored.');
        }
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
        const accepted = await onLoginSuccess(
          data.session.access_token,
          data.session.user.id,
        );
        if (accepted) {
          toast.success(t('login.loginSuccess'));
        } else {
          toast.error('Backend server is unavailable. Sign-in is blocked until service is restored.');
        }
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
    setShowPassword(false);
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
              {passwordRecovery
                ? t('login.chooseNewPassword')
                : forgotPassword
                  ? t('login.resetInstructions')
                  : otpSent
                ? t('login.verifyOTP')
                : loginMode === 'password'
                  ? t('login.signInPassword')
                  : t('login.signInOTP')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passwordRecovery ? (
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('login.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder={t('login.newPasswordPlaceholder')}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={loading}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowNewPassword(value => !value)}
                      aria-label={showNewPassword ? t('login.hidePassword') : t('login.showPassword')}
                      aria-pressed={showNewPassword}
                      disabled={loading}
                    >
                      {showNewPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('login.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder={t('login.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  <Lock />
                  {loading ? t('login.updatingPassword') : t('login.updatePassword')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={onPasswordResetComplete}
                  disabled={loading}
                >
                  <ArrowLeft />
                  {t('login.backToSignIn')}
                </Button>
              </form>
            ) : forgotPassword ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                {resetEmailSent && (
                  <Alert>
                    <CheckCircle2 />
                    <AlertDescription>
                      {t('login.resetEmailSentDescription')} {email}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t('login.emailAddress')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      setResetEmailSent(false);
                    }}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || resetEmailSent}>
                  <Mail />
                  {loading ? t('login.sendingResetLink') : t('login.sendResetLink')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setForgotPassword(false);
                    setResetEmailSent(false);
                  }}
                  disabled={loading}
                >
                  <ArrowLeft />
                  {t('login.backToSignIn')}
                </Button>
              </form>
            ) : otpSent ? (
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
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">{t('login.password')}</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => setForgotPassword(true)}
                      disabled={loading}
                    >
                      {t('login.forgotPassword')}
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('login.passwordPlaceholder')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      aria-pressed={showPassword}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
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

            {/* Login mode toggle */}
            {!passwordRecovery && !forgotPassword && !otpSent && (
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
