import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/constants';

interface Props {
  userEmail: string;
}

/**
 * Shown when admin has set force_mfa=true but the user hasn't enrolled in TOTP yet.
 * Guides the user through Supabase Auth MFA enrollment (TOTP via authenticator app).
 */
export function MfaEnrollmentGate({ userEmail }: Props) {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'done'>('intro');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function startEnrollment() {
    setLoading(true);
    setError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep('qr');
    } catch (err: any) {
      setError(err.message || 'Failed to start MFA enrollment');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      if (!challenge?.id) throw new Error('Challenge failed');
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: otp });
      if (verifyError) throw verifyError;
      // Mark mfa_enrolled in app_users
      await supabase.from('app_users').update({ mfa_enrolled: true }).eq('email', userEmail);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">MFA Enrolled Successfully</h2>
          <p className="text-gray-500 text-sm mb-6">Your account is now protected with two-factor authentication.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Continue to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Key size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Two-Factor Authentication Required</h2>
            <p className="text-xs text-gray-500">Your admin has required MFA for your account.</p>
          </div>
        </div>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You must set up an authenticator app (Google Authenticator, Authy, 1Password, etc.) before you can access the portal.
            </p>
            <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
              <li>Install an authenticator app on your phone</li>
              <li>Click below to generate a QR code</li>
              <li>Scan it with your authenticator app</li>
              <li>Enter the 6-digit code to verify</li>
            </ol>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              onClick={startEnrollment}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Set Up Authenticator
            </button>
          </div>
        )}

        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Scan this QR code with your authenticator app:</p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 border rounded-xl p-2" />
              </div>
            )}
            {secret && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Or enter manually:</p>
                <code className="text-xs font-mono text-gray-800 break-all">{secret}</code>
              </div>
            )}
            <button onClick={() => setStep('verify')} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              I've scanned it — Enter Code
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Enter the 6-digit code from your authenticator app:</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-3xl font-mono tracking-widest border-2 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
              Verify & Activate MFA
            </button>
            <button onClick={() => setStep('qr')} className="w-full text-xs text-gray-400 hover:text-gray-600">
              Back to QR code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
