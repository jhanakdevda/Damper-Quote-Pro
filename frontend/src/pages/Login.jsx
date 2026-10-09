import React, { useState } from 'react';
import { Building2, Lock, Mail, ArrowRight, Shield, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { authApi } from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('engineer@damperquote.com');
  const [password, setPassword] = useState('DamperQuote2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // First login password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);

  const demoRoles = [
    { label: 'Admin', email: 'admin@damperquote.com', role: 'Admin', color: 'from-rose-500 to-pink-600' },
    { label: 'Manager', email: 'manager@damperquote.com', role: 'Manager', color: 'from-purple-500 to-indigo-600' },
    { label: 'Engineer', email: 'engineer@damperquote.com', role: 'Estimation Engineer', color: 'from-blue-500 to-cyan-600' },
    { label: 'Sales', email: 'sales@damperquote.com', role: 'Sales', color: 'from-emerald-500 to-teal-600' },
  ];

  const handleRoleQuickFill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('DamperQuote2026!');
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem('dqp_token', data.access_token);
      localStorage.setItem('dqp_user', JSON.stringify(data.user));

      if (data.must_change_password) {
        setMustChangePassword(true);
      } else {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangeError('');
    if (newPassword.length < 8) {
      setChangeError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await authApi.changePassword(password, newPassword);
      setChangeSuccess(true);
      setTimeout(async () => {
        const user = await authApi.getMe();
        localStorage.setItem('dqp_user', JSON.stringify(user));
        onLoginSuccess(user);
      }, 1000);
    } catch (err) {
      setChangeError(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-blue-500/20 mb-4">
            <Building2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Damper Quote <span className="text-blue-400">Pro</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Valve & Damper Manufacturing • Pune, India
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {!mustChangePassword ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">Sign In to Workspace</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a demo persona or enter credentials
                </p>
              </div>

              {/* Quick Persona Selectors */}
              <div className="mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Quick Demo Access:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {demoRoles.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleRoleQuickFill(r.email)}
                      className={`px-3 py-2 rounded-lg text-left border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600 transition-all ${
                        email === r.email ? 'ring-2 ring-blue-500 border-transparent bg-slate-800' : ''
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-200">{r.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{r.role}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="name@damperquote.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Enter Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* First Login Password Reset Flow */
            <div>
              <div className="flex items-center gap-2 text-amber-400 mb-4">
                <KeyRound className="w-5 h-5 shrink-0" />
                <h2 className="text-base font-semibold text-white">First Login: Change Password</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Company policy requires you to set a personal password on your first session.
              </p>

              {changeError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{changeError}</span>
                </div>
              )}

              {changeSuccess ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-300">Password Changed Successfully!</p>
                  <p className="text-xs text-slate-400 mt-1">Directing to dashboard...</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      New Password (min 8 chars)
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Update Password & Continue'
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Role-Based Access Control • Audit Trail Enabled</span>
        </div>
      </div>
    </div>
  );
}
