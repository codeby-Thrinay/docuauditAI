import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldCheck, ShieldAlert, UploadCloud, FileText, DollarSign,
  AlertTriangle, CheckCircle2, Loader2, Copy, Check, ChevronDown,
  ChevronUp, BarChart3, Activity, TrendingUp, Hash, Send, LogOut,
  Lock, Download, RefreshCw, CheckCircle, Mail, Eye, EyeOff,
  X, MessageSquare, Sparkles, UserCircle, AlertOctagon, Settings,
  Globe, Server, Key,
} from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import SpotlightCard from './components/SpotlightCard.jsx';
import HearlyBackground from './components/HearlyBackground.jsx';

// ── DYNAMIC API RESOLUTION (Supports Localhost, Render, and Vercel) ──
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('docuaudit_api_url');
    if (saved && saved.trim()) {
      const u = saved.trim().replace(/\/+$/, '');
      return u.endsWith('/api') ? u : `${u}/api`;
    }
  }
  if (import.meta.env.VITE_API_URL) {
    const env = import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
    return env.endsWith('/api') ? env : `${env}/api`;
  }
  return 'http://localhost:5000/api';
}

export function getStoredGoogleClientId() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('docuaudit_google_client_id');
    if (saved && saved.trim()) return saved.trim();
  }
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

const LOADING_STAGES = [
  'Extracting line items and invoice metadata…',
  'Reconciling calculations with Gemini AI…',
  'Finalizing compliance and risk assessment…',
];

const QUICK_PROMPTS = [
  'Are there any tax compliance issues?',
  'List all line items over $100',
  'Generate a payment dispute breakdown',
];

// Demo numbers shown to unauthenticated guests
const DEMO_ANALYTICS = {
  totalSpend: 128450,
  totalDiscrepanciesCaught: 1842.50,
  totalDocuments: 47,
  lowRiskCount: 46,
  highRiskCount: 1,
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });

const fmtTime = (date) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

function downloadCSV(history) {
  const header = ['Invoice #', 'Vendor', 'Invoice Date', 'Subtotal', 'Tax', 'Total', 'Discrepancy', 'Risk', 'ERP Status'];
  const rows = history.map((d) => [
    d.invoiceNumber || '', d.vendor?.name || '', d.invoiceDate || '',
    d.financials?.subtotal ?? 0, d.financials?.taxAmount ?? 0,
    d.financials?.totalAmount ?? 0, d.audit?.discrepancy ?? 0,
    d.audit?.riskLevel || '', d.erpStatus || '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `docuaudit_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── FILE TYPE VALIDATOR (Accepts PDFs, Images, and Text Documents) ──
export const isAllowedInvoiceFile = (file) => {
  if (!file) return false;
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();
  const allowedExtensions = [
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'tiff',
    'tif',
    'bmp',
    'txt',
    'text',
    'csv',
    'tsv',
    'rtf',
    'log',
    'md',
  ];
  if (allowedExtensions.includes(ext)) return true;

  const mime = (file.type || '').toLowerCase();
  const allowedMimes = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'text/plain',
    'text/csv',
    'text/tab-separated-values',
    'application/rtf',
    'text/rtf',
    'text/markdown',
  ];
  return allowedMimes.includes(mime);
};

const glassCard = 'bg-white/70 backdrop-blur-md border border-[#E7E1D4] shadow-sm hover:shadow-md hover:border-[#D8CEBC] rounded-2xl transition-all duration-300';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, sub, iconBg, demo }) {
  return (
    <SpotlightCard className={glassCard} spotlightColor="rgba(245, 158, 11, 0.10)">
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">{label}</span>
          <span className={`p-2 rounded-xl ${iconBg}`}><Icon size={15} className="text-white" /></span>
        </div>
        <div className={`text-3xl font-extrabold leading-none ${demo ? 'text-stone-400' : 'text-stone-900'}`}>{value}</div>
        {sub && <div className="text-xs text-stone-400">{sub}</div>}
        {demo && <div className="text-xs text-amber-600 font-semibold">Sign in to see live data</div>}
      </div>
    </SpotlightCard>
  );
}

function RiskBadge({ level }) {
  return level === 'LOW' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 size={10} /> LOW
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
      <AlertTriangle size={10} /> HIGH
    </span>
  );
}

/* ── BACKEND API CONFIGURATION MODAL ── */
function BackendConfigModal({ apiUrl, onSave, onClose }) {
  const [val, setVal] = useState(apiUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 animate-in fade-in duration-200">
        <SpotlightCard className="bg-white/95 backdrop-blur-xl border border-[#E7E1D4] shadow-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-amber-600" />
              <h3 className="font-bold text-stone-900 text-base">Backend API Connection</h3>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Specify the backend server URL. If you deployed your backend to <strong>Render</strong>, paste your Render URL here so the deployed frontend can reach it.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">API URL / Render Host</label>
            <input
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full bg-[#FAF7F2] border border-[#E7E1D4] rounded-xl px-4 py-2.5 text-stone-900 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                const u = val.trim().replace(/\/+$/, '');
                const formatted = u.endsWith('/api') ? u : `${u}/api`;
                onSave(formatted);
                onClose();
              }}
              className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              Save &amp; Connect
            </button>
            <button
              onClick={() => {
                onSave('http://localhost:5000/api');
                onClose();
              }}
              className="px-3 py-2.5 border border-[#E7E1D4] bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl"
            >
              Reset Localhost
            </button>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

/* ── AUTH MODAL (Chrome Google Account Chooser + Email/Password) ── */
function AuthModal({ apiUrl, onOpenBackendConfig, onClose, onSuccess, contextMessage }) {
  const { login } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnectionError, setIsConnectionError] = useState(false);

  // Setup prompt for Google Cloud OAuth Client ID (if not yet entered)
  const [showClientIdPrompt, setShowClientIdPrompt] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(getStoredGoogleClientId());

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const autofill = () => setForm({ name: 'Demo Auditor', email: 'demo@docuaudit.ai', password: 'Demo@2026' });

  // ── TRIGGER REAL GOOGLE ACCOUNT CHOOSER (Shows Chrome Profiles) ──
  const launchGoogleAccountChooser = useCallback((targetClientId) => {
    const clientId = targetClientId || getStoredGoogleClientId();

    if (!clientId) {
      setShowClientIdPrompt(true);
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError('Google Identity Services script is still loading. Please check your internet connection and try again.');
      return;
    }

    setGoogleLoading(true);
    setError('');
    setIsConnectionError(false);

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        prompt: 'select_account', // Forces Google to show all Chrome logged-in accounts
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            console.error('Google token error:', tokenResponse);
            setError(`Google sign-in error: ${tokenResponse.error_description || tokenResponse.error}`);
            setGoogleLoading(false);
            return;
          }

          if (tokenResponse?.access_token) {
            try {
              // 1. Fetch real Google account profile
              const { data: profile } = await axios.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                }
              );

              // 2. Exchange with backend
              const { data: authData } = await axios.post(`${apiUrl}/auth/google`, {
                email: profile.email,
                name: profile.name || profile.given_name || profile.email.split('@')[0],
                avatar: profile.picture || '',
                googleId: profile.sub,
              });

              login(authData.token, authData.user);
              onSuccess?.();
            } catch (authErr) {
              console.error('Google auth error:', authErr);
              if (!authErr.response) {
                setIsConnectionError(true);
                setError(`Cannot reach the backend server at ${apiUrl}. Please ensure your backend is running or set your Render URL.`);
              } else {
                setError(authErr.response?.data?.error || 'Google authentication failed.');
              }
            } finally {
              setGoogleLoading(false);
            }
          }
        },
        error_callback: (err) => {
          console.error('Google popup init error:', err);
          setError('Google Sign-In popup was closed or blocked. Please allow popups for this site.');
          setGoogleLoading(false);
        },
      });

      // Opens native Google account selector window
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('Failed to trigger Google OAuth:', err);
      setError(`Failed to open Google account chooser: ${err.message}`);
      setGoogleLoading(false);
    }
  }, [apiUrl, login, onSuccess]);

  const handleSaveClientIdAndContinue = (e) => {
    e.preventDefault();
    const cleaned = clientIdInput.trim();
    if (!cleaned) return;
    localStorage.setItem('docuaudit_google_client_id', cleaned);
    setShowClientIdPrompt(false);
    launchGoogleAccountChooser(cleaned);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setIsConnectionError(false);
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const payload = tab === 'login'
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };
      const { data } = await axios.post(`${apiUrl}${endpoint}`, payload);
      login(data.token, data.user);
      onSuccess?.();
    } catch (err) {
      if (!err.response) {
        setIsConnectionError(true);
        setError(`Cannot reach the backend server at ${apiUrl}. If deployed on Vercel, please connect your Render backend URL.`);
      } else {
        setError(err.response?.data?.error || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#FAF7F2] border border-[#E7E1D4] rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md mx-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <SpotlightCard
          className="bg-white/95 backdrop-blur-xl border border-[#E7E1D4] shadow-2xl shadow-stone-300/40"
          spotlightColor="rgba(245, 158, 11, 0.08)"
        >
          <div className="p-8 space-y-5">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-all"
            >
              <X size={18} />
            </button>

            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 shadow-lg mb-1">
                <ShieldCheck size={28} className="text-amber-400" />
              </div>
              <h1 className="text-2xl font-extrabold text-[#1C1917] tracking-tight">DocuAudit AI</h1>
              <p className="text-xs text-stone-500">Autonomous Document Processor &amp; Compliance Engine</p>
            </div>

            {/* Contextual gate message */}
            {contextMessage && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500" />
                {contextMessage}
              </div>
            )}

            {/* ── GOOGLE AUTHENTICATION (Chrome Account Chooser) ── */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => launchGoogleAccountChooser()}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-800 font-semibold py-3 px-4 rounded-xl border border-[#D8CEBC] hover:border-amber-400 transition-all shadow-sm hover:shadow text-sm"
              >
                {googleLoading ? <Loader2 size={17} className="animate-spin text-amber-600" /> : <GoogleIcon size={19} />}
                <span>{googleLoading ? 'Connecting with Google…' : 'Continue with Google'}</span>
              </button>

              {/* Setup box for Google OAuth Client ID if not yet entered */}
              {showClientIdPrompt && (
                <form onSubmit={handleSaveClientIdAndContinue} className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key size={15} className="text-amber-700" />
                      <span className="text-xs font-bold text-stone-900">Connect Google Cloud OAuth</span>
                    </div>
                    <button type="button" onClick={() => setShowClientIdPrompt(false)} className="text-stone-400 hover:text-stone-600">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    To show your signed-in Chrome accounts in Google's official popup, enter your <strong>Google OAuth 2.0 Web Client ID</strong> (from Google Cloud Console):
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="xxxxxx-xxxxxx.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      Save &amp; Open Chrome Accounts
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    You can also set <code className="text-amber-800 bg-amber-100 px-1 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</code> in Vercel project environment variables.
                  </p>
                </form>
              )}

              {/* Divider */}
              <div className="relative flex items-center justify-center pt-1">
                <div className="border-t border-[#E7E1D4] w-full" />
                <span className="bg-[#FAF7F2] px-3 text-[11px] uppercase tracking-wider text-stone-400 font-bold absolute">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-[#F5EFE6] p-1 gap-1">
              {[['login', 'Sign In'], ['register', 'Create Account']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setTab(k); setError(''); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    tab === k ? 'bg-white text-stone-900 shadow-sm border border-[#E7E1D4]' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {tab === 'register' && (
                <input type="text" placeholder="Full Name" value={form.name} onChange={set('name')} required className={inputCls} />
              )}
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="email" placeholder="Email Address" value={form.email} onChange={set('email')} required className={`${inputCls} pl-10`} />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={set('password')} required className={`${inputCls} pl-10 pr-11`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {error && (
                <div className="flex flex-col gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span className="font-medium leading-relaxed">{error}</span>
                  </div>
                  {isConnectionError && (
                    <button
                      type="button"
                      onClick={onOpenBackendConfig}
                      className="self-start mt-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors border border-amber-300"
                    >
                      ⚙️ Configure Render Backend URL
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 disabled:cursor-not-allowed text-stone-50 font-semibold py-3 rounded-xl transition-all shadow-md shadow-stone-900/10"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                {loading ? 'Authenticating…' : tab === 'login' ? 'Sign In to Dashboard' : 'Create Account'}
              </button>
            </form>
            <button type="button" onClick={autofill} className="w-full text-xs text-stone-400 hover:text-amber-600 transition-colors py-1">
              ⚡ Auto-fill demo credentials
            </button>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

/* ── COPILOT PANEL ── */
function CopilotPanel({ doc, apiUrl, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const send = useCallback(async (question) => {
    const q = question || input.trim();
    if (!q || !doc) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q, ts: new Date() }]);
    setThinking(true);
    try {
      const { data } = await axios.post(`${apiUrl}/documents/${doc._id}/chat`, { question: q });
      setMessages((m) => [...m, { role: 'ai', text: data.reply, ts: new Date() }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'Unable to process that request. Please check backend connection.', ts: new Date() }]);
    } finally {
      setThinking(false);
    }
  }, [apiUrl, doc, input]);

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 z-40 flex flex-col bg-[#FAF7F2] border-l border-[#E7E1D4] shadow-2xl shadow-stone-300/30">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#EFE8DD] bg-[#F5EFE6]/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 border border-amber-200">
            <Sparkles size={15} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1C1917]">DocuAudit Copilot</p>
            <p className="text-xs text-stone-400 truncate max-w-[180px]">{doc?.fileName}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors p-1 rounded-lg hover:bg-[#EFE8DD]">
          <X size={18} />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-[#EFE8DD]/60 flex flex-col gap-2 bg-white/50">
        <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Quick Prompts</p>
        <div className="flex flex-col gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} className="text-left text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-300 rounded-lg px-3 py-2 transition-all">{p}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#FAF7F2]/60">
        {messages.length === 0 && (
          <div className="text-center text-stone-400 text-sm mt-8">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            Ask anything about this invoice
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-stone-900 text-stone-50 rounded-br-sm shadow-sm'
                : 'bg-white text-stone-700 border border-[#E7E1D4] rounded-bl-sm shadow-sm'
            }`}>{msg.text}</div>
            <span className="text-xs text-stone-400">{fmtTime(msg.ts)}</span>
          </div>
        ))}
        {thinking && (
          <div className="flex items-start">
            <div className="bg-white border border-[#E7E1D4] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
              <span className="flex gap-1">
                {[0,1,2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
              <span className="text-xs text-stone-400">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-4 border-t border-[#E7E1D4] bg-white/70 backdrop-blur">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about this invoice…"
            rows={2}
            className="flex-1 resize-none bg-[#FAF7F2] border border-[#E7E1D4] rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || thinking}
            className="p-3 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0 shadow-sm"
          >
            <Send size={16} className={input.trim() && !thinking ? 'text-amber-400' : 'text-stone-400'} />
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const { user, logout, isAuthenticated } = useAuth();

  // Backend API URL state
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl);
  const [showApiModal, setShowApiModal] = useState(false);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authContext, setAuthContext] = useState('');

  // Dashboard state
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [invalidDocs, setInvalidDocs] = useState([]);
  const [copied, setCopied] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef(null);

  // ── Data fetching ──
  const fetchAnalytics = useCallback(async () => {
    try { const { data } = await axios.get(`${apiUrl}/documents/analytics`); setAnalytics(data); }
    catch { /* silent */ }
  }, [apiUrl]);

  const fetchHistory = useCallback(async () => {
    try { const { data } = await axios.get(`${apiUrl}/documents`); setHistory(data); }
    catch { /* silent */ }
  }, [apiUrl]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAnalytics();
    fetchHistory();
  }, [isAuthenticated, fetchAnalytics, fetchHistory]);

  // Loading stage cycling
  useEffect(() => {
    if (!loading) { setLoadingStage(0); return; }
    const t = setInterval(() => setLoadingStage((s) => (s + 1) % LOADING_STAGES.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  // Display analytics — real data if authenticated, demo numbers for guests
  const displayAnalytics = isAuthenticated ? analytics : DEMO_ANALYTICS;
  const healthScore = displayAnalytics && displayAnalytics.totalDocuments > 0
    ? Math.round((displayAnalytics.lowRiskCount / displayAnalytics.totalDocuments) * 100)
    : 100;

  // ── Auth gate helper ──
  const requireAuth = useCallback((action, msg) => {
    if (isAuthenticated) {
      action();
    } else {
      setAuthContext(msg || 'Please sign in or Continue with Google to use live audit features.');
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  // ── Audit processor ──
  const handleAuditWithFiles = useCallback(async (filesToProcess) => {
    if (!filesToProcess?.length) return;
    setLoading(true);
    setError('');
    setInvalidDocs([]);
    setActiveDoc(null);
    setDisputeOpen(false);
    setShowCopilot(false);
    setBatchProgress({ current: 0, total: filesToProcess.length });

    const results = [];
    const rejected = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      setBatchProgress({ current: i + 1, total: filesToProcess.length });
      try {
        const form = new FormData();
        form.append('file', filesToProcess[i]);
        const { data } = await axios.post(`${apiUrl}/documents/analyze`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        results.push(data);
      } catch (err) {
        if (err.response?.data?.isInvalidDocument) {
          rejected.push({
            fileName: filesToProcess[i].name,
            reason: err.response.data.invalidReason || 'The uploaded file does not contain invoice or billing information.',
            documentType: err.response.data.documentType || 'Invalid Document',
          });
        } else if (!err.response) {
          setError(`Cannot reach backend at ${apiUrl}. Please check your Render backend URL.`);
        } else {
          setError(`Audit processing error on "${filesToProcess[i].name}": ${err.response?.data?.error || err.message}`);
        }
      }
    }

    if (rejected.length > 0) {
      setInvalidDocs(rejected);
    }

    if (results.length > 0) {
      setActiveDoc(results[results.length - 1]);
      setHistory((prev) => [...results.reverse(), ...prev]);
    }

    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(false);
    setBatchProgress({ current: 0, total: 0 });
    await fetchAnalytics();
  }, [apiUrl, fetchAnalytics]);

  // ── Post-auth success handler ──
  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
    fetchAnalytics();
    fetchHistory();
    if (pendingFiles && pendingFiles.length > 0) {
      const toProcess = [...pendingFiles];
      setPendingFiles(null);
      setFiles(toProcess);
      setTimeout(() => handleAuditWithFiles(toProcess), 300);
    }
  }, [pendingFiles, fetchAnalytics, fetchHistory, handleAuditWithFiles]);

  // ── File handlers ──
  const acceptFiles = useCallback((incoming) => {
    setError('');
    if (!incoming || incoming.length === 0) return;

    const valid = incoming.filter(isAllowedInvoiceFile);
    const rejected = incoming.filter((f) => !isAllowedInvoiceFile(f));

    if (rejected.length > 0 && valid.length === 0) {
      setError(`Unsupported file format (${rejected.map((f) => f.name).join(', ')}). Please drop or select a PDF document, image (PNG, JPG, WEBP), or text document (TXT, CSV).`);
      return;
    }

    if (rejected.length > 0) {
      setError(`Ignored unsupported file(s): ${rejected.map((f) => f.name).join(', ')}. DocuAudit accepts PDF, images, and text/CSV invoices.`);
    }

    if (!valid.length) return;

    if (!isAuthenticated) {
      setPendingFiles(valid);
      setAuthContext('Please sign in with your account or Continue with Google to run live AI audits.');
      setShowAuthModal(true);
      return;
    }

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const additions = valid.filter((f) => !existingNames.has(f.name));
      return [...prev, ...additions];
    });
  }, [isAuthenticated]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(e.dataTransfer.files));
  };

  const onFileChange = (e) => {
    acceptFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAudit = () => handleAuditWithFiles(files);

  const handleCopy = () => {
    if (activeDoc?.disputeDraft) {
      navigator.clipboard.writeText(activeDoc.disputeDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSync = async () => {
    if (!activeDoc) return;
    setSyncing(true);
    try {
      const { data } = await axios.patch(`${apiUrl}/documents/${activeDoc._id}/sync`);
      setActiveDoc(data);
      setHistory((prev) => prev.map((d) => (d._id === data._id ? data : d)));
    } catch (err) {
      setError(err.response?.data?.error || 'ERP sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const selectDoc = (doc) => {
    setActiveDoc(doc);
    setDisputeOpen(false);
    setShowCopilot(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Files to show in the dropzone (pending or active)
  const displayFiles = isAuthenticated ? files : (pendingFiles || []);

  const apiHostDisplay = apiUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#FAF7F2', color: '#1C1917' }}>
      <HearlyBackground />

      {/* Backend API Configuration Modal */}
      {showApiModal && (
        <BackendConfigModal
          apiUrl={apiUrl}
          onSave={(newUrl) => {
            localStorage.setItem('docuaudit_api_url', newUrl);
            setApiUrl(newUrl);
            setError('');
          }}
          onClose={() => setShowApiModal(false)}
        />
      )}

      {/* Auth modal — with Chrome Google Account Chooser & Email/Password */}
      {showAuthModal && (
        <AuthModal
          apiUrl={apiUrl}
          onOpenBackendConfig={() => { setShowAuthModal(false); setShowApiModal(true); }}
          onClose={() => { setShowAuthModal(false); setPendingFiles(null); }}
          onSuccess={handleAuthSuccess}
          contextMessage={authContext}
        />
      )}

      {/* Copilot panel */}
      {showCopilot && activeDoc && isAuthenticated && (
        <CopilotPanel doc={activeDoc} apiUrl={apiUrl} onClose={() => setShowCopilot(false)} />
      )}

      {/* All UI above canvas */}
      <div className="relative z-10">

        {/* ── Header ── */}
        <header className="border-b border-[#E7E1D4] bg-white/70 backdrop-blur-xl sticky top-0 z-30 shadow-sm shadow-stone-100/80">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-stone-900 p-2.5 rounded-xl shadow-md">
                <ShieldCheck size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#1C1917' }}>DocuAudit AI</h1>
                <p className="text-xs font-medium leading-none mt-0.5 hidden sm:block" style={{ color: '#57534E' }}>
                  Autonomous Document Processor &amp; Compliance Engine
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Backend status / switcher */}
              <button
                onClick={() => setShowApiModal(true)}
                title="Click to configure backend API host"
                className="hidden sm:flex items-center gap-2 bg-[#F5EFE6] hover:bg-amber-100/60 text-stone-700 border border-[#E7E1D4] px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[150px]">API: {apiHostDisplay}</span>
                <Settings size={12} className="text-stone-400" />
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#F5EFE6] border border-[#E7E1D4] rounded-xl px-3 py-1.5">
                    {user?.avatar ? (
                      <div className="relative">
                        <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-lg object-cover border border-amber-300" />
                        {user.authProvider === 'google' && (
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                            <GoogleIcon size={10} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-stone-900 flex items-center justify-center text-xs font-bold text-amber-400">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="hidden sm:flex flex-col text-left leading-tight">
                      <span className="text-xs font-semibold text-stone-800">Auditor: {user?.name}</span>
                      {user?.authProvider === 'google' && (
                        <span className="text-[10px] text-amber-700 font-bold">Google Account</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-rose-600 bg-[#F5EFE6] hover:bg-rose-50 border border-[#E7E1D4] hover:border-rose-200 px-3 py-2 rounded-xl transition-all font-semibold"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setAuthContext(''); setShowAuthModal(true); }}
                    className="hidden sm:flex items-center gap-2 bg-white hover:bg-stone-50 text-stone-700 border border-[#D8CEBC] text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs"
                  >
                    <GoogleIcon size={15} />
                    <span>Continue with Google</span>
                  </button>
                  <button
                    onClick={() => { setAuthContext(''); setShowAuthModal(true); }}
                    className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-stone-900/10"
                  >
                    <UserCircle size={15} />
                    Sign In / Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`max-w-7xl mx-auto px-6 py-8 space-y-8 transition-all duration-300 ${showCopilot ? 'sm:pr-[26rem]' : ''}`}>

          {/* ── Metric Cards ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                {isAuthenticated ? 'Live Audit Metrics' : 'Platform Overview (Demo)'}
              </p>
              {!isAuthenticated && (
                <button
                  onClick={() => { setAuthContext(''); setShowAuthModal(true); }}
                  className="text-xs text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2"
                >
                  Sign in or Continue with Google to see live metrics →
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={DollarSign}    label="Total Spend Audited"   value={fmt(displayAnalytics?.totalSpend)}               sub="Across all your invoices"                                         iconBg="bg-stone-800" demo={!isAuthenticated} />
              <MetricCard icon={AlertTriangle} label="Discrepancies Caught"  value={fmt(displayAnalytics?.totalDiscrepanciesCaught)}  sub="Arithmetic & compliance flags"                                    iconBg="bg-rose-500"  demo={!isAuthenticated} />
              <MetricCard icon={Hash}          label="Documents Audited"     value={displayAnalytics?.totalDocuments ?? 0}            sub={`${displayAnalytics?.highRiskCount ?? 0} high · ${displayAnalytics?.lowRiskCount ?? 0} clean`} iconBg="bg-amber-600" demo={!isAuthenticated} />
              <MetricCard icon={TrendingUp}    label="Audit Health Score"    value={`${healthScore}%`}                               sub="Percentage of clean / low-risk docs"                              iconBg="bg-emerald-700" demo={!isAuthenticated} />
            </div>
          </section>

          {/* ── Upload Zone (PDF, Images & Text/CSV Documents Support) ── */}
          <section>
            <SpotlightCard className={glassCard} spotlightColor="rgba(245, 158, 11, 0.09)">
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <UploadCloud size={17} className="text-amber-600" />
                    <h2 className="font-bold text-stone-900">Upload Invoices for Audit</h2>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">PDF</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">IMAGE</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200">TXT · CSV</span>
                    <span className="text-xs text-stone-400 font-medium ml-1">· Batch Multi-file</span>
                  </div>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
                    dragging ? 'border-amber-400 bg-amber-50/40'
                    : displayFiles.length ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-[#D6CEBE] bg-white/50 hover:border-amber-400 hover:bg-amber-50/20'
                  }`}
                >
                  {displayFiles.length > 0 ? (
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                          <CheckCircle size={18} />
                          <span>{displayFiles.length} Document{displayFiles.length > 1 ? 's' : ''} Ready for Audit</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles([]);
                            setPendingFiles(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {displayFiles.map((file, idx) => {
                          const name = (file.name || '').toLowerCase();
                          const ext = name.split('.').pop();
                          const isPdf = ext === 'pdf' || file.type?.includes('pdf');
                          const isCsv = ext === 'csv' || ext === 'tsv';
                          const isTxt = ['txt', 'text', 'rtf', 'log', 'md'].includes(ext);

                          let badgeCls = 'bg-amber-100 text-amber-800 border-amber-200';
                          let badgeLabel = 'IMG';
                          if (isPdf) {
                            badgeCls = 'bg-rose-100 text-rose-700 border-rose-200';
                            badgeLabel = 'PDF';
                          } else if (isCsv) {
                            badgeCls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                            badgeLabel = 'CSV';
                          } else if (isTxt) {
                            badgeCls = 'bg-blue-100 text-blue-700 border-blue-200';
                            badgeLabel = 'TXT';
                          }

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 p-2.5 bg-white border border-[#E7E1D4] rounded-xl shadow-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded border ${badgeCls}`}>
                                  {badgeLabel}
                                </span>
                                <span className="text-xs font-semibold text-stone-800 truncate" title={file.name}>
                                  {file.name}
                                </span>
                              </div>
                              <span className="text-[11px] text-stone-400 shrink-0">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {!isAuthenticated && (
                        <p className="text-center text-xs text-amber-600 font-semibold pt-1">
                          Sign in with your account or Continue with Google to run the audit →
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={34} className="text-stone-300" />
                      <div className="text-center">
                        <p className="text-stone-700 font-semibold text-base">Drag &amp; drop invoices, receipts, or text files here</p>
                        <p className="text-xs text-stone-400 mt-1">
                          {isAuthenticated
                            ? 'Supports PDF, images (PNG, JPG, WEBP), and text files (TXT, CSV) · select multiple for batch audit'
                            : 'Supports PDFs, invoice images, and text/CSV billing documents · sign in to audit'}
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf,image/*,.txt,text/plain,.csv,text/csv,.tsv,.rtf,.log"
                    multiple
                    className="hidden"
                    onChange={onFileChange}
                  />
                </div>

                {error && (
                  <div className="flex flex-col gap-2 bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span className="font-semibold text-sm leading-relaxed">{error}</span>
                    </div>
                    {error.includes('Cannot reach') && (
                      <button
                        type="button"
                        onClick={() => setShowApiModal(true)}
                        className="self-start mt-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3.5 py-1.5 rounded-lg transition-colors border border-amber-300"
                      >
                        ⚙️ Set Render Backend URL
                      </button>
                    )}
                  </div>
                )}

                {loading && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Loader2 size={15} className="animate-spin" />
                        <span className="font-semibold">{LOADING_STAGES[loadingStage]}</span>
                      </div>
                      {batchProgress.total > 1 && (
                        <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                          Processing {batchProgress.current} of {batchProgress.total}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${((loadingStage + 1) / LOADING_STAGES.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => requireAuth(handleAudit, 'Please sign in to run live AI-powered invoice audits.')}
                  disabled={loading || (!isAuthenticated ? !displayFiles.length : !files.length)}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-stone-50 font-bold py-3.5 rounded-xl transition-all shadow-md shadow-stone-900/10 disabled:shadow-none"
                >
                  {loading ? (
                    <><Loader2 size={17} className="animate-spin" /> Auditing Document…</>
                  ) : !isAuthenticated ? (
                    <><ShieldCheck size={17} /> Sign In or Continue with Google to Audit</>
                  ) : (
                    <><ShieldCheck size={17} /> Audit &amp; Validate {files.length > 1 ? `${files.length} Documents` : 'Document'}</>
                  )}
                </button>
              </div>
            </SpotlightCard>
          </section>

          {/* ── INVALID DOCUMENTS NOTIFICATION (Strict Accuracy & Compute Protection) ── */}
          {invalidDocs.length > 0 && (
            <section className="bg-rose-50/95 border-2 border-rose-300 rounded-2xl p-5 shadow-sm space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 border border-rose-200">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-rose-950 text-base">
                      Invalid Document{invalidDocs.length > 1 ? 's' : ''} Rejected — Compute Halted
                    </h3>
                    <p className="text-xs text-rose-700">
                      DocuAudit AI verified that the following uploaded file{invalidDocs.length > 1 ? 's do' : ' does'} not contain valid invoice or billing data. No compute, discrepancy, or ledger updates were processed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInvalidDocs([])}
                  className="text-rose-400 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-100 transition-colors"
                  title="Dismiss notification"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {invalidDocs.map((item, idx) => (
                  <div key={idx} className="bg-white/90 border border-rose-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-extrabold rounded">
                        INVALID
                      </span>
                      <span className="font-bold text-stone-900 text-sm truncate max-w-xs">{item.fileName}</span>
                    </div>
                    <p className="text-xs text-rose-800 font-medium sm:text-right">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-rose-800/80 pt-2 border-t border-rose-200">
                <AlertOctagon size={14} className="shrink-0 text-rose-600" />
                <span>
                  <strong>Audit Quality Guarantee:</strong> DocuAudit AI only computes genuine invoices, receipts, and bills (PDF, Images, TXT, CSV). Blank pictures, random photos, and non-billing documents are flagged as invalid to protect audit accuracy.
                </span>
              </div>
            </section>
          )}

          {/* ── Active Audit Report ── */}
          {activeDoc && isAuthenticated && (
            <section className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-amber-600" />
                  <h2 className="font-bold text-stone-900">Active Audit Report</h2>
                  <span className="text-xs text-stone-400">— {activeDoc.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCopilot((v) => !v)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                      showCopilot
                        ? 'bg-stone-900 border-stone-800 text-amber-400 shadow-md'
                        : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <Sparkles size={13} />
                    {showCopilot ? 'Close Copilot' : 'Ask Copilot'}
                  </button>
                  <button
                    onClick={() => requireAuth(() => downloadCSV(history), 'Please sign in to export audit data.')}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-[#E7E1D4] bg-white/70 text-stone-600 hover:bg-[#F5EFE6] hover:border-[#D8CEBC] transition-all shadow-sm"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Risk Banner */}
              {activeDoc.audit?.riskLevel === 'LOW' ? (
                <SpotlightCard className="bg-[#F0FDF4]/80 border-emerald-200" spotlightColor="rgba(16, 185, 129, 0.10)">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-200"><ShieldCheck size={22} className="text-emerald-700" /></div>
                    <div>
                      <p className="font-extrabold text-emerald-900 text-lg">Verified — 100% Math &amp; Compliance Check Passed</p>
                      <p className="text-sm text-emerald-700 mt-0.5">No discrepancies detected. This invoice is fully compliant.</p>
                    </div>
                  </div>
                </SpotlightCard>
              ) : (
                <SpotlightCard className="bg-[#FFF1F2]/80 border-rose-200" spotlightColor="rgba(239, 68, 68, 0.10)">
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-200"><ShieldAlert size={22} className="text-rose-700" /></div>
                      <div>
                        <p className="font-extrabold text-rose-900 text-lg">Discrepancy Detected</p>
                        <p className="text-sm text-rose-600 mt-0.5">Discrepancy: <span className="font-bold text-rose-800">{fmt(Math.abs(activeDoc.audit?.discrepancy))}</span></p>
                      </div>
                    </div>
                    {activeDoc.audit?.flags?.length > 0 && (
                      <ul className="ml-14 space-y-1.5">
                        {activeDoc.audit.flags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-rose-800">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-rose-400" />{flag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </SpotlightCard>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Document Type',  value: activeDoc.documentType },
                  { label: 'Vendor Name',    value: activeDoc.vendor?.name || '—' },
                  { label: 'Tax ID / GSTIN', value: activeDoc.vendor?.taxId || '—' },
                  { label: 'Invoice Number', value: activeDoc.invoiceNumber || '—' },
                  { label: 'Stated Total',   value: fmt(activeDoc.financials?.totalAmount) },
                ].map(({ label, value }) => (
                  <SpotlightCard key={label} className={`${glassCard} hover:border-amber-300`} spotlightColor="rgba(245, 158, 11, 0.08)">
                    <div className="p-4">
                      <p className="text-xs text-stone-400 uppercase tracking-wider mb-1.5 font-semibold">{label}</p>
                      <p className="text-sm font-bold text-stone-900 break-all leading-snug">{value}</p>
                    </div>
                  </SpotlightCard>
                ))}
              </div>

              {/* Line Items Table */}
              {activeDoc.lineItems?.length > 0 && (
                <div className="bg-white/80 backdrop-blur border border-[#E7E1D4] rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3.5 border-b border-[#EFE8DD] flex items-center gap-2 bg-[#F5EFE6]/50">
                    <BarChart3 size={14} className="text-amber-600" />
                    <span className="text-sm font-bold text-stone-900">Itemized Line Items</span>
                    <span className="ml-auto text-xs text-stone-400">{activeDoc.lineItems.length} items</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-stone-500 uppercase tracking-wider bg-[#FAF7F2] border-b border-[#EFE8DD]">
                          <th className="text-left px-5 py-3 font-bold">Description</th>
                          <th className="text-right px-5 py-3 font-bold">Qty</th>
                          <th className="text-right px-5 py-3 font-bold">Unit Price</th>
                          <th className="text-right px-5 py-3 font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {activeDoc.lineItems.map((item, i) => (
                          <tr key={i} className="hover:bg-[#F5EFE6]/50 transition-colors">
                            <td className="px-5 py-3 text-stone-700">{item.description}</td>
                            <td className="px-5 py-3 text-right text-stone-500">{item.quantity}</td>
                            <td className="px-5 py-3 text-right text-stone-500">{fmt(item.unitPrice)}</td>
                            <td className="px-5 py-3 text-right font-bold text-stone-900">{fmt(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#E7E1D4]">
                        <tr className="bg-[#FAF7F2] text-xs text-stone-500">
                          <td colSpan={3} className="px-5 py-2.5 text-right font-semibold">Subtotal</td>
                          <td className="px-5 py-2.5 text-right font-bold text-stone-700">{fmt(activeDoc.financials?.subtotal)}</td>
                        </tr>
                        <tr className="bg-[#FAF7F2] text-xs text-stone-500">
                          <td colSpan={3} className="px-5 py-2.5 text-right font-semibold">Tax Amount</td>
                          <td className="px-5 py-2.5 text-right font-bold text-stone-700">{fmt(activeDoc.financials?.taxAmount)}</td>
                        </tr>
                        <tr className="bg-amber-50/60 border-t border-amber-100">
                          <td colSpan={3} className="px-5 py-3 text-right font-extrabold text-amber-700 text-xs uppercase tracking-wider">Total</td>
                          <td className="px-5 py-3 text-right font-extrabold text-amber-700 text-base">{fmt(activeDoc.financials?.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {activeDoc.executiveSummary && (
                <SpotlightCard className={`${glassCard} hover:border-amber-300`} spotlightColor="rgba(245, 158, 11, 0.08)">
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Gemini AI — Executive Summary</span>
                    </div>
                    <p className="text-stone-700 text-sm leading-relaxed">{activeDoc.executiveSummary}</p>
                  </div>
                </SpotlightCard>
              )}

              {/* ERP Sync */}
              {activeDoc.audit?.riskLevel === 'LOW' && (
                <div>
                  {activeDoc.erpStatus === 'Synced to ERP' ? (
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                      <CheckCircle2 size={15} className="text-emerald-700" />
                      <span className="text-sm font-bold text-emerald-800">✓ Synced with Enterprise ERP</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => requireAuth(handleSync, 'Please sign in to approve and sync documents to ERP.')}
                      disabled={syncing}
                      className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 text-stone-50 text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-stone-900/10 disabled:shadow-none"
                    >
                      {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {syncing ? 'Syncing…' : 'Approve & Sync to ERP'}
                    </button>
                  )}
                </div>
              )}

              {/* Dispute Draft */}
              {activeDoc.disputeDraft && (
                <div className="bg-white/80 backdrop-blur border border-[#E7E1D4] rounded-2xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setDisputeOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F5EFE6]/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span className="text-sm font-bold text-stone-900">Action Center — Vendor Dispute Email</span>
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">AI Drafted</span>
                    </div>
                    {disputeOpen ? <ChevronUp size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
                  </button>
                  {disputeOpen && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="bg-[#FAF7F2] border border-[#E7E1D4] rounded-xl p-4">
                        <pre className="text-sm text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">{activeDoc.disputeDraft}</pre>
                      </div>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 bg-white hover:bg-[#F5EFE6] border border-[#E7E1D4] text-stone-700 text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        {copied ? <><Check size={13} className="text-emerald-600" /><span className="text-emerald-700">Copied!</span></> : <><Copy size={13} />Copy Dispute Email</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Audit History ── */}
          {isAuthenticated && history.length > 0 && (
            <section className="bg-white/80 backdrop-blur border border-[#E7E1D4] shadow-sm rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EFE8DD] flex items-center gap-2 bg-[#F5EFE6]/50">
                <FileText size={15} className="text-amber-600" />
                <h2 className="font-bold text-stone-900">Audit History</h2>
                <span className="ml-auto text-xs text-stone-400">{history.length} documents</span>
                <button onClick={() => downloadCSV(history)} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-700 transition-colors ml-2 font-semibold">
                  <Download size={12} /> Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-500 uppercase tracking-wider bg-[#FAF7F2] border-b border-[#EFE8DD]">
                      <th className="text-left px-5 py-3 font-bold">Date</th>
                      <th className="text-left px-5 py-3 font-bold">File Name</th>
                      <th className="text-left px-5 py-3 font-bold">Vendor</th>
                      <th className="text-right px-5 py-3 font-bold">Amount</th>
                      <th className="text-center px-5 py-3 font-bold">Risk</th>
                      <th className="text-center px-5 py-3 font-bold">ERP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {history.map((doc) => (
                      <tr
                        key={doc._id}
                        onClick={() => selectDoc(doc)}
                        className={`hover:bg-[#F5EFE6]/50 cursor-pointer transition-colors ${
                          activeDoc?._id === doc._id ? 'bg-amber-50/50 border-l-2 border-l-amber-500' : ''
                        }`}
                      >
                        <td className="px-5 py-3 text-stone-400 whitespace-nowrap text-xs">{fmtDate(doc.createdAt)}</td>
                        <td className="px-5 py-3 text-stone-700 max-w-[150px] truncate text-xs font-medium">{doc.fileName}</td>
                        <td className="px-5 py-3 text-stone-600 text-xs">{doc.vendor?.name || '—'}</td>
                        <td className="px-5 py-3 text-right font-bold text-stone-900 text-xs">{fmt(doc.financials?.totalAmount)}</td>
                        <td className="px-5 py-3 text-center"><RiskBadge level={doc.audit?.riskLevel} /></td>
                        <td className="px-5 py-3 text-center">
                          {doc.erpStatus === 'Synced to ERP'
                            ? <span className="text-xs text-emerald-700 font-bold">✓ Synced</span>
                            : <span className="text-xs text-stone-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Guest CTA Banner with Google Sign In Option ── */}
          {!isAuthenticated && (
            <section>
              <SpotlightCard className="bg-stone-900/95 border-stone-800" spotlightColor="rgba(245, 158, 11, 0.15)">
                <div className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <h3 className="text-xl font-extrabold text-stone-50">Ready to audit your invoices?</h3>
                    <p className="text-sm text-stone-400 mt-1">Sign in with Google or create an account to unlock AI-powered audits, fraud detection, and ERP sync.</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                    <button
                      onClick={() => { setAuthContext(''); setShowAuthModal(true); }}
                      className="flex-shrink-0 flex items-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-bold px-5 py-3 rounded-xl transition-all shadow-md text-sm"
                    >
                      <GoogleIcon size={17} />
                      Continue with Google
                    </button>
                    <button
                      onClick={() => { setAuthContext(''); setShowAuthModal(true); }}
                      className="flex-shrink-0 flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20 text-sm"
                    >
                      <ShieldCheck size={17} />
                      Get Started Free
                    </button>
                  </div>
                </div>
              </SpotlightCard>
            </section>
          )}
        </main>

        <footer className="border-t border-[#E7E1D4] mt-12 py-6 text-center text-xs text-stone-400">
          DocuAudit AI · Powered by Gemini AI · MongoDB Atlas · All audit results are AI-assisted and should be verified by a qualified accountant.
        </footer>
      </div>
    </div>
  );
}
