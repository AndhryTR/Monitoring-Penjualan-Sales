import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

/**
 * Wrapper kontainer tabel responsif dengan indikator visual scroll horizontal (scroll affordance).
 * Menampilkan shadow gradient halus dan chevron hint di tepi kanan/kiri bila ada kolom
 * tersembunyi yang dapat digeser (terutama di layar tablet/mobile atau tabel multi-periode).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - elemen tabel
 * @param {object} props.colors - token warna tema aktif
 * @param {string} [props.className=""] - kelas tambahan untuk scroll container
 * @param {string} [props.wrapperClassName=""] - kelas tambahan untuk outer wrapper
 * @param {boolean} [props.showHintIcon=true] - tampilkan icon chevron kecil saat overflow
 */
export function TableScrollWrapper({
  children,
  colors,
  className = "",
  wrapperClassName = "",
  showHintIcon = true,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(checkScroll);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      if (ro) ro.disconnect();
    };
  }, [checkScroll]);

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 160, behavior: "smooth" });
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -160, behavior: "smooth" });
    }
  };

  const shadowBg = colors?.meshBg || colors?.surface || "#0A1120";

  return (
    <div className={`relative ${wrapperClassName}`}>
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={`overflow-x-auto ${className}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {/* Shadow gradient kiri (saat user sudah scroll ke kanan) */}
      {canScrollLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-20 transition-opacity duration-200 flex items-center justify-start pl-0.5"
          style={{
            background: `linear-gradient(to right, ${shadowBg}E6 0%, ${shadowBg}66 50%, transparent 100%)`,
          }}
        >
          {showHintIcon && (
            <button
              onClick={scrollLeft}
              className="pointer-events-auto p-1 rounded-full text-xs opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: colors?.text || "currentColor" }}
              title="Geser ke kiri"
              type="button"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      )}

      {/* Shadow gradient kanan (menunjukkan ada kolom tersembunyi ke kanan) */}
      {canScrollRight && (
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20 transition-opacity duration-200 flex items-center justify-end pr-0.5"
          style={{
            background: `linear-gradient(to left, ${shadowBg}E6 0%, ${shadowBg}66 50%, transparent 100%)`,
          }}
        >
          {showHintIcon && (
            <button
              onClick={scrollRight}
              className="pointer-events-auto p-1 rounded-full text-xs opacity-70 hover:opacity-100 transition-opacity animate-pulse"
              style={{ color: colors?.gold || colors?.mint || "currentColor" }}
              title="Geser untuk kolom lainnya"
              type="button"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TableScrollWrapper;
