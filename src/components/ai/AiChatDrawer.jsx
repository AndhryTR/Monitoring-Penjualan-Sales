import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Bot, Sparkles, X, Send, Settings, Trash2, CheckCircle2,
  AlertTriangle, RefreshCw, Eye, EyeOff, ArrowRight,
} from "lucide-react";
import { loadAiSettings, saveAiSettings } from "../../utils/aiSettings.js";
import { callDirect, callProxy, callTauri, dispatch, isTauriRuntime } from "../../utils/aiDispatcher.js";
import { executeAiTool, isWriteTool } from "../../utils/aiTools.js";
import { useScrollLock, useEscapeKey, useFocusTrap } from "../../hooks/useModalA11y.js";

const CHAT_LOG_KEY = "smapp:ai_chat_log:v1";
const MAX_LOG_ENTRIES = 50;

function loadChatLog() {
  try {
    const raw = window.localStorage.getItem(CHAT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChatLog(log) {
  try {
    const trimmed = (log || []).slice(-MAX_LOG_ENTRIES);
    window.localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota error
  }
}

const QUICK_PROMPTS = [
  "Analisis performa & ACH tim sales saat ini",
  "Siapa 3 sales dengan pencapaian terendah?",
  "Ringkas status pencapaian target per grup",
  "Export data transaksi ke format Excel",
];

// Timeline thinking: langkah terlihat (✓ selesai, ◌ aktif, ✕ gagal).
function ThinkingSteps({ steps = [], colors = {} }) {
  if (!steps.length) return null;
  return (
    <div className="mt-2 pt-2 space-y-1 border-t" style={{ borderColor: colors.glassBorder }}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono" style={{
          color: s.state === "error" ? colors.coral : s.state === "active" ? colors.gold : colors.textMuted,
        }}>
          <span className="shrink-0">{s.state === "error" ? "✕" : s.state === "active" ? "◌" : "✓"}</span>
          <span className="truncate">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function fmtRpShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + " M";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + " jt";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + " rb";
  return String(Math.round(v));
}

// Render hasil baca jadi tabel/kalimat — bukan gelembung JSON mentah.
function ResultBlock({ tool, data, colors = {} }) {
  if (!data) return null;
  if (tool === "queryData" && Array.isArray(data.rows)) {
    const sortTxt = data.sortBy ? ` (urut ${data.sortBy} ${data.order}, max ${data.limit})` : "";
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
          {data.rows.length} sales{sortTxt} · ACH global {data.achGlobal ?? "-"}%
        </div>
        {data.rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
            <span className="truncate font-semibold" style={{ color: colors.text }}>{i + 1}. {r.nama || r.kode}</span>
            <span className="shrink-0 font-mono font-bold" style={{ color: (r.ach ?? 0) >= 100 ? colors.mint : (r.ach ?? 0) >= 70 ? colors.gold : colors.coral }}>
              {r.ach ?? "-"}%
            </span>
            <span className="shrink-0 font-mono" style={{ color: colors.textMuted }}>{fmtRpShort(r.total)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (tool === "analisis" && data.ringkasan) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-[11px] leading-relaxed">{data.ringkasan}</p>
        {Array.isArray(data.terbawah5) && data.terbawah5.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            {data.terbawah5.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: i ? `1px solid ${colors.glassBorder}` : "none" }}>
                <span className="truncate">{s.nama || s.kode}</span>
                <span className="shrink-0 font-mono font-bold" style={{ color: colors.coral }}>{s.ach ?? s.achievement ?? "-"}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (tool === "bacaTarget" && Array.isArray(data)) {
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        {data.slice(0, 10).map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: i ? `1px solid ${colors.glassBorder}` : "none" }}>
            <span className="truncate font-semibold" style={{ color: colors.text }}>{t.nama || t.kode}</span>
            <span className="shrink-0 font-mono" style={{ color: colors.textMuted }}>{fmtRpShort(t.value)} · AO {t.ao ?? "-"}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function AiChatDrawer({
  isOpen,
  onClose,
  colors = {},
  canAccess,
  aiContext = {},
  deps = {},
  notifyError = () => {},
}) {
  const [messages, setMessages] = useState(() => loadChatLog());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyStage, setBusyStage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(() => loadAiSettings());
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: bool, msg: str }
  const [testing, setTesting] = useState(false);

  // State konfirmasi tool tulis
  const [pendingAction, setPendingAction] = useState(null); // { tool, params, preview, run, ringkasan }

  const drawerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Batalkan request AI yang masih jalan saat kirim ulang / tutup drawer.
  const inFlightRef = useRef(null);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, () => {
    if (settingsOpen) setSettingsOpen(false);
    else onClose?.();
  });
  useFocusTrap(isOpen, drawerRef);

  // Tutup drawer = batalkan request yang masih jalan.
  useEffect(() => {
    if (!isOpen) inFlightRef.current?.abort(new Error("Dibatalkan: panel ditutup."));
  }, [isOpen]);

  // Auto-scroll ke bawah saat pesan bertambah
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, busy]);

  // Fokus input saat drawer dibuka
  useEffect(() => {
    if (isOpen && !settingsOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, settingsOpen]);

  // Simpan log chat tiap pesan berubah
  useEffect(() => {
    saveChatLog(messages);
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([]);
    try { window.localStorage.removeItem(CHAT_LOG_KEY); } catch (_e) { /* ignore */ }
  };

  const handleSaveSettings = (newSettings) => {
    saveAiSettings(newSettings);
    setAiSettings(newSettings);
    setSettingsOpen(false);
    setTestResult(null);
  };

  const handleTestConnectionViaTransport = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!aiSettings.model) throw new Error("Model AI wajib diisi.");
      if (aiSettings.mode !== "proxy" && !aiSettings.baseURL) {
        throw new Error("Base URL wajib diisi untuk mode Direct.");
      }
      const call = isTauriRuntime()
        ? ((s, msgs, o) => callTauri(s, msgs))
        : aiSettings.mode === "proxy" ? callProxy : callDirect;
      // Tanpa fallback "Terhubung!" — balasan kosong = gagal (sukses palsu dilarang).
      const reply = await call(aiSettings, [
        { role: "user", content: "Halo, jawab 'OK' jika terhubung." },
      ], { timeoutMs: 30000 });
      if (!String(reply || "").trim()) throw new Error("Respons kosong dari server AI.");
      setTestResult({ ok: true, msg: `Koneksi sukses! Balasan: "${reply.trim()}"` });
    } catch (e) {
      setTestResult({ ok: false, msg: `Koneksi gagal: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    if ((aiSettings.mode !== "proxy" && !aiSettings.baseURL) || !aiSettings.model) {
      setSettingsOpen(true);
      notifyError("Konfigurasi AI Diperlukan", "Silakan atur Base URL dan Model AI di setelan.");
      return;
    }

    const userMsg = { id: Date.now().toString(36), role: "user", text, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setBusyStage("Memahami perintah…");
    // Batalkan request sebelumnya bila masih jalan, mulai controller baru.
    inFlightRef.current?.abort(new Error("Dibatalkan: ada perintah baru."));
    const flight = new AbortController();
    inFlightRef.current = flight;

    try {
      const res = await dispatch(text, aiContext, aiSettings, { signal: flight.signal });
      setBusyStage(`Menjalankan ${res.parsed?.tool || "tool"}…`);

      if (!res.parsed || !res.parsed.ok) {
        // Output tidak valid JSON atau tool asing
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: res.text || res.parsed?.reason || "Format respons tidak dikenali.",
          isRaw: true,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        return;
      }

      const { tool, params, ringkasan } = res.parsed;
      // Timeline thinking: tiap pesan bawa steps agar alur terlihat.
      const steps = [
        { label: `Perintah dipahami → ${tool}`, state: "done" },
      ];

      if (tool === "chat") {
        // Obrolan umum: jawaban langsung, tanpa eksekusi data.
        const c = executeAiTool(tool, params, aiContext, deps);
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: c.ok ? c.data.jawaban : ringkasan,
          tool,
          steps: [...steps, { label: "Jawaban langsung (tanpa data)", state: "done" }],
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        return;
      }

      if (isWriteTool(tool)) {
        // Tool tulis: susun preview, tahan eksekusi hingga user konfirmasi
        const writeExec = executeAiTool(tool, params, aiContext, deps);
        if (!writeExec.ok) {
          const errMsg = {
            id: (Date.now() + 1).toString(36),
            role: "assistant",
            text: `Perintah ditolak: ${writeExec.reason}`,
            tool,
            steps: [...steps, { label: `Validasi gagal: ${writeExec.reason}`, state: "error" }],
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, errMsg]);
          return;
        }

        // Tampilkan pesan dengan tombol konfirmasi
        const pendingMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: ringkasan || "Permintaan memerlukan persetujuan Anda:",
          tool,
          params,
          preview: writeExec.preview,
          status: "pending",
          steps: [...steps, { label: "Menunggu persetujuan Anda", state: "active" }],
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, pendingMsg]);
        setPendingAction({ tool, params, preview: writeExec.preview, run: writeExec.run, ringkasan, msgId: pendingMsg.id });
      } else {
        // Tool baca: eksekusi langsung
        const readExec = executeAiTool(tool, params, aiContext, deps);
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: ringkasan,
          tool,
          steps: readExec.ok
            ? [...steps, { label: `Eksekusi ${tool} berhasil`, state: "done" }]
            : [...steps, { label: `Eksekusi gagal: ${readExec.reason}`, state: "error" }],
          data: readExec.ok ? readExec.data : null,
          error: readExec.ok ? null : readExec.reason,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      if (inFlightRef.current === flight) inFlightRef.current = null;
      // Batal manual (perintah baru / tutup) jangan tampilkan sebagai error.
      if (err?.name === "AbortError" && /Dibatalkan/.test(err?.reason?.message || err?.message || "")) {
        setBusy(false);
        return;
      }
      console.error("AI dispatch error:", err);
      notifyError("AI Error", err.message);
      const errMsg = {
        id: (Date.now() + 1).toString(36),
        role: "assistant",
        text: `Error: ${err.message}`,
        isError: true,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction?.run) return;
    const { run, msgId } = pendingAction;
    setPendingAction(null);
    setBusy(true);
    try {
      const res = await run();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "completed", resultText: "Berhasil diterapkan." } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "failed", resultText: `Gagal: ${res.reason}` } : m))
        );
      }
    } catch (e) {
      notifyError("Gagal Eksekusi", e.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "failed", resultText: `Error: ${e.message}` } : m))
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancelAction = () => {
    if (pendingAction?.msgId) {
      const { msgId } = pendingAction;
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "cancelled", resultText: "Dibatalkan oleh pengguna." } : m))
      );
    }
    setPendingAction(null);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm sm-fadein"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel AI Automasi"
    >
      <div
        ref={drawerRef}
        className="w-full sm:w-[420px] h-full flex flex-col shadow-2xl sm-scale-in"
        style={{
          background: colors.dropdownBg || "#0F172A",
          borderLeft: `1px solid ${colors.glassBorder}`,
          color: colors.text || "#F8FAFC",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== HEADER ===== */}
        <div
          className="p-4 flex items-center justify-between gap-3 shrink-0"
          style={{
            borderBottom: `1px solid ${colors.glassBorder}`,
            background: colors.glassFill,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="p-2 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: `${colors.mint || "#10B981"}22`, color: colors.mint || "#10B981" }}
            >
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm truncate">Asisten AI Automasi</span>
                {(() => {
                  const tauri = isTauriRuntime();
                  const label = tauri ? "Tauri" : (aiSettings.mode === "direct" ? "Direct" : "Proxy");
                  const bg = tauri ? `${colors.mint}22` : (aiSettings.mode === "direct" ? `${colors.gold}22` : `${colors.blue}22`);
                  const fg = tauri ? colors.mint : (aiSettings.mode === "direct" ? colors.gold : colors.blue);
                  const tip = tauri ? "Koneksi via Rust native (bebas CORS/CSP)" : (aiSettings.mode === "direct" ? "Koneksi Langsung dari Browser" : "Koneksi via Backend Proxy");
                  return (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: bg, color: fg }}
                      title={tip}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[11px] truncate" style={{ color: colors.textMuted }}>
                {aiSettings.model || "Belum dikonfigurasi"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="sm-btn p-2 rounded-xl transition-colors"
              style={{
                background: settingsOpen ? `${colors.mint}22` : colors.glassFill,
                color: settingsOpen ? colors.mint : colors.textMuted,
              }}
              title="Setelan API AI"
              aria-label="Setelan API AI"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={messages.length === 0}
              className="sm-btn p-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ background: colors.glassFill, color: colors.textMuted }}
              title="Hapus riwayat chat"
              aria-label="Hapus riwayat chat"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm-btn p-2 rounded-xl transition-colors"
              style={{ background: colors.glassFill, color: colors.text }}
              title="Tutup Panel"
              aria-label="Tutup Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ===== SETTINGS PANEL (OVERLAY) ===== */}
        {settingsOpen && (
          <div
            className="p-4 space-y-3.5 sm-fadein overflow-y-auto shrink-0"
            style={{
              background: colors.glassFillStrong || "rgba(15,23,42,0.95)",
              borderBottom: `1px solid ${colors.glassBorder}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
                Konfigurasi API AI
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xs font-semibold"
                style={{ color: colors.textMuted }}
              >
                Tutup
              </button>
            </div>

            {/* Mode selection */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                Mode Koneksi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiSettings((s) => ({ ...s, mode: "direct" }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    aiSettings.mode === "direct" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "opacity-60"
                  }`}
                  style={{ borderColor: aiSettings.mode === "direct" ? colors.mint : colors.glassBorder }}
                >
                  Direct (Browser)
                </button>
                <button
                  type="button"
                  onClick={() => setAiSettings((s) => ({ ...s, mode: "proxy" }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    aiSettings.mode === "proxy" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "opacity-60"
                  }`}
                  style={{ borderColor: aiSettings.mode === "proxy" ? colors.blue : colors.glassBorder }}
                >
                  Proxy (Backend)
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                {aiSettings.mode === "proxy" ? "URL Backend Proxy" : "Base URL (OpenAI-compatible)"}
              </label>
              <input
                type="text"
                value={aiSettings.mode === "proxy" ? aiSettings.backendURL : aiSettings.baseURL}
                onChange={(e) => setAiSettings((s) => ({
                  ...s,
                  [s.mode === "proxy" ? "backendURL" : "baseURL"]: e.target.value,
                }))}
                placeholder={aiSettings.mode === "proxy" ? "kosongkan untuk /api/ai" : "mis. https://api.openai.com/v1"}
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                Nama Model AI
              </label>
              <input
                type="text"
                value={aiSettings.model}
                onChange={(e) => setAiSettings((s) => ({ ...s, model: e.target.value }))}
                placeholder="mis. gpt-4o-mini, deepseek-chat, llama-3.3-70b"
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>

            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                  {aiSettings.mode === "proxy" ? "Token Proxy (opsional)" : "API Key"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: colors.textMuted }}
                >
                  {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showKey ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={aiSettings.key}
                onChange={(e) => setAiSettings((s) => ({ ...s, key: e.target.value }))}
                placeholder={aiSettings.mode === "proxy" ? "opsional" : "sk-..."}
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: colors.textMuted }}>
                🔒 Disimpan lokal di perangkat ini, tidak dikirim ke server aplikasi.
              </p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {testResult.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                <span className="truncate">{testResult.msg}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnectionViaTransport}
                disabled={testing}
                className="sm-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border disabled:opacity-40"
                style={{ borderColor: colors.glassBorder, color: colors.text }}
              >
                {testing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {testing ? "Menguji..." : "Uji Koneksi"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveSettings(aiSettings)}
                className="sm-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white shadow-sm"
                style={{ background: colors.mint || "#10B981" }}
              >
                Simpan Setelan
              </button>
            </div>
          </div>
        )}

        {/* ===== CHAT BODY (MESSAGES) ===== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div
                className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: `${colors.mint || "#10B981"}18`, color: colors.mint || "#10B981" }}
              >
                <Bot size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Asisten AI Automasi</h3>
                <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: colors.textMuted }}>
                  Beri instruksi langsung untuk menganalisis data, menyesuaikan target sales, atau mengekspor laporan.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="pt-4 space-y-1.5 max-w-xs mx-auto text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: colors.textMuted }}>
                  Saran Cepat:
                </span>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="sm-row w-full text-left p-2 rounded-xl text-xs flex items-center justify-between gap-2 border transition-all"
                    style={{ background: colors.glassFill, borderColor: colors.glassBorder }}
                  >
                    <span className="truncate">{q}</span>
                    <ArrowRight size={12} className="shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} sm-fadein`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "rounded-tr-sm text-white font-medium"
                        : "rounded-tl-sm shadow-sm border"
                    }`}
                    style={{
                      background: isUser ? colors.mint || "#10B981" : colors.glassFillStrong || "rgba(255,255,255,0.05)",
                      borderColor: isUser ? "transparent" : colors.glassBorder,
                      color: isUser ? "#FFFFFF" : colors.text,
                    }}
                  >
                    {/* Header nama tool jika ada */}
                    {m.tool && (
                      <div
                        className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 pb-1 border-b flex items-center gap-1.5"
                        style={{ borderColor: colors.glassBorder, color: colors.gold }}
                      >
                        <Sparkles size={11} /> Tool: {m.tool}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Timeline thinking */}
                    <ThinkingSteps steps={m.steps} colors={colors} />

                    {/* Hasil baca: tabel/kalimat, bukan JSON mentah */}
                    <ResultBlock tool={m.tool} data={m.data} colors={colors} />

                    {/* Preview box untuk aksi tulis */}
                    {m.preview && (
                      <div
                        className="mt-2.5 p-2.5 rounded-xl border space-y-1.5"
                        style={{
                          background: colors.glassSubtle || "rgba(0,0,0,0.2)",
                          borderColor: colors.gold + "55",
                        }}
                      >
                        <div className="font-bold text-[11px] flex items-center gap-1.5" style={{ color: colors.gold }}>
                          <AlertTriangle size={12} />
                          {m.preview.judul}
                        </div>
                        <ul className="text-[10px] font-mono space-y-0.5 max-h-36 overflow-y-auto pr-1">
                          {m.preview.baris?.map((b, i) => (
                            <li key={i} className="truncate">• {b}</li>
                          ))}
                        </ul>

                        {/* Status konfirmasi */}
                        {m.status === "pending" && pendingAction?.msgId === m.id && (
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelAction}
                              disabled={busy}
                              className="sm-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-1 border"
                              style={{ borderColor: colors.glassBorder, color: colors.textMuted }}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmAction}
                              disabled={busy}
                              className="sm-btn px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex-1"
                              style={{ background: colors.mint || "#10B981" }}
                            >
                              Terapkan
                            </button>
                          </div>
                        )}
                        {m.status && m.status !== "pending" && (
                          <div
                            className={`text-[10px] font-semibold pt-1 ${
                              m.status === "completed" ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {m.resultText || (m.status === "completed" ? "Selesai." : "Dibatalkan.")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl w-fit sm-fadein" style={{ background: colors.glassFill }}>
              <RefreshCw size={13} className="animate-spin" style={{ color: colors.mint }} />
              <span style={{ color: colors.textMuted }}>{busyStage || "Memproses instruksi AI…"}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ===== CHAT FOOTER (INPUT) ===== */}
        <div
          className="p-3 shrink-0 space-y-2"
          style={{
            borderTop: `1px solid ${colors.glassBorder}`,
            background: colors.glassFill,
          }}
        >
          {/* Quick chip bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_PROMPTS.slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="text-[10px] px-2.5 py-1 rounded-lg shrink-0 border whitespace-nowrap opacity-75 hover:opacity-100 transition-opacity"
                style={{ background: colors.glassFillStrong, borderColor: colors.glassBorder, color: colors.text }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik perintah (mis. ubah target AGM jadi 250jt)..."
              disabled={busy}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs outline-none"
              style={{
                background: colors.dropdownBg || "#0F172A",
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="sm-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-white disabled:opacity-30"
              style={{ background: colors.mint || "#10B981" }}
              title="Kirim (Enter)"
              aria-label="Kirim"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
