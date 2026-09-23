import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin, Filter, Search, RotateCcw, AlertTriangle, Calendar,
  Navigation, Check, X, CheckCircle2,
  Crosshair, AlertCircle,
} from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { OUTLET_STATUS_META } from "../../constants/thresholds.js";
import { DAY_LABELS, DAY_COLORS, DAYS_OF_WEEK } from "../../utils/visitScheduleStorage.js";
import { setSingleCoordinate } from "../../utils/geoStorage.js";
import { CustomSelect } from "../ui/CustomSelect.jsx";

/* ============================================================================
   OUTLET MAP VIEW (Fitur B4 - Peta Sebaran Outlet Interaktif)
   1. Render peta interaktif via Leaflet.js
   2. Marker pin kustom SVG dengan kode warna status (Aktif/Berisiko/Dormant)
   3. Tile layer adaptif (Carto Dark/Light, Street Voyager, & Satellite Esri)
   4. Filter Sales, Filter Status, dan Pencarian Toko Cepat
   5. Popup interaktif dengan tombol "Lihat Detail" & "Geser Pin"
   6. Fitur Pointing & Dragging Koordinat Toko langsung di peta (Google Maps style)
   ============================================================================ */

const OSM_STREETS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const TILE_ATTRIBUTION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILE_ATTRIBUTION_ESRI = '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';

// Default center (Pusat Jawa/Indonesia) jika belum ada koordinat
const DEFAULT_CENTER = [-7.250445, 112.768845]; // Surabaya default
const DEFAULT_ZOOM = 12;

function createPinIcon(color, isSelected = false, stopNumber = null) {
  const w = isSelected ? 34 : (stopNumber ? 30 : 26);
  const h = isSelected ? 42 : (stopNumber ? 38 : 34);

  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}"/>
      <circle cx="14" cy="14" r="${stopNumber ? "7" : "5.5"}" fill="#FFFFFF"/>
      ${stopNumber !== null ? `<text x="14" y="17.5" text-anchor="middle" font-size="9" font-family="-apple-system,sans-serif" font-weight="bold" fill="${color}">${stopNumber}</text>` : ""}
      ${isSelected ? `<circle cx="14" cy="14" r="10" stroke="#FFFFFF" stroke-width="2" fill="none"/>` : ""}
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

function computeRoutePath(outlets) {
  if (!outlets || outlets.length < 2) return { route: outlets || [], totalDistanceKm: 0 };

  const getDist = (a, b) => {
    const R = 6371; // km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const aHarv =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
    return R * c;
  };

  const remaining = [...outlets];
  const route = [remaining.shift()];
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = getDist(current, remaining[i]);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    totalDistanceKm += minD;
    route.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return { route, totalDistanceKm: Number(totalDistanceKm.toFixed(1)) };
}

function createDraggablePinIcon() {
  const w = 38;
  const h = 48;
  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 12px rgba(239, 68, 68, 0.6));">
      <path d="M19 0C8.507 0 0 8.507 0 19C0 33.25 19 48 19 48C19 48 38 33.25 38 19C38 8.507 29.493 0 19 0Z" fill="#EF4444"/>
      <circle cx="19" cy="19" r="8" fill="#FFFFFF"/>
      <circle cx="19" cy="19" r="4.5" fill="#EF4444"/>
      <circle cx="19" cy="19" r="14" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="3 3" fill="none"/>
    </svg>
  `;
  return L.divIcon({
    className: "custom-draggable-pin-marker",
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
  pointingOutlet = null,
  onClearPointingOutlet,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerGroupRef = useRef(null);
  const markersByCodeRef = useRef({});
  const pointingMarkerRef = useRef(null);

  const [selectedSales, setSelectedSales] = useState("all");
  const [selectedDay, setSelectedDay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState({
    active: true,
    at_risk: true,
    dormant: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showRoute, setShowRoute] = useState(false);

  // Map layer toggle: "auto" | "streets" | "satellite"
  const [mapLayer, setMapLayer] = useState("auto");

  // Active Pointing / Dragging State
  const [activePointingOutlet, setActivePointingOutlet] = useState(null);
  const [pointingCoords, setPointingCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Outlet Picker Modal for Pointing
  const [showOutletPicker, setShowOutletPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState("missing");

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

  // Kalkulasi rute urutan kunjungan salesmen (Nearest Neighbor TSP)
  const routeInfo = useMemo(() => {
    if (!showRoute || visibleOutlets.length < 2) {
      return { route: visibleOutlets, totalDistanceKm: 0, orderMap: {} };
    }
    const { route, totalDistanceKm } = computeRoutePath(visibleOutlets);
    const orderMap = {};
    route.forEach((o, idx) => {
      orderMap[o.outletCode] = idx + 1;
    });
    return { route, totalDistanceKm, orderMap };
  }, [showRoute, visibleOutlets]);

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
      const isDarkTheme = isDark && mapLayer === "auto";
      let initialTileUrl = OSM_STREETS;
      let initialAttr = TILE_ATTRIBUTION_OSM;
      if (mapLayer === "satellite") {
        initialTileUrl = ESRI_SATELLITE;
        initialAttr = TILE_ATTRIBUTION_ESRI;
      }

      const tileLayer = L.tileLayer(initialTileUrl, {
        attribution: initialAttr,
        subdomains: "abc",
        maxZoom: 19,
        className: isDarkTheme ? "leaflet-dark-tiles" : "",
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
        pointingMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update Tile Layer saat mapLayer atau tema berubah
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const isDarkTheme = isDark && mapLayer === "auto";
    let tileUrl = OSM_STREETS;
    if (mapLayer === "satellite") {
      tileUrl = ESRI_SATELLITE;
    }
    tileLayerRef.current.setUrl(tileUrl);

    const container = tileLayerRef.current.getContainer();
    if (container) {
      if (isDarkTheme) {
        container.classList.add("leaflet-dark-tiles");
      } else {
        container.classList.remove("leaflet-dark-tiles");
      }
    }
  }, [mapLayer, isDark]);

  // Handler masuk ke mode Pointing / Geser untuk outlet tertentu
  const startPointingOutlet = useCallback((outlet) => {
    if (!outlet) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    map.closePopup();

    const currentData = outletsWithCoords.find((o) => o.outletCode === outlet.outletCode) || outlet;
    setActivePointingOutlet(currentData);

    let targetLat = currentData.lat;
    let targetLng = currentData.lng;

    // Jika belum punya koordinat, gunakan center peta saat ini atau DEFAULT_CENTER
    if (targetLat === undefined || targetLng === undefined) {
      const center = map.getCenter();
      targetLat = Number(center.lat.toFixed(6));
      targetLng = Number(center.lng.toFixed(6));
    }

    setPointingCoords({ lat: targetLat, lng: targetLng });

    // Hapus marker pointing lama jika ada
    if (pointingMarkerRef.current) {
      pointingMarkerRef.current.remove();
      pointingMarkerRef.current = null;
    }

    // Buat marker draggable Google Maps style
    const pMarker = L.marker([targetLat, targetLng], {
      draggable: true,
      icon: createDraggablePinIcon(),
      autoPan: true,
      zIndexOffset: 1000,
    });

    pMarker.bindTooltip(
      `<b>${currentData.outletName}</b><br/>Tahan & geser pin ini, atau klik peta untuk pindah`,
      {
        permanent: true,
        direction: "top",
        offset: [0, -44],
        className: "custom-pin-tooltip",
      }
    ).openTooltip();

    pMarker.on("drag", (e) => {
      const pos = e.target.getLatLng();
      setPointingCoords({
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
      });
    });

    pMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      setPointingCoords({
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
      });
    });

    pMarker.addTo(map);
    pointingMarkerRef.current = pMarker;

    // Arahkan kamera ke lokasi
    map.setView([targetLat, targetLng], Math.max(map.getZoom(), 16), { animate: true });
  }, [outletsWithCoords]);

  // Tangani prop external pointingOutlet jika dikirim dari komponen induk
  useEffect(() => {
    if (pointingOutlet) {
      startPointingOutlet(pointingOutlet);
    }
  }, [pointingOutlet, startPointingOutlet]);

  // Leaflet Map Click Listener untuk Pointing Instan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (!activePointingOutlet) return;
      const clickedLat = Number(e.latlng.lat.toFixed(6));
      const clickedLng = Number(e.latlng.lng.toFixed(6));

      setPointingCoords({ lat: clickedLat, lng: clickedLng });

      if (pointingMarkerRef.current) {
        pointingMarkerRef.current.setLatLng([clickedLat, clickedLng]);
      } else {
        const pMarker = L.marker([clickedLat, clickedLng], {
          draggable: true,
          icon: createDraggablePinIcon(),
          autoPan: true,
          zIndexOffset: 1000,
        });
        pMarker.bindTooltip(
          `<b>${activePointingOutlet.outletName}</b><br/>Tahan & geser pin ini, atau klik peta untuk pindah`,
          {
            permanent: true,
            direction: "top",
            offset: [0, -44],
            className: "custom-pin-tooltip",
          }
        ).openTooltip();

        pMarker.on("drag", (evt) => {
          const pos = evt.target.getLatLng();
          setPointingCoords({
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          });
        });
        pMarker.on("dragend", (evt) => {
          const pos = evt.target.getLatLng();
          setPointingCoords({
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          });
        });

        pMarker.addTo(map);
        pointingMarkerRef.current = pMarker;
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [activePointingOutlet]);

  // Handle klik tombol di dalam popup melalui event delegation
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleContainerClick = (e) => {
      // Tombol Detail Toko
      const detailBtn = e.target.closest("[data-action='view-outlet-detail']");
      if (detailBtn) {
        const code = detailBtn.getAttribute("data-outlet-code");
        const found = outlets.find((o) => o.outletCode === code);
        if (found && onSelectOutlet) {
          onSelectOutlet(found);
        }
        return;
      }

      // Tombol Geser Titik di Map
      const editBtn = e.target.closest("[data-action='edit-outlet-location']");
      if (editBtn) {
        const code = editBtn.getAttribute("data-outlet-code");
        const found = outletsWithCoords.find((o) => o.outletCode === code) || outlets.find((o) => o.outletCode === code);
        if (found) {
          startPointingOutlet(found);
        }
      }
    };

    container.addEventListener("click", handleContainerClick);
    return () => container.removeEventListener("click", handleContainerClick);
  }, [outlets, outletsWithCoords, onSelectOutlet, startPointingOutlet]);

  // Update Markers saat visibleOutlets atau filter berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markersByCodeRef.current = {};

    if (visibleOutlets.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Visualisasikan garis rute kunjungan jika mode rute diaktifkan
    if (showRoute && routeInfo.route.length >= 2) {
      const latlngs = routeInfo.route.map((o) => [o.lat, o.lng]);
      const polyline = L.polyline(latlngs, {
        color: colors.blue || "#3B82F6",
        weight: 3.5,
        dashArray: "6, 8",
        opacity: 0.85,
      });
      group.addLayer(polyline);
    }

    visibleOutlets.forEach((o) => {
      if (o.lat === undefined || o.lng === undefined) return;

      // Jika toko ini sedang di-pointing, sembunyikan marker regulernya agar tidak tumpang tindih
      if (activePointingOutlet && activePointingOutlet.outletCode === o.outletCode) {
        bounds.extend([o.lat, o.lng]);
        return;
      }

      const meta = OUTLET_STATUS_META[o.status] || OUTLET_STATUS_META.unknown;
      const pinColor = colors[meta.color] || colors.blue;
      const stopNumber = showRoute ? (routeInfo.orderMap[o.outletCode] || null) : null;

      const icon = createPinIcon(pinColor, false, stopNumber);
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
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${statusBg};color:${pinColor};border:1px solid ${pinColor}44;">
                ${meta.label}
              </span>
              ${o.paretoClass ? `
                <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:${o.paretoClass === 'A' ? colors.gold + '22' : o.paretoClass === 'B' ? colors.blue + '22' : colors.glassFill};color:${o.paretoClass === 'A' ? colors.gold : o.paretoClass === 'B' ? colors.blue : colors.textMuted};border:1px solid ${o.paretoClass === 'A' ? colors.gold + '55' : o.paretoClass === 'B' ? colors.blue + '55' : colors.glassBorder};">
                  ${o.paretoClass === 'A' ? '👑 [A]' : o.paretoClass === 'B' ? '🔷 [B]' : '⚪ [C]'}
                </span>
              ` : ''}
            </div>
            <span style="font-size:10px;color:${colors.textMuted};font-family:monospace;">
              ${o.outletCode}
            </span>
          </div>

          <div style="font-size:13px;font-weight:700;margin-bottom:4px;color:${isDark ? '#F8FAFC' : '#0F172A'};">
            ${o.outletName}
          </div>

          ${stopNumber ? `
            <div style="font-size:11px;font-weight:700;color:${colors.blue};margin-bottom:6px;display:flex;align-items:center;gap:4px;">
              🚩 Urutan Kunjungan: Stop #${stopNumber}
            </div>
          ` : ''}

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

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button
              data-action="edit-outlet-location"
              data-outlet-code="${o.outletCode}"
              style="display:flex;align-items:center;justify-content:center;gap:4px;background:${colors.mint};color:#FFFFFF;border:none;border-radius:8px;padding:6px 8px;font-size:11px;font-weight:700;cursor:pointer;"
              title="Geser posisi titik toko ini langsung di peta"
            >
              📍 Geser Titik
            </button>
            <button
              data-action="view-outlet-detail"
              data-outlet-code="${o.outletCode}"
              style="display:flex;align-items:center;justify-content:center;gap:4px;background:${colors.blue};color:#FFFFFF;border:none;border-radius:8px;padding:6px 8px;font-size:11px;font-weight:600;cursor:pointer;"
            >
              Detail Toko ➔
            </button>
          </div>
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

    if (bounds.isValid() && !activePointingOutlet) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [visibleOutlets, colors, isDark, schedule, activePointingOutlet, showRoute, routeInfo]);

  // Pusatkan peta dan buka popup outlet dari hasil pencarian
  const handleSelectSearchResult = useCallback((outlet) => {
    const map = mapInstanceRef.current;
    if (!map || !outlet || outlet.lat === undefined || outlet.lng === undefined) return;
    map.setView([outlet.lat, outlet.lng], 16, { animate: true });
    const marker = markersByCodeRef.current[outlet.outletCode];
    if (marker) {
      marker.openPopup();
    }
  }, []);

  // Reset Zoom / Fit All Outlets
  const handleResetZoom = () => {
    const map = mapInstanceRef.current;
    const group = markerGroupRef.current;
    if (map && group && group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }
  };

  // Simpan perubahan koordinat dari Pointing / Dragging
  const handleSavePointingLocation = () => {
    if (!activePointingOutlet || !pointingCoords) return;

    try {
      const ok = setSingleCoordinate(depotName, activePointingOutlet.outletCode, {
        lat: pointingCoords.lat,
        lng: pointingCoords.lng,
        address: activePointingOutlet.outletAddress || activePointingOutlet.savedAddress || "",
      });

      if (ok) {
        setSaveStatus({
          type: "success",
          text: `Titik koordinat ${activePointingOutlet.outletName} berhasil disimpan!`,
        });

        // Bersihkan marker pointing
        if (pointingMarkerRef.current) {
          pointingMarkerRef.current.remove();
          pointingMarkerRef.current = null;
        }
        setActivePointingOutlet(null);
        setPointingCoords(null);
        if (onClearPointingOutlet) onClearPointingOutlet();

        setTimeout(() => setSaveStatus(null), 3500);
      } else {
        throw new Error("Gagal menyimpan koordinat ke storage.");
      }
    } catch (err) {
      setSaveStatus({
        type: "error",
        text: `Error: ${err.message}`,
      });
    }
  };

  // Batalkan mode pointing
  const handleCancelPointing = () => {
    if (pointingMarkerRef.current) {
      pointingMarkerRef.current.remove();
      pointingMarkerRef.current = null;
    }
    setActivePointingOutlet(null);
    setPointingCoords(null);
    if (onClearPointingOutlet) onClearPointingOutlet();
  };

  // Deteksi lokasi GPS pengguna saat ini
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung geolokasi GPS.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setPointingCoords({ lat, lng });

        const map = mapInstanceRef.current;
        if (map) {
          map.setView([lat, lng], 17, { animate: true });
          if (pointingMarkerRef.current) {
            pointingMarkerRef.current.setLatLng([lat, lng]);
          }
        }
      },
      (err) => {
        setIsLocating(false);
        alert(`Gagal membaca sinyal GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filter daftar outlet untuk Picker modal
  const filteredPickerOutlets = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return outletsWithCoords.filter((o) => {
      if (pickerFilter === "missing" && o.hasCoord) return false;
      if (!q) return true;
      return (
        (o.outletName && o.outletName.toLowerCase().includes(q)) ||
        (o.outletCode && o.outletCode.toLowerCase().includes(q)) ||
        (o.salesLabel && o.salesLabel.toLowerCase().includes(q)) ||
        (o.outletAddress && o.outletAddress.toLowerCase().includes(q))
      );
    });
  }, [outletsWithCoords, pickerSearch, pickerFilter]);

  return (
    <div className="space-y-4">
      {/* Feedback Toast Notification */}
      {saveStatus && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 shadow-lg transition-all ${
            saveStatus.type === "success"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {saveStatus.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="font-semibold">{saveStatus.text}</span>
          </div>
          <button
            onClick={() => setSaveStatus(null)}
            className="p-1 hover:opacity-80 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none w-44 sm:w-52"
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

          {/* Tombol Pointing Toko Langsung di Map */}
          <button
            onClick={() => setShowOutletPicker(true)}
            className="sm-btn px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity"
            style={{
              background: colors.coral + "22",
              border: `1px solid ${colors.coral}55`,
              color: colors.coral,
            }}
            title="Tentukan titik toko baru atau ubah titik toko langsung di peta"
          >
            <Crosshair size={14} />
            Pointing Toko {stats.missing > 0 ? `(${stats.missing})` : ""}
          </button>

          {/* Tombol Visualisasi Rute Kunjungan */}
          <button
            onClick={() => setShowRoute((v) => !v)}
            disabled={visibleOutlets.length < 2}
            className={`sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
              showRoute ? "shadow-sm font-bold" : "opacity-85 hover:opacity-100"
            }`}
            style={{
              background: showRoute ? (colors.blue || "#3B82F6") : colors.glassFill,
              border: `1px solid ${showRoute ? (colors.blue || "#3B82F6") : colors.glassBorder}`,
              color: showRoute ? "#FFFFFF" : colors.text,
            }}
            title={visibleOutlets.length < 2 ? "Butuh minimal 2 outlet bertitik untuk menampilkan alur rute" : "Visualisasikan alur rute kunjungan call sheet"}
          >
            <Navigation size={14} className={showRoute ? "animate-pulse" : ""} />
            {showRoute ? `Rute (${routeInfo.totalDistanceKm} km)` : "Rute Kunjungan"}
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
      {stats.missing > 0 && !activePointingOutlet && (
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOutletPicker(true)}
              className="font-bold underline hover:opacity-80 flex items-center gap-1"
            >
              <Crosshair size={13} /> Pointing di Peta Sekarang →
            </button>
            <span className="opacity-40">|</span>
            <button
              onClick={onOpenCoordinateModal}
              className="hover:underline opacity-90"
            >
              Tabel Koordinat
            </button>
          </div>
        </div>
      )}

      {/* Leaflet Map Container */}
      <div
        className={`relative w-full h-[600px] rounded-2xl overflow-hidden shadow-inner border ${
          activePointingOutlet ? "pointing-active-map" : ""
        }`}
        style={{ borderColor: colors.glassBorder }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* FLOATING POINTING & DRAGGING CONTROL BAR (Ketika mode pointing aktif) */}
        {activePointingOutlet && pointingCoords && (
          <div className="absolute top-3 left-3 right-3 z-[450] sm-card sm-scale-in p-3 sm:p-4 rounded-xl shadow-2xl backdrop-blur-md border border-white/20 bg-slate-900/90 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0 animate-pulse">
                <Crosshair size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate text-white">
                    {activePointingOutlet.outletName}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                    {activePointingOutlet.outletCode}
                  </span>
                </div>
                <div className="text-xs text-slate-300 truncate">
                  👤 Sales: <b>{activePointingOutlet.salesLabel || "-"}</b>
                  {activePointingOutlet.outletAddress && (
                    <span className="ml-2 opacity-80">· 📍 {activePointingOutlet.outletAddress}</span>
                  )}
                </div>
                <div className="text-[11px] font-mono mt-0.5 flex items-center gap-2 text-emerald-400">
                  <span>Lat: <b>{pointingCoords.lat}</b></span>
                  <span>Lng: <b>{pointingCoords.lng}</b></span>
                  <span className="text-slate-400 text-[10px] italic hidden sm:inline">
                    (Geser pin merah atau klik peta)
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Pointing */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              <button
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40"
                title="Gunakan posisi GPS perangkat Anda saat ini"
              >
                <Navigation size={13} className={isLocating ? "animate-spin" : ""} />
                {isLocating ? "Mencari GPS..." : "GPS Saya"}
              </button>

              <button
                onClick={handleSavePointingLocation}
                className="sm-btn px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
                title="Simpan koordinat ini untuk outlet terpilih"
              >
                <Check size={14} /> Simpan Lokasi
              </button>

              <button
                onClick={handleCancelPointing}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-slate-300"
                title="Batalkan perubahan"
              >
                <X size={14} /> Batal
              </button>
            </div>
          </div>
        )}

        {/* FLOATING MAP LAYER SWITCHER (Google Maps Style: Auto, Street, Satelit) */}
        <div
          className="absolute top-4 right-4 z-[400] p-1 rounded-xl shadow-lg backdrop-blur-md text-xs flex items-center gap-1"
          style={{
            background: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${colors.glassBorder}`,
            color: colors.text,
          }}
        >
          <button
            onClick={() => setMapLayer("auto")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              mapLayer === "auto" ? "bg-blue-600 text-white shadow-sm" : "hover:opacity-80"
            }`}
            style={mapLayer !== "auto" ? { color: colors.textMuted } : {}}
            title="Tampilan peta default (Dark/Light Carto)"
          >
            Tema
          </button>
          <button
            onClick={() => setMapLayer("streets")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              mapLayer === "streets" ? "bg-blue-600 text-white shadow-sm" : "hover:opacity-80"
            }`}
            style={mapLayer !== "streets" ? { color: colors.textMuted } : {}}
            title="Tampilan jalan raya & bangunan detail (Voyager)"
          >
            Jalan
          </button>
          <button
            onClick={() => setMapLayer("satellite")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              mapLayer === "satellite" ? "bg-blue-600 text-white shadow-sm" : "hover:opacity-80"
            }`}
            style={mapLayer !== "satellite" ? { color: colors.textMuted } : {}}
            title="Tampilan citra satelit resolusi tinggi (Esri)"
          >
            Satelit
          </button>
        </div>

        {/* Empty State Overlay jika 0 koordinat dan tidak sedang pointing */}
        {stats.mapped === 0 && !activePointingOutlet && (
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
              Agar sebaran toko dapat muncul di peta interaktif, Anda dapat melakukan pointing langsung di peta, mengunggah file Excel master koordinat, atau auto-geocoding.
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => setShowOutletPicker(true)}
                className="sm-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg inline-flex items-center gap-2"
                style={{ background: colors.coral }}
              >
                <Crosshair size={15} /> Pointing Toko di Peta
              </button>
              <button
                onClick={onOpenCoordinateModal}
                className="sm-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg inline-flex items-center gap-2"
                style={{ background: colors.mint }}
              >
                <MapPin size={15} /> Buka Pengelola Koordinat
              </button>
            </div>
          </div>
        )}

        {/* Floating Legend di Kiri Bawah */}
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

      {/* MODAL PICKER TOKO UNTUK POINTING */}
      {showOutletPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm-fadein">
          <div
            className="sm-card sm-modal-glass sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: colors.colorScheme === "light" ? "#FFFFFF" : "#0F172A",
              border: `1px solid ${colors.glassBorder}`,
            }}
          >
            {/* Header Modal */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl shrink-0"
                  style={{ background: colors.coral + "22", color: colors.coral }}
                >
                  <Crosshair size={20} />
                </div>
                <div>
                  <div className="disp text-sm font-bold" style={{ color: colors.text }}>
                    Pilih Toko untuk Ditentukan Titiknya di Peta
                  </div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    Pilih toko di bawah, lalu klik atau geser pin langsung pada peta (seperti Google Maps).
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowOutletPicker(false)}
                className="p-2 rounded-full hover:opacity-80 transition-opacity"
                style={{ background: colors.glassFill, color: colors.textMuted }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div
              className="p-3 flex flex-wrap items-center justify-between gap-2.5"
              style={{
                background: colors.colorScheme === "light" ? "#F8FAFC" : "#1E293B44",
                borderBottom: `1px solid ${colors.glassBorder}`,
              }}
            >
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: colors.textMuted }}
                />
                <input
                  type="text"
                  placeholder="Cari nama toko, kode, sales, atau alamat..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none"
                  style={{
                    background: colors.glassFill,
                    border: `1px solid ${colors.glassBorder}`,
                    color: colors.text,
                  }}
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setPickerFilter("missing")}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                    pickerFilter === "missing" ? "bg-amber-600 text-white" : ""
                  }`}
                  style={pickerFilter !== "missing" ? { background: colors.glassFill, color: colors.textMuted } : {}}
                >
                  Belum Punya Titik ({stats.missing})
                </button>
                <button
                  onClick={() => setPickerFilter("all")}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                    pickerFilter === "all" ? "bg-blue-600 text-white" : ""
                  }`}
                  style={pickerFilter !== "all" ? { background: colors.glassFill, color: colors.textMuted } : {}}
                >
                  Semua Outlet ({stats.total})
                </button>
              </div>
            </div>

            {/* List Outlet */}
            <div className="flex-1 overflow-y-auto p-3 divide-y" style={{ borderColor: colors.glassBorder }}>
              {filteredPickerOutlets.length === 0 ? (
                <div className="p-10 text-center text-xs" style={{ color: colors.textMuted }}>
                  Tidak ada toko yang cocok dengan filter atau pencarian.
                </div>
              ) : (
                filteredPickerOutlets.map((o) => (
                  <div
                    key={o.outletCode}
                    className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs truncate" style={{ color: colors.text }}>
                          {o.outletName}
                        </span>
                        <span className="text-[10px] font-mono opacity-60" style={{ color: colors.textMuted }}>
                          {o.outletCode}
                        </span>
                        {o.hasCoord ? (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            Sudah Ada Titik
                          </span>
                        ) : (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            Belum Ada Titik
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] flex items-center gap-2 mt-0.5" style={{ color: colors.textMuted }}>
                        <span>👤 Sales: <b>{o.salesLabel || "-"}</b></span>
                        {o.outletAddress && (
                          <span className="truncate opacity-80">· 📍 {o.outletAddress}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowOutletPicker(false);
                        startPointingOutlet(o);
                      }}
                      className="sm-btn px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity"
                      style={{
                        background: colors.coral + "22",
                        color: colors.coral,
                        border: `1px solid ${colors.coral}44`,
                      }}
                    >
                      <Crosshair size={13} />
                      {o.hasCoord ? "Ubah Titik" : "Letakkan Titik"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
