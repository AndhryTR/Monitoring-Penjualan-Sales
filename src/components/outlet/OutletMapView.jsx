import { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin, Filter, Search, RotateCcw, AlertTriangle, Calendar,
} from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { OUTLET_STATUS_META } from "../../constants/thresholds.js";
import { DAY_LABELS, DAY_COLORS, DAYS_OF_WEEK } from "../../utils/visitScheduleStorage.js";
import { CustomSelect } from "../ui/CustomSelect.jsx";

/* ============================================================================
   OUTLET MAP VIEW (Fitur B4 - Peta Sebaran Outlet Interaktif)
   1. Render peta interaktif via Leaflet.js
   2. Marker pin kustom SVG dengan kode warna status (Aktif/Berisiko/Dormant)
   3. Tile layer adaptif (CartoDB Dark Matter untuk Dark, Positron untuk Light)
   4. Filter Sales, Filter Status, dan Pencarian Toko Cepat
   5. Popup interaktif dengan tombol "Lihat Rincian Toko"
   ============================================================================ */

const CARTODB_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTODB_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Default center (Pusat Jawa/Indonesia) jika belum ada koordinat
const DEFAULT_CENTER = [-7.250445, 112.768845]; // Surabaya default
const DEFAULT_ZOOM = 12;

function createPinIcon(color, isSelected = false) {
  const w = isSelected ? 32 : 26;
  const h = isSelected ? 40 : 34;

  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}"/>
      <circle cx="14" cy="14" r="5.5" fill="#FFFFFF"/>
      ${isSelected ? `<circle cx="14" cy="14" r="9" stroke="#FFFFFF" stroke-width="2" fill="none"/>` : ""}
    </svg>
  `;

  return L.divIcon({
    className: "custom-pin-marker",
    html: svg,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
}

export function OutletMapView({
  outlets = [],
  storedCoords = {},
  schedule = {},
  colors,
  depotName = "",
  onSelectOutlet,
  onOpenCoordinateModal,
  onOpenScheduleModal,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerGroupRef = useRef(null);
  const markersByCodeRef = useRef({});

  const [selectedSales, setSelectedSales] = useState("all");
  const [selectedDay, setSelectedDay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState({
    active: true,
    at_risk: true,
    dormant: true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const isDark = colors?.colorScheme !== "light";

  // Gabungkan data outlet dengan koordinat dari storedCoords
  const outletsWithCoords = useMemo(() => {
    return outlets.map((o) => {
      const c = storedCoords[o.outletCode];
      return {
        ...o,
        lat: c?.lat !== undefined ? c.lat : o.lat,
        lng: c?.lng !== undefined ? c.lng : o.lng,
        savedAddress: c?.address || o.outletAddress,
        hasCoord: (c?.lat !== undefined && c?.lng !== undefined) || (o.lat !== undefined && o.lng !== undefined),
      };
    });
  }, [outlets, storedCoords]);

  // Daftar sales unik untuk filter
  const salesOptions = useMemo(() => {
    const set = new Set();
    outlets.forEach((o) => {
      if (Array.isArray(o.salesNames)) {
        o.salesNames.forEach((name) => {
          if (name && name !== "-") set.add(name);
        });
      } else if (o.salesLabel && o.salesLabel !== "-") {
        set.add(o.salesLabel);
      }
    });
    return Array.from(set).sort();
  }, [outlets]);

  // Filter outlet yang aktif dan memiliki koordinat
  const visibleOutlets = useMemo(() => {
    return outletsWithCoords.filter((o) => {
      if (!o.hasCoord) return false;

      // Filter status
      if (o.status && selectedStatus[o.status] === false) return false;

      // Filter sales
      if (selectedSales !== "all") {
        let hasSales = false;
        if (Array.isArray(o.salesNames)) {
          hasSales = o.salesNames.includes(selectedSales);
        } else if (o.salesNames && typeof o.salesNames.has === "function") {
          hasSales = o.salesNames.has(selectedSales);
        } else if (typeof o.salesLabel === "string") {
          hasSales = o.salesLabel.includes(selectedSales);
        }
        if (!hasSales) return false;
      }

      // Filter hari kunjungan
      if (selectedDay !== "all") {
        const sched = schedule[o.outletCode];
        const assignedDay = sched?.day;
        if (selectedDay === "unassigned") {
          if (assignedDay) return false;
        } else {
          if (assignedDay !== selectedDay) return false;
        }
      }

      // Filter pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = o.outletName && o.outletName.toLowerCase().includes(q);
        const matchesCode = o.outletCode && o.outletCode.toLowerCase().includes(q);
        const matchesAddr = (o.outletAddress || o.savedAddress || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesAddr) return false;
      }

      return true;
    });
  }, [outletsWithCoords, selectedStatus, selectedSales, selectedDay, schedule, searchQuery]);

  // Statistik outlet
  const stats = useMemo(() => {
    const total = outlets.length;
    const mapped = outletsWithCoords.filter((o) => o.hasCoord).length;
    const missing = total - mapped;
    return { total, mapped, missing };
  }, [outlets, outletsWithCoords]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile layer
      const tileUrl = isDark ? CARTODB_DARK : CARTODB_LIGHT;
      const tileLayer = L.tileLayer(tileUrl, {
        attribution: TILE_ATTRIBUTION,
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Marker group
      const markerGroup = L.featureGroup().addTo(map);

      mapInstanceRef.current = map;
      tileLayerRef.current = tileLayer;
      markerGroupRef.current = markerGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markerGroupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update Tile Layer saat tema berubah (Dark <-> Light)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileUrl = isDark ? CARTODB_DARK : CARTODB_LIGHT;
    tileLayerRef.current.setUrl(tileUrl);
  }, [isDark]);

  // Handle klik tombol di dalam popup melalui event delegation
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleContainerClick = (e) => {
      const btn = e.target.closest("[data-action='view-outlet-detail']");
      if (btn) {
        const code = btn.getAttribute("data-outlet-code");
        const found = outlets.find((o) => o.outletCode === code);
        if (found && onSelectOutlet) {
          onSelectOutlet(found);
        }
      }
    };

    container.addEventListener("click", handleContainerClick);
    return () => container.removeEventListener("click", handleContainerClick);
  }, [outlets, onSelectOutlet]);

  // Update Markers saat visibleOutlets atau filter berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markersByCodeRef.current = {};

    if (visibleOutlets.length === 0) return;

    const bounds = L.latLngBounds([]);

    visibleOutlets.forEach((o) => {
      if (o.lat === undefined || o.lng === undefined) return;

      const meta = OUTLET_STATUS_META[o.status] || OUTLET_STATUS_META.unknown;
      const pinColor = colors[meta.color] || colors.blue;

      const icon = createPinIcon(pinColor);
      const marker = L.marker([o.lat, o.lng], { icon, title: o.outletName });

      // Konten Popup
      const statusBg = pinColor + "22";
      const sched = schedule[o.outletCode];
      const assignedDay = sched?.day;
      const dayLabel = assignedDay ? DAY_LABELS[assignedDay] : "Belum Dijadwalkan";
      const dayTheme = assignedDay ? DAY_COLORS[assignedDay] : null;
      const dayBadgeBg = dayTheme ? (isDark ? dayTheme.badge + "25" : dayTheme.lightBg) : (isDark ? "#33415533" : "#F1F5F9");
      const dayBadgeText = dayTheme ? (isDark ? dayTheme.badge : dayTheme.lightText) : colors.textMuted;
      const dayBorder = dayTheme ? (isDark ? dayTheme.badge + "55" : dayTheme.border) : (isDark ? "#475569" : "#CBD5E1");

      const popupHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;min-width:230px;max-width:280px;color:${isDark ? '#F1F5F9' : '#0F172A'};line-height:1.4;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${statusBg};color:${pinColor};border:1px solid ${pinColor}44;">
              ${meta.label}
            </span>
            <span style="font-size:10px;color:${colors.textMuted};font-family:monospace;">
              ${o.outletCode}
            </span>
          </div>

          <div style="font-size:13px;font-weight:700;margin-bottom:4px;color:${isDark ? '#F8FAFC' : '#0F172A'};">
            ${o.outletName}
          </div>

          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;background:${dayBadgeBg};color:${dayBadgeText};border:1px solid ${dayBorder};">
              📅 ${dayLabel}
            </span>
            ${sched?.areaCode ? `
              <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:6px;background:${isDark ? '#1E293B' : '#F1F5F9'};color:${colors.textMuted};border:1px solid ${colors.glassBorder};">
                Wilayah: <b>${sched.areaCode}</b>
              </span>
            ` : ''}
          </div>

          <div style="font-size:11px;color:${colors.textMuted};margin-bottom:8px;">
            👤 Sales: <b>${o.salesLabel || '-'}</b>
          </div>

          ${o.outletAddress ? `
            <div style="font-size:10.5px;color:${colors.textMuted};background:${isDark ? '#1E293B' : '#F1F5F9'};padding:5px 8px;border-radius:6px;margin-bottom:8px;">
              📍 ${o.outletAddress}
            </div>
          ` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:11px;">
            <div style="background:${isDark ? '#1E293B' : '#F8FAFC'};padding:5px 7px;border-radius:6px;">
              <div style="font-size:9.5px;color:${colors.textMuted};">Total Beli</div>
              <div style="font-weight:700;color:${colors.mint};">${fmtRp(o.value)}</div>
            </div>
            <div style="background:${isDark ? '#1E293B' : '#F8FAFC'};padding:5px 7px;border-radius:6px;">
              <div style="font-size:9.5px;color:${colors.textMuted};">Frekuensi</div>
              <div style="font-weight:700;">${fmtNum(o.invoiceCount)}× (${o.daysSinceLastPurchase !== null ? `${o.daysSinceLastPurchase} hr lalu` : '-'})</div>
            </div>
          </div>

          <button
            data-action="view-outlet-detail"
            data-outlet-code="${o.outletCode}"
            style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:${colors.blue};color:#FFFFFF;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;"
          >
            Lihat Detail Toko & Produk ➔
          </button>
        </div>
      `;

      const popup = L.popup({
        className: isDark ? "dark-leaflet-popup" : "light-leaflet-popup",
        closeButton: true,
        offset: [0, -10],
      }).setContent(popupHtml);

      marker.bindPopup(popup);

      group.addLayer(marker);
      markersByCodeRef.current[o.outletCode] = marker;
      bounds.extend([o.lat, o.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [visibleOutlets, colors, isDark, schedule]);

  // Reset Zoom / Fit All Outlets
  const handleResetZoom = () => {
    const map = mapInstanceRef.current;
    const group = markerGroupRef.current;
    if (map && group && group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }
  };

  // Zoom ke toko tertentu saat diklik di list pencarian
  const handleSelectSearchResult = (outlet) => {
    const map = mapInstanceRef.current;
    const marker = markersByCodeRef.current[outlet.outletCode];
    if (map && marker) {
      map.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Control Panel */}
      <div
        className="sm-card p-4 flex flex-wrap items-center justify-between gap-3"
        style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
      >
        <div className="flex items-center flex-wrap gap-2.5">
          {depotName ? (
            <span
              className="text-[11px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider"
              style={{ background: colors.blue + "1A", color: colors.blue, border: `1px solid ${colors.blue}33` }}
            >
              {depotName}
            </span>
          ) : null}

          {/* Sales Dropdown */}
          <CustomSelect
            value={selectedSales}
            onChange={setSelectedSales}
            icon={Filter}
            colors={colors}
            size="sm"
            searchable={true}
            searchPlaceholder="Cari sales..."
            menuWidth={240}
            options={[
              { value: "all", label: `Semua Sales (${salesOptions.length})` },
              ...salesOptions.map((name) => ({ value: name, label: name })),
            ]}
          />

          {/* Hari Kunjungan Dropdown */}
          <CustomSelect
            value={selectedDay}
            onChange={setSelectedDay}
            icon={Calendar}
            colors={colors}
            size="sm"
            searchable={false}
            menuWidth={190}
            options={[
              { value: "all", label: "Semua Hari" },
              ...DAYS_OF_WEEK.map((day) => ({ value: day, label: DAY_LABELS[day] })),
              { value: "unassigned", label: "Belum Dijadwalkan" },
            ]}
          />

          {/* Status Checkboxes */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedStatus((s) => ({ ...s, active: !s.active }))}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedStatus.active ? "opacity-100 shadow-sm" : "opacity-40"
              }`}
              style={{
                background: colors.mint + "20",
                color: colors.mint,
                border: `1px solid ${colors.mint}44`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: colors.mint }} />
              Aktif
            </button>

            <button
              onClick={() => setSelectedStatus((s) => ({ ...s, at_risk: !s.at_risk }))}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedStatus.at_risk ? "opacity-100 shadow-sm" : "opacity-40"
              }`}
              style={{
                background: colors.gold + "20",
                color: colors.gold,
                border: `1px solid ${colors.gold}44`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: colors.gold }} />
              Berisiko
            </button>

            <button
              onClick={() => setSelectedStatus((s) => ({ ...s, dormant: !s.dormant }))}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedStatus.dormant ? "opacity-100 shadow-sm" : "opacity-40"
              }`}
              style={{
                background: colors.coral + "20",
                color: colors.coral,
                border: `1px solid ${colors.coral}44`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: colors.coral }} />
              Dormant
            </button>
          </div>
        </div>

        {/* Quick Search & Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            />
            <input
              type="text"
              placeholder="Cari toko di peta (Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visibleOutlets.length > 0) {
                  handleSelectSearchResult(visibleOutlets[0]);
                }
              }}
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none w-44 sm:w-56"
              style={{
                background: colors.glassFill,
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
            />
          </div>

          <button
            onClick={handleResetZoom}
            className="sm-btn p-2 rounded-xl text-xs font-medium inline-flex items-center gap-1"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorder}`,
              color: colors.text,
            }}
            title="Reset Zoom / Lihat Seluruh Titik"
          >
            <RotateCcw size={14} />
          </button>

          {onOpenScheduleModal && (
            <button
              onClick={onOpenScheduleModal}
              className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              style={{
                background: colors.mint + "1A",
                border: `1px solid ${colors.mint}44`,
                color: colors.mint,
              }}
              title="Atur Rencana Pola Kunjungan (RPK)"
            >
              <Calendar size={14} />
              Jadwal Kunjungan
            </button>
          )}

          <button
            onClick={onOpenCoordinateModal}
            className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            style={{
              background: colors.blue + "1A",
              border: `1px solid ${colors.blue}44`,
              color: colors.blue,
            }}
          >
            <MapPin size={14} />
            Kelola Koordinat ({stats.mapped}/{stats.total})
          </button>
        </div>
      </div>

      {/* Warning Banner jika banyak koordinat belum ada */}
      {stats.missing > 0 && (
        <div
          className="p-3 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2"
          style={{
            background: colors.gold + "15",
            border: `1px solid ${colors.gold}33`,
            color: colors.gold,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>
              <b>{stats.missing} dari {stats.total} outlet</b> belum memiliki koordinat GPS sehingga tidak tampil di peta.
            </span>
          </div>
          <button
            onClick={onOpenCoordinateModal}
            className="underline font-bold hover:opacity-80"
          >
            Lengkapi Koordinat Sekarang →
          </button>
        </div>
      )}

      {/* Leaflet Map Container */}
      <div
        className="relative w-full h-[580px] rounded-2xl overflow-hidden shadow-inner border"
        style={{ borderColor: colors.glassBorder }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Empty State Overlay jika 0 koordinat */}
        {stats.mapped === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/50 backdrop-blur-sm text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white shadow-xl"
              style={{ background: colors.gold }}
            >
              <MapPin size={32} />
            </div>
            <div className="text-base font-bold text-white mb-2">
              Belum Ada Koordinat GPS Outlet Terdaftar
            </div>
            <p className="text-xs text-slate-300 max-w-md mb-5 leading-relaxed">
              Agar sebaran toko dapat muncul di peta interaktif, Anda dapat mengunggah file Excel master koordinat atau memanfaatkan fitur pencarian otomatis (auto-geocoding).
            </p>
            <button
              onClick={onOpenCoordinateModal}
              className="sm-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg inline-flex items-center gap-2"
              style={{ background: colors.mint }}
            >
              <MapPin size={15} /> Buka Pengelola Koordinat Outlet
            </button>
          </div>
        )}

        {/* Floating Legend di Kanan Bawah */}
        <div
          className="absolute bottom-4 left-4 z-[400] p-2.5 rounded-xl shadow-lg backdrop-blur-md text-[11px] flex items-center gap-3"
          style={{
            background: isDark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.92)",
            border: `1px solid ${colors.glassBorder}`,
            color: colors.text,
          }}
        >
          <div className="font-bold text-[10px] uppercase tracking-wider" style={{ color: colors.textMuted }}>
            Status:
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.mint }} />
            <span>Aktif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.gold }} />
            <span>Berisiko</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.coral }} />
            <span>Dormant</span>
          </div>
          <div className="border-l pl-3" style={{ borderColor: colors.glassBorder, color: colors.textMuted }}>
            {visibleOutlets.length} toko terlihat
          </div>
        </div>
      </div>
    </div>
  );
}
