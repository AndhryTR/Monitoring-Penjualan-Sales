import { useState, useEffect, useMemo, useRef } from "react";
import {
  MapPin, X, Download, Upload, Search, Check, AlertCircle, RefreshCw, Save, Sparkles, CheckCircle2,
} from "lucide-react";
import {
  getStoredCoordinates, saveStoredCoordinates, exportCoordinateTemplate,
  parseCoordinateExcel, geocodeAddress,
} from "../../utils/geoStorage.js";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";

/* ============================================================================
   OUTLET COORDINATE MODAL (Fitur B4 - Kelola Koordinat GPS Outlet)
   1. Tabel daftar toko dengan input Latitude/Longitude langsung
   2. Download template Excel yang sudah terisi kode & nama toko aktif
   3. Upload Excel koordinat secara massal
   4. Auto-geocode via OpenStreetMap dari alamat toko (satuan & batch)
   ============================================================================ */

export function OutletCoordinateModal({
  isOpen,
  onClose,
  outlets = [],
  depotName = "",
  colors,
  onCoordinatesSaved,
  onPickOnMap,
}) {
  const [search, setSearch] = useState("");
  const [filterCoord, setFilterCoord] = useState("all"); // "all" | "missing" | "ready"
  const [coords, setCoords] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', text: '' }
  const [isGeocodingAll, setIsGeocodingAll] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState(null); // { current, total }
  const [singleGeocodingCode, setSingleGeocodingCode] = useState(null);
  // Konfirmasi batch geocode (pengganti window.confirm/alert)
  const [geocodeConfirm, setGeocodeConfirm] = useState(null); // { count }

  const fileInputRef = useRef(null);
  const cancelGeocodingRef = useRef(false);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // Muat koordinat saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCoordinates(depotName);
      setCoords(stored);
      setSearch("");
      setFilterCoord("all");
      setImportStatus(null);
      setIsGeocodingAll(false);
      setGeocodingProgress(null);
    }
  }, [isOpen, depotName]);

  // Statistik kelengkapan koordinat
  const stats = useMemo(() => {
    let ready = 0;
    outlets.forEach((o) => {
      const c = coords[o.outletCode];
      if (c && c.lat !== undefined && c.lng !== undefined) {
        ready++;
      }
    });
    return {
      total: outlets.length,
      ready,
      missing: Math.max(0, outlets.length - ready),
      pct: outlets.length > 0 ? Math.round((ready / outlets.length) * 100) : 0,
    };
  }, [outlets, coords]);

  // Filter daftar outlet
  const filteredOutlets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outlets.filter((o) => {
      const c = coords[o.outletCode];
      const hasCoord = c && c.lat !== undefined && c.lng !== undefined;

      if (filterCoord === "missing" && hasCoord) return false;
      if (filterCoord === "ready" && !hasCoord) return false;

      if (!q) return true;
      return (
        (o.outletName && o.outletName.toLowerCase().includes(q)) ||
        (o.outletCode && o.outletCode.toLowerCase().includes(q)) ||
        (o.outletAddress && o.outletAddress.toLowerCase().includes(q)) ||
        (o.salesLabel && o.salesLabel.toLowerCase().includes(q))
      );
    });
  }, [outlets, coords, search, filterCoord]);

  if (!isOpen) return null;

  // Handler input koordinat manual
  const handleLatChange = (code, val) => {
    setCoords((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        lat: val === "" ? undefined : Number(val),
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const handleLngChange = (code, val) => {
    setCoords((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        lng: val === "" ? undefined : Number(val),
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  // Simpan perubahan ke storage
  const handleSave = () => {
    setIsSaving(true);
    try {
      saveStoredCoordinates(depotName, coords);
      setImportStatus({
        type: "success",
        text: "Koordinat berhasil disimpan!",
      });
      if (onCoordinatesSaved) {
        onCoordinatesSaved();
      }
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus({
        type: "error",
        text: `Gagal menyimpan: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download template Excel
  const handleDownloadTemplate = async () => {
    try {
      const filename = await exportCoordinateTemplate(outlets, depotName);
      setImportStatus({
        type: "success",
        text: `Template ${filename} berhasil diunduh. Silakan isi Latitude & Longitude lalu unggah kembali.`,
      });
    } catch (err) {
      setImportStatus({
        type: "error",
        text: `Gagal membuat template: ${err.message}`,
      });
    }
  };

  // Upload Excel file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus({ type: "info", text: "Memproses file Excel..." });
      const result = await parseCoordinateExcel(file);

      // Gabungkan dengan koordinat yang sudah ada
      setCoords((prev) => ({
        ...prev,
        ...result.coordsMap,
      }));

      // Simpan langsung
      const merged = { ...coords, ...result.coordsMap };
      saveStoredCoordinates(depotName, merged);
      if (onCoordinatesSaved) onCoordinatesSaved();

      setImportStatus({
        type: "success",
        text: `Berhasil mengimpor ${result.successCount} titik koordinat outlet! (${result.skippedCount} baris tidak valid diabaikan)`,
      });
    } catch (err) {
      setImportStatus({
        type: "error",
        text: `Gagal mengimpor file: ${err.message}`,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Geocode 1 alamat outlet
  const handleGeocodeSingle = async (outlet) => {
    const code = outlet.outletCode;
    const addr = outlet.outletAddress || coords[code]?.address;
    if (!addr || !addr.trim()) {
      setImportStatus({
        type: "error",
        text: "Alamat toko ini kosong. Silakan lengkapi alamat terlebih dahulu.",
      });
      return;
    }

    setSingleGeocodingCode(code);
    try {
      const res = await geocodeAddress(addr);
      if (res && res.lat && res.lng) {
        setCoords((prev) => ({
          ...prev,
          [code]: {
            ...prev[code],
            lat: res.lat,
            lng: res.lng,
            address: addr,
            updatedAt: new Date().toISOString(),
          },
        }));
        setImportStatus({
          type: "success",
          text: `Titik GPS ${outlet.outletName} ditemukan: [${res.lat.toFixed(5)}, ${res.lng.toFixed(5)}]`,
        });
      } else {
        setImportStatus({
          type: "error",
          text: `Tidak dapat menemukan koordinat otomatis untuk alamat "${addr}". Coba masukkan secara manual.`,
        });
      }
    } catch (err) {
      setImportStatus({
        type: "error",
        text: `Error geocoding: ${err.message}`,
      });
    } finally {
      setSingleGeocodingCode(null);
    }
  };

  // Batch geocode semua outlet yang punya alamat tapi belum berkoordinat
  // Tahap 1: hitung target, buka ConfirmDialog (atau info bila nol).
  const handleBatchGeocode = () => {
    const targets = outlets.filter((o) => {
      const c = coords[o.outletCode];
      const hasCoord = c && c.lat !== undefined && c.lng !== undefined;
      return !hasCoord && !!o.outletAddress && o.outletAddress.trim().length >= 4;
    });

    if (targets.length === 0) {
      setImportStatus({
        type: "error",
        text: "Semua outlet yang memiliki alamat sudah terpetakan, atau tidak ada alamat toko yang dapat dicari.",
      });
      return;
    }

    setGeocodeConfirm({ targets });
  };

  // Tahap 2: eksekusi sesudah konfirm.
  const runBatchGeocode = async () => {
    const targets = geocodeConfirm?.targets || [];
    if (!targets.length) { setGeocodeConfirm(null); return; }
    setGeocodeConfirm(null);

    setIsGeocodingAll(true);
    cancelGeocodingRef.current = false;
    let foundCount = 0;
    const newCoords = { ...coords };

    for (let i = 0; i < targets.length; i++) {
      if (cancelGeocodingRef.current) break;
      const target = targets[i];
      setGeocodingProgress({ current: i + 1, total: targets.length });

      try {
        const res = await geocodeAddress(target.outletAddress);
        if (res && res.lat && res.lng) {
          newCoords[target.outletCode] = {
            lat: res.lat,
            lng: res.lng,
            address: target.outletAddress,
            updatedAt: new Date().toISOString(),
          };
          foundCount++;
        }
      } catch (err) {
        console.warn("Skip error:", err);
      }

      // Delay 1.1s to respect Nominatim API limit
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    setCoords(newCoords);
    saveStoredCoordinates(depotName, newCoords);
    if (onCoordinatesSaved) onCoordinatesSaved();

    setIsGeocodingAll(false);
    setGeocodingProgress(null);
    setImportStatus({
      type: "success",
      text: `Pencarian otomatis selesai! Berhasil menemukan ${foundCount} dari ${targets.length} toko.`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm-fadein">
      <div
        className="sm-card sm-modal-glass sm-scale-in w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: colors.colorScheme === "light" ? "#FFFFFF" : "#0F172A",
          border: `1px solid ${colors.glassBorder}`,
        }}
      >
        {/* Header */}
        <div
          className="p-5 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ background: colors.mint + "20", color: colors.mint }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <div className="disp text-base font-bold" style={{ color: colors.text }}>
                Kelola Koordinat GPS Outlet
              </div>
              <div className="text-xs" style={{ color: colors.textMuted }}>
                Depo: <b>{depotName || "SEMUA DEPO"}</b> · Tersimpan di database lokal perangkat Anda
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sm-btn p-2 rounded-full hover:opacity-80 transition-opacity"
            style={{ background: colors.glassFill, color: colors.textMuted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action & Stats Banner */}
        <div
          className="p-4 flex flex-wrap items-center justify-between gap-3"
          style={{
            background: colors.colorScheme === "light" ? "#F8FAFC" : "#1E293B44",
            borderBottom: `1px solid ${colors.glassBorder}`,
          }}
        >
          {/* Progress Indicator */}
          <div className="flex items-center gap-3">
            <div className="text-xs">
              <span style={{ color: colors.textMuted }}>Status Kelengkapan: </span>
              <b style={{ color: colors.mint }}>{stats.ready}</b> / {stats.total} Outlet ({stats.pct}%)
            </div>
            <div className="w-24 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${stats.pct}%`, background: colors.mint }}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: colors.glassFill,
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
              title="Unduh template Excel berisi seluruh daftar toko aktif saat ini"
            >
              <Download size={14} style={{ color: colors.gold }} /> Unduh Template Excel
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: colors.glassFill,
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
              title="Unggah file Excel koordinat yang sudah diisi"
            >
              <Upload size={14} style={{ color: colors.blue }} /> Unggah Excel
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              onClick={handleBatchGeocode}
              disabled={isGeocodingAll}
              className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
              style={{
                background: colors.violet + "22",
                border: `1px solid ${colors.violet}44`,
                color: colors.violet,
              }}
              title="Otomatis cari koordinat toko yang memiliki alamat"
            >
              <Sparkles size={14} className={isGeocodingAll ? "animate-spin" : ""} />
              {isGeocodingAll
                ? `Mencari (${geocodingProgress?.current}/${geocodingProgress?.total})...`
                : "Auto-Geocode Alamat"}
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="sm-btn inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{ background: colors.mint }}
            >
              <Save size={14} /> Simpan Perubahan
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {importStatus && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              importStatus.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}
          >
            {importStatus.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{importStatus.text}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 pb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            />
            <input
              type="text"
              placeholder="Cari nama toko, kode, alamat, atau sales..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none transition-colors"
              style={{
                background: colors.glassFill,
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterCoord("all")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                filterCoord === "all" ? "bg-blue-600 text-white" : ""
              }`}
              style={filterCoord !== "all" ? { background: colors.glassFill, color: colors.textMuted } : {}}
            >
              Semua ({outlets.length})
            </button>
            <button
              onClick={() => setFilterCoord("ready")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                filterCoord === "ready" ? "bg-emerald-600 text-white" : ""
              }`}
              style={filterCoord !== "ready" ? { background: colors.glassFill, color: colors.textMuted } : {}}
            >
              Sudah Ada ({stats.ready})
            </button>
            <button
              onClick={() => setFilterCoord("missing")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                filterCoord === "missing" ? "bg-amber-600 text-white" : ""
              }`}
              style={filterCoord !== "missing" ? { background: colors.glassFill, color: colors.textMuted } : {}}
            >
              Belum Ada ({stats.missing})
            </button>
          </div>
        </div>

        {/* Table List of Outlets */}
        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {filteredOutlets.length === 0 ? (
            <div className="p-12 text-center text-xs" style={{ color: colors.textMuted }}>
              Tidak ada outlet yang sesuai dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.glassBorder }}>
              <table className="w-full text-xs text-left">
                <thead
                  style={{
                    background: colors.colorScheme === "light" ? "#F1F5F9" : "#1E293B",
                    color: colors.textMuted,
                  }}
                >
                  <tr>
                    <th className="p-2.5 font-semibold">Toko & Kode</th>
                    <th className="p-2.5 font-semibold">Sales</th>
                    <th className="p-2.5 font-semibold">Alamat</th>
                    <th className="p-2.5 font-semibold w-32">Latitude</th>
                    <th className="p-2.5 font-semibold w-32">Longitude</th>
                    <th className="p-2.5 font-semibold text-center w-40">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: colors.glassBorder }}>
                  {filteredOutlets.map((o) => {
                    const c = coords[o.outletCode] || {};
                    const hasCoord = c.lat !== undefined && c.lng !== undefined;
                    const isGeocodingThis = singleGeocodingCode === o.outletCode;

                    return (
                      <tr
                        key={o.outletCode}
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="p-2.5">
                          <div className="font-semibold" style={{ color: colors.text }}>
                            {o.outletName}
                          </div>
                          <div className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
                            {o.outletCode}
                          </div>
                        </td>
                        <td className="p-2.5" style={{ color: colors.textMuted }}>
                          {o.salesLabel || "-"}
                        </td>
                        <td
                          className="p-2.5 max-w-[220px] truncate"
                          title={o.outletAddress || c.address}
                          style={{ color: colors.textMuted }}
                        >
                          {o.outletAddress || c.address || (
                            <span className="italic opacity-60">(Alamat tidak ada)</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="-7.250..."
                            value={c.lat !== undefined ? c.lat : ""}
                            onChange={(e) => handleLatChange(o.outletCode, e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-mono outline-none"
                            style={{
                              background: colors.glassFill,
                              border: `1px solid ${hasCoord ? colors.mint + "55" : colors.glassBorder}`,
                              color: colors.text,
                            }}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="112.768..."
                            value={c.lng !== undefined ? c.lng : ""}
                            onChange={(e) => handleLngChange(o.outletCode, e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-mono outline-none"
                            style={{
                              background: colors.glassFill,
                              border: `1px solid ${hasCoord ? colors.mint + "55" : colors.glassBorder}`,
                              color: colors.text,
                            }}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {onPickOnMap && (
                              <button
                                onClick={() => onPickOnMap(o)}
                                className="sm-btn px-2 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                                style={{
                                  background: colors.blue + "1A",
                                  color: colors.blue,
                                  border: `1px solid ${colors.blue}33`,
                                }}
                                title="Tentukan / geser titik toko langsung di peta"
                              >
                                <MapPin size={11} />
                                {hasCoord ? "Geser di Map" : "Pilih di Map"}
                              </button>
                            )}
                            {hasCoord ? (
                              <div className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500">
                                <Check size={13} /> Ada
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGeocodeSingle(o)}
                                disabled={isGeocodingThis || !o.outletAddress}
                                className="sm-btn px-2 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-40"
                                style={{
                                  background: colors.violet + "1A",
                                  color: colors.violet,
                                  border: `1px solid ${colors.violet}33`,
                                }}
                                title={
                                  o.outletAddress
                                    ? "Cari koordinat via OpenStreetMap"
                                    : "Tidak ada alamat untuk dicari"
                                }
                              >
                                {isGeocodingThis ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <Sparkles size={11} />
                                )}
                                Auto
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 flex items-center justify-between"
          style={{
            borderTop: `1px solid ${colors.glassBorder}`,
            background: colors.colorScheme === "light" ? "#F8FAFC" : "#1E293B22",
          }}
        >
          <div className="text-xs" style={{ color: colors.textMuted }}>
            💡 <i>Tips: Anda bisa mengunduh template Excel, mengisi koordinat di Excel, lalu mengunggahnya kembali.</i>
          </div>
          <button
            onClick={onClose}
            className="sm-btn px-4 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorder}`,
              color: colors.text,
            }}
          >
            Tutup
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!geocodeConfirm}
        onCancel={() => setGeocodeConfirm(null)}
        onConfirm={runBatchGeocode}
        title="Cari koordinat otomatis?"
        subtitle={geocodeConfirm
          ? `Mencari koordinat untuk ${geocodeConfirm.targets.length} outlet via OpenStreetMap, sekitar ${geocodeConfirm.targets.length} detik (batas request server).`
          : ""}
        confirmLabel="Cari"
        variant="default"
        colors={colors}
      />
    </div>
  );
}
