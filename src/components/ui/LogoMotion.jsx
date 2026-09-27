import { useState, useEffect, memo } from "react";
import { AppLogo } from "./AppLogo.jsx";

export const LogoMotion = memo(function LogoMotion({
  size = 72,
  autoPlay = true,
  loop = false,
  className = "",
  style = {},
  onFinish,
}) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => {
      onFinish?.();
    }, 1600);
    return () => clearTimeout(timer);
  }, [key, autoPlay, onFinish]);

  const replay = () => setKey((k) => k + 1);

  return (
    <div
      key={key}
      onClick={replay}
      className={`logo-motion-container inline-flex flex-col items-center justify-center cursor-pointer ${className}`}
      style={style}
      title="Klik untuk putar ulang animasi"
    >
      <AppLogo
        size={size}
        animated={autoPlay}
        loop={loop}
        className="transition-transform duration-300 hover:scale-105 active:scale-95"
      />
    </div>
  );
});
