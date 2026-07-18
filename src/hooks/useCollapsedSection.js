import { useCallback, useState } from "react";
import { loadCollapsedSections, saveCollapsedSections } from "../utils/storage.js";

/* ============================================================================
   useCollapsedSection
   State ciut/buka untuk SATU section (tabel, leaderboard, chart, dll), dengan
   status disimpan permanen ke localStorage lintas sesi (lihat utils/storage.js
   — satu blob JSON dipakai bersama untuk semua section, keyed by `id`).

   `id` HARUS unik di seluruh app (mis. "salesReport.detailGrup").
   `defaultOpen` cuma dipakai kalau section itu BELUM PERNAH di-toggle user.

   Baca localStorage dilakukan lazy sekali saat mount (bukan tiap render), dan
   ditulis ulang (read-merge-write) tiap kali toggle supaya tidak menimpa status
   section lain yang di-set dari komponen berbeda.
============================================================================ */
export function useCollapsedSection(id, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    const map = loadCollapsedSections();
    if (Object.prototype.hasOwnProperty.call(map, id)) return !map[id];
    return defaultOpen;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const map = loadCollapsedSections();
      if (next) delete map[id]; // terbuka = default, tidak perlu disimpan
      else map[id] = true;
      saveCollapsedSections(map);
      return next;
    });
  }, [id]);

  return [open, toggle];
}
