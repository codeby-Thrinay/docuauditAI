import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldCheck, ShieldAlert, UploadCloud, FileText, DollarSign,
  AlertTriangle, CheckCircle2, Loader2, Copy, Check, ChevronDown,
  ChevronUp, BarChart3, Activity, TrendingUp, Hash, Send, LogOut,
  Lock, Download, RefreshCw, CheckCircle, Mail, Eye, EyeOff,
  X, MessageSquare, Sparkles,
} from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import SpotlightCard from './components/SpotlightCard.jsx';
import HearlyBackground from './components/HearlyBackground.jsx';

const API = 'http://localhost:5000/api';

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

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });

const fmtTime = (date) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

function downloadCSV(history) {
  const header = ['Invoice #', 'Vendor', 'Invoice Date', 'Subtotal', 'Tax', 'Total', 'Discrepancy', 'Risk', 'ERP Status'];
  const rows = history.map((d) => [
    d.invoiceNumber || '',
    d.vendor?.name || '',
    d.invoiceDate || '',
    d.financials?.subtotal ?? 0,
    d.financials?.taxAmount ?? 0,
    d.financials?.totalAmount ?? 0,
    d.audit?.discrepancy ?? 0,
    d.audit?.riskLevel || '',
    d.erpStatus || '',
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

/* ── Shared card classes ── */
const glassCard = 'bg-white/70 backdrop-blur-md border border-[#E7E1D4] shadow-sm hover:shadow-md hover:border-[#D8CEBC] rounded-2xl transition-all duration-300';

/* ── Metric Card ── */
function MetricCard({ icon: Icon, label, value, sub, iconBg }) {
  return (
    <SpotlightCard
      className={glassCard}
      spotlightColor="rgba(245, 158, 11, 0.10)"
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">{label}</span>
          <span className={`p-2 rounded-xl ${iconBg}`}>
            <Icon size={15} className="text-white" />
          </span>
        </div>
        <div className="text-3xl font-extrabold text-stone-900 leading-none">{value}</div>
        {sub && <div className="text-xs text-stone-400">{sub}</div>}
      </div>
    </SpotlightCard>
  );
}

/* ── Risk Badge ── */
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

/* ── AUTH MODAL ── */
function AuthModal() {
  const { login } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const autofill = () => setForm({ name: 'Demo Auditor', email: 'demo@docuaudit.ai', password: 'Demo@2026' });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const payload = tab === 'login'
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };
      const { data } = await axios.post(`${API}${endpoint}`, payload);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#FAF7F2] border border-[#E7E1D4] rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <HearlyBackground />
      <div className="relative z-10 w-full max-w-md mx-4">
        <SpotlightCard
          className="bg-white/80 backdrop-blur-xl border border-[#E7E1D4] shadow-xl shadow-stone-200/60"
          spotlightColor="rgba(245, 158, 11, 0.08)"
        >
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 shadow-lg mb-1">
                <ShieldCheck size={28} className="text-amber-400" />
              </div>
              <h1 className="text-2xl font-extrabold text-[#1C1917] tracking-tight">DocuAudit AI</h1>
              <p className="text-xs text-stone-500">Autonomous Document Processor &amp; Compliance Engine</p>
            </div>

            <div className="flex rounded-xl bg-[#F5EFE6] p-1 gap-1">
              {[['login', 'Sign In'], ['register', 'Create Auditor Account']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setTab(k); setError(''); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    tab === k
                      ? 'bg-white text-stone-900 shadow-sm border border-[#E7E1D4]'
                      : 'text-stone-500 hover:text-stone-800'
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
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
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
function CopilotPanel({ doc, onClose }) {
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
      const { data } = await axios.post(`${API}/documents/${doc._id}/chat`, { question: q });
      setMessages((m) => [...m, { role: 'ai', text: data.reply, ts: new Date() }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'Unable to process that request. Please try again.', ts: new Date() }]);
    } finally {
      setThinking(false);
    }
  }, [doc, input]);

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
            <button key={p} onClick={() => send(p)} className="text-left text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-300 rounded-lg px-3 py-2 transition-all">
              {p}
            </button>
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
            }`}>
              {msg.text}
            </div>
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

  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAnalytics = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/documents/analytics`); setAnalytics(data); }
    catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/documents`); setHistory(data); }
    catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAnalytics();
    fetchHistory();
  }, [isAuthenticated, fetchAnalytics, fetchHistory]);

  useEffect(() => {
    if (!loading) { setLoadingStage(0); return; }
    const t = setInterval(() => setLoadingStage((s) => (s + 1) % LOADING_STAGES.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  const healthScore = analytics && analytics.totalDocuments > 0
    ? Math.round((analytics.lowRiskCount / analytics.totalDocuments) * 100)
    : 100;

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ['application/pdf', 'image/png', 'image/jpeg'].includes(f.type)
    );
    if (dropped.length) setFiles(dropped);
  };

  const onFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length) setFiles(selected);
  };

  const handleAudit = async () => {
    if (!files.length) return;
    setLoading(true); setError(''); setActiveDoc(null); setDisputeOpen(false); setShowCopilot(false);
    setBatchProgress({ current: 0, total: files.length });
    const results = [];
    for (let i = 0; i < files.length; i++) {
      setBatchProgress({ current: i + 1, total: files.length });
      try {
        const form = new FormData();
        form.append('file', files[i]);
        const { data } = await axios.post(`${API}/documents/analyze`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        results.push(data);
      } catch (err) {
        setError(`Failed on "${files[i].name}": ${err.response?.data?.error || err.message}`);
      }
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
  };

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
      const { data } = await axios.patch(`${API}/documents/${activeDoc._id}/sync`);
      setActiveDoc(data);
      setHistory((prev) => prev.map((d) => (d._id === data._id ? data : d)));
    } catch (err) {
      setError(err.response?.data?.error || 'ERP sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const selectDoc = (doc) => {
    setActiveDoc(doc); setDisputeOpen(false); setShowCopilot(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated) return <AuthModal />;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#FAF7F2', color: '#1C1917' }}>

      {/* Animated canvas backdrop */}
      <HearlyBackground />

      {/* Copilot slide-out */}
      {showCopilot && activeDoc && (
        <CopilotPanel doc={activeDoc} onClose={() => setShowCopilot(false)} />
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
              <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold">API Connected · Port 5000</span>
              </div>

              {user && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#F5EFE6] border border-[#E7E1D4] rounded-xl px-3 py-1.5">
                    <div className="w-6 h-6 rounded-lg bg-stone-900 flex items-center justify-center text-xs font-bold text-amber-400">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-stone-700 hidden sm:block">Auditor: {user.name}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-rose-600 bg-[#F5EFE6] hover:bg-rose-50 border border-[#E7E1D4] hover:border-rose-200 px-3 py-2 rounded-xl transition-all font-semibold"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`max-w-7xl mx-auto px-6 py-8 space-y-8 transition-all duration-300 ${showCopilot ? 'sm:pr-[26rem]' : ''}`}>

          {/* ── Metric Cards ── */}
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Live Audit Metrics</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={DollarSign}   label="Total Spend Audited"    value={fmt(analytics?.totalSpend)}               sub="Across all your invoices"                                iconBg="bg-stone-800" />
              <MetricCard icon={AlertTriangle} label="Discrepancies Caught"   value={fmt(analytics?.totalDiscrepanciesCaught)} sub="Arithmetic & compliance flags"                           iconBg="bg-rose-500"  />
              <MetricCard icon={Hash}          label="Documents Audited"      value={analytics?.totalDocuments ?? 0}           sub={`${analytics?.highRiskCount ?? 0} high · ${analytics?.lowRiskCount ?? 0} clean`} iconBg="bg-amber-600" />
              <MetricCard icon={TrendingUp}    label="Audit Health Score"     value={`${healthScore}%`}                        sub="Percentage of clean / low-risk docs"                    iconBg="bg-emerald-700" />
            </div>
          </section>

          {/* ── Upload Zone ── */}
          <section>
            <SpotlightCard className={glassCard} spotlightColor="rgba(245, 158, 11, 0.09)">
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UploadCloud size={17} className="text-amber-600" />
                    <h2 className="font-bold text-stone-900">Upload Invoices for Audit</h2>
                  </div>
                  <span className="text-xs text-stone-400 font-medium">PDF · PNG · JPG · Multi-file</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
                    dragging
                      ? 'border-amber-400 bg-amber-50/40'
                      : files.length
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : 'border-[#D6CEBE] bg-white/50 hover:border-amber-400 hover:bg-amber-50/20'
                  }`}
                >
                  {files.length > 0 ? (
                    <>
                      <CheckCircle size={32} className="text-emerald-600" />
                      <div className="text-center">
                        <p className="font-bold text-emerald-700">{files.length === 1 ? files[0].name : `${files.length} files selected`}</p>
                        <p className="text-xs text-stone-400 mt-1">
                          {files.length === 1 ? `${(files[0].size / 1024).toFixed(1)} KB — ready for audit` : files.map((f) => f.name).join(', ')}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={32} className="text-stone-300" />
                      <div className="text-center">
                        <p className="text-stone-500 font-semibold">Drag &amp; drop invoices here</p>
                        <p className="text-xs text-stone-400 mt-1">or click to browse · select multiple for batch audit</p>
                      </div>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg" multiple className="hidden" onChange={onFileChange} />
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}
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
                  onClick={handleAudit}
                  disabled={!files.length || loading}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-stone-50 font-bold py-3.5 rounded-xl transition-all shadow-md shadow-stone-900/10 disabled:shadow-none"
                >
                  {loading ? (
                    <><Loader2 size={17} className="animate-spin" /> Auditing…</>
                  ) : (
                    <><ShieldCheck size={17} /> Audit &amp; Validate {files.length > 1 ? `${files.length} Documents` : 'Document'}</>
                  )}
                </button>
              </div>
            </SpotlightCard>
          </section>

          {/* ── Active Audit Report ── */}
          {activeDoc && (
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
                  {history.length > 0 && (
                    <button
                      onClick={() => downloadCSV(history)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-[#E7E1D4] bg-white/70 text-stone-600 hover:bg-[#F5EFE6] hover:border-[#D8CEBC] transition-all shadow-sm"
                    >
                      <Download size={13} /> Export CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Risk Banner */}
              {activeDoc.audit?.riskLevel === 'LOW' ? (
                <SpotlightCard className="bg-[#F0FDF4]/80 border-emerald-200" spotlightColor="rgba(16, 185, 129, 0.10)">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-200">
                      <ShieldCheck size={22} className="text-emerald-700" />
                    </div>
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
                      <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-200">
                        <ShieldAlert size={22} className="text-rose-700" />
                      </div>
                      <div>
                        <p className="font-extrabold text-rose-900 text-lg">Discrepancy Detected</p>
                        <p className="text-sm text-rose-600 mt-0.5">
                          Discrepancy: <span className="font-bold text-rose-800">{fmt(Math.abs(activeDoc.audit?.discrepancy))}</span>
                        </p>
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
                          <td colSpan={3} className="px-5 py-2 text-right font-semibold">Tax Amount</td>
                          <td className="px-5 py-2 text-right font-bold text-stone-700">{fmt(activeDoc.financials?.taxAmount)}</td>
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
                      onClick={handleSync}
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
                        {copied ? (
                          <><Check size={13} className="text-emerald-600" /><span className="text-emerald-700">Copied!</span></>
                        ) : (
                          <><Copy size={13} />Copy Dispute Email</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Audit History ── */}
          {history.length > 0 && (
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
        </main>

        <footer className="border-t border-[#E7E1D4] mt-12 py-6 text-center text-xs text-stone-400">
          DocuAudit AI · Powered by Gemini 2.5 Flash · MongoDB Atlas · All audit results are AI-assisted and should be verified by a qualified accountant.
        </footer>
      </div>{/* end z-10 */}
    </div>
  );
}
