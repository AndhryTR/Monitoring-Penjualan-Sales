import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/* ============================================================================
   ERROR BOUNDARY
   Mencegah satu error runtime di sebuah page (mis. data corrupt, edge case
   di chart, bug di child component) membawa down SELURUH aplikasi. Tanpa
   boundary, kesalahan render di MainReportPage misalnya akan melempar
   sampai root <App> dan menampilkan layar putih total — user kehilangan
   akses ke tab lain, upload, settings, dsb.

   Pemakaian: bungkus area yang rentan (page-content) di SalesMonitoringApp
   dengan <ErrorBoundary colors={colors} resetKey={activeTab}>. `resetKey`
   dipakai sebagai sinyal "user pindah tab — pastikan boundary fresh" —
   saat key berubah, getDerivedStateFromError tidak direset otomatis, tapi
   effect di bawah akan reset error state begitu user pindah ke tab lain,
   sehingga tab lain tetap bisa dipakai walau tab sebelumnya crash.

   Catatan: React.createElement dipakai (bukan JSX) supaya file ini bisa
   dipakai walau project tidak punya preset JSX khusus di tooling tertentu,
   dan supaya komponen ini setara dengan yang ada di dokumentasi React
   resmi untuk ErrorBoundary.
============================================================================ */

const RESET_STYLES = {
  wrapper: {
    padding: "32px 16px",
    textAlign: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  msg: {
    fontSize: 13,
    marginBottom: 20,
    maxWidth: 480,
    marginInline: "auto",
    lineHeight: 1.5,
  },
  detail: {
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "left",
    background: "rgba(0,0,0,0.04)",
    padding: "10px 12px",
    borderRadius: 8,
    margin: "12px auto 20px",
    maxWidth: 560,
    maxHeight: 180,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
  },
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Simpan info komponen stack untuk ditampilkan di detail (dev only).
    // Tidak log ke service eksternal — biarkan caller menambahkan Sentry dll
    // kalau perlu, lewat override componentDidCatch di subclass.
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] runtime error:", error, info);
  }

  // Saat user pindah tab (resetKey berubah), reset state error supaya
  // boundary di tab baru mulai dari keadaan bersih. Tanpa ini, sekali
  // crash di satu tab, semua pindah tab berikutnya juga "terjebak" di
  // fallback UI.
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, info: null });
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const colors = this.props.colors || {};
    const coral = colors.coral || "#DC2626";
    const text = colors.text || "#111827";
    const textMuted = colors.textMuted || "#6B7280";
    const glassFill = colors.glassFill || "rgba(0,0,0,0.04)";
    const glassBorder = colors.glassBorder || "rgba(0,0,0,0.08)";

    const isProd = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD;

    return React.createElement(
      "div",
      { style: { ...RESET_STYLES.wrapper, color: text } },
      React.createElement(
        "div",
        {
          style: {
            ...RESET_STYLES.iconWrap,
            background: coral + "1A",
          },
        },
        React.createElement(AlertTriangle, { size: 26, color: coral })
      ),
      React.createElement(
        "div",
        { style: { ...RESET_STYLES.title, color: text } },
        "Terjadi kesalahan saat menampilkan halaman ini"
      ),
      React.createElement(
        "p",
        { style: { ...RESET_STYLES.msg, color: textMuted } },
        "Halaman lain masih bisa dipakai. Coba pindah tab di sidebar, atau muat ulang halaman untuk mengatasi kerusakan data sementara."
      ),
      // Tampilkan stack trace hanya di dev — di produksi tidak boleh bocor
      // detail internal ke end-user.
      !isProd &&
        this.state.error &&
        React.createElement(
          "pre",
          {
            style: {
              ...RESET_STYLES.detail,
              color: textMuted,
              border: `1px solid ${glassBorder}`,
            },
          },
          (this.state.error && (this.state.error.stack || this.state.message)) ||
            String(this.state.error || "") +
              "\n\nComponent stack:\n" +
              ((this.state.info && this.state.info.componentStack) || "")
        ),
      React.createElement(
        "div",
        { style: { display: "inline-flex", gap: 8 } },
        React.createElement(
          "button",
          {
            onClick: this.handleDismiss,
            style: {
              ...RESET_STYLES.btn,
              background: glassFill,
              color: text,
              border: `1px solid ${glassBorder}`,
            },
          },
          "Coba lagi di tab ini"
        ),
        React.createElement(
          "button",
          {
            onClick: this.handleReload,
            style: {
              ...RESET_STYLES.btn,
              background: coral,
              color: "#FFFFFF",
            },
          },
          React.createElement(RefreshCw, { size: 13 }),
          "Muat Ulang Aplikasi"
        )
      )
    );
  }
}

export default ErrorBoundary;
