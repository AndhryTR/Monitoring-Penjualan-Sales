import { memo } from "react";

const SIZES = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 48,
  xl: 64,
  "2xl": 80,
};

export const AppLogo = memo(function AppLogo({
  size = "md",
  animated = false,
  loop = false,
  className = "",
  style = {},
  ariaLabel = "Logo Monitoring Penjualan",
}) {
  const pixelSize = typeof size === "number" ? size : SIZES[size] || 36;

  return (
    <div
      className={`app-logo-wrap inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${animated ? "app-logo-animated" : ""} ${loop ? "app-logo-loop" : ""} ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize,
        minWidth: pixelSize,
        minHeight: pixelSize,
        maxWidth: pixelSize,
        maxHeight: pixelSize,
        ...style,
      }}
      aria-label={ariaLabel}
      role="img"
    >
      <svg
        viewBox="0 0 1000 1000"
        width={pixelSize}
        height={pixelSize}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          display: "block",
          overflow: "hidden",
          fillRule: "evenodd",
          clipRule: "evenodd",
          strokeLinejoin: "round",
          strokeMiterlimit: 2,
        }}
      >
        <defs>
          <linearGradient
            id="applogo_Linear1"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(747.318589,-489.275848,489.275848,747.318589,157.765397,548.592464)"
          >
            <stop offset="0" stopColor="#022e7c" stopOpacity="1" />
            <stop offset="0.26" stopColor="#0890ee" stopOpacity="1" />
            <stop offset="0.52" stopColor="#1edff4" stopOpacity="1" />
            <stop offset="0.75" stopColor="#0389fa" stopOpacity="1" />
            <stop offset="1" stopColor="#1ce0f8" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear2"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-440.621669,-318.475001,318.475001,-440.621669,549.727927,921.465373)"
          >
            <stop offset="0" stopColor="#012c79" stopOpacity="1" />
            <stop offset="0.41" stopColor="#0367e3" stopOpacity="1" />
            <stop offset="0.74" stopColor="#0fc9f2" stopOpacity="1" />
            <stop offset="1" stopColor="#13d48b" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear3"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(142.316668,-311.539024,311.539024,142.316668,615.621295,652.860022)"
          >
            <stop offset="0" stopColor="#0e7dbb" stopOpacity="1" />
            <stop offset="0.49" stopColor="#0ebba0" stopOpacity="1" />
            <stop offset="1" stopColor="#4cef78" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear4"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(162.346405,-37.951108,37.951108,162.346405,565.932294,716.506999)"
          >
            <stop offset="0" stopColor="#1755a9" stopOpacity="1" />
            <stop offset="1" stopColor="#1f70d5" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear5"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-120.79336,-197.104548,197.104548,-120.79336,670.739146,945.940268)"
          >
            <stop offset="0" stopColor="#001f4c" stopOpacity="1" />
            <stop offset="1" stopColor="#0d458f" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear6"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(125.18583,-204.187394,204.187394,125.18583,706.403583,949.05521)"
          >
            <stop offset="0" stopColor="#041d47" stopOpacity="1" />
            <stop offset="1" stopColor="#1557a7" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear7"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(168.32019,-47.087485,47.087485,168.32019,650.768881,767.108476)"
          >
            <stop offset="0" stopColor="#11509d" stopOpacity="1" />
            <stop offset="1" stopColor="#1f66c3" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear8"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(122.286922,-96.98618,96.98618,122.286922,260.303168,659.875247)"
          >
            <stop offset="0" stopColor="#0441ae" stopOpacity="1" />
            <stop offset="1" stopColor="#0e8ffe" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="applogo_Linear9"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(127.382209,-292.97908,292.97908,127.382209,436.88127,754.75303)"
          >
            <stop offset="0" stopColor="#013e9e" stopOpacity="1" />
            <stop offset="0.49" stopColor="#078edb" stopOpacity="1" />
            <stop offset="1" stopColor="#16e7e4" stopOpacity="1" />
          </linearGradient>
        </defs>

        <g id="bars" className="applogo-bars">
          <path
            id="applogo_bar-1"
            className="applogo-bar-1"
            d="M394.538,744.562l-0.703,-178.862c-1.006,-9.307 -6.842,-13.3 -17.219,-12.299l-107.177,34.789c-4.749,0.831 -9.541,5.536 -13.353,14.801l-0.351,59.345l138.803,82.227Z"
            fill="url(#applogo_Linear8)"
          />
          <path
            id="applogo_bar-2"
            className="applogo-bar-2"
            d="M426.866,760.727l82.227,39.005l0,-76.956c0.22,-7.007 3.164,-14.013 16.522,-21.02l50.146,-25.365l0,-208.028c0.822,-11.682 -5.409,-16.312 -16.769,-15.813l-113.502,37.951c-9.299,3.691 -16.12,10.481 -17.921,23.544l-0.703,246.682Z"
            fill="url(#applogo_Linear9)"
          />
          <path
            id="applogo_bar-3"
            className="applogo-bar-3"
            d="M611.229,658.043l59.738,-28.406c7.174,-5.187 21.377,-6.093 28.551,0.439l68.084,31.92l0,-312.995c-1.195,-10.372 -7.736,-15.398 -20.645,-14.056l-115.962,40.411c-11.287,5.931 -17.704,14.567 -18.448,26.355l-1.318,256.331Z"
            fill="url(#applogo_Linear3)"
          />
        </g>

        <g id="ribbon-grp" className="applogo-ribbon">
          <path
            id="applogo_arrow"
            className="applogo-arrow"
            d="M157.201,461.882c0,0 -78.516,62.044 7.687,141.109c52.467,-47.428 119.04,-92.711 205.349,-131.226c2.352,-1.05 67.122,-30.667 129.763,-60.956c120.79,-58.407 277.86,-140.05 311.772,-178.318l40.762,37.6c0,0 9.064,4.92 15.462,-7.731c6.397,-12.65 58.758,-214.672 58.758,-214.672c-0.273,-9.318 -5.484,-12.992 -15.833,-10.795l-225.81,67.761c-8.336,4.619 -7.505,14.265 -1.448,19.364l38.429,31.944c-50.431,43.847 -130.998,90.108 -204.149,125.778c-78.228,37.762 -160.046,74.499 -243.524,110.761c-50.81,21.563 -88.899,44.821 -117.22,69.383Z"
            fill="url(#applogo_Linear1)"
          />
          <path
            id="applogo_tail"
            className="applogo-tail"
            d="M509.27,806.363l-0.439,65.009c1.421,21.157 15.141,26.291 66.931,56.087c-105.168,-14.571 -215.79,-48.77 -415.603,-188.065c-109.144,-76.087 -96.912,-170.914 -16.911,-262.915c-49.385,77.206 12.869,122.663 82.579,172.625c82.33,54.718 192.914,116.598 283.443,157.26Z"
            fill="url(#applogo_Linear2)"
          />
        </g>

        <g id="box" className="applogo-box">
          <path
            id="applogo_box-top"
            className="applogo-box-top"
            d="M641.973,767.122l47.442,27.156c4.831,2.762 5.79,2.449 10.62,-1.349l122.919,-69.043c3.517,-2.124 2.774,-4.046 -1.962,-5.778l-48.37,-23.099c-3.782,-1.644 -7.564,-2.043 -11.347,0.062l-119.327,66.958c-3.66,1.888 -3.233,3.991 0.024,5.093Z"
            fill="url(#applogo_Linear7)"
          />
          <path
            id="applogo_box-tape"
            className="applogo-box-tape"
            d="M557.173,719.557l54.056,29.279l125.858,-68.6c1.455,-0.51 1.788,-1.394 0.479,-2.825l-48.151,-22.047c-3.327,-2.154 -6.654,-1.945 -9.981,-0.351l-120.991,58.959c-2.985,1.585 -4.043,3.521 -1.27,5.586Z"
            fill="url(#applogo_Linear4)"
          />
          <path
            id="applogo_box-left"
            className="applogo-box-left"
            d="M678.514,816.512l0.281,134.094c-0.429,4.457 -3.042,4.982 -7.309,2.53l-127.806,-76.759c-4.573,-2.467 -5.375,-5.185 -5.726,-8.42l-0.562,-131.002c0.976,-2.853 2.866,-3.425 5.341,-2.53l132.688,75.902c2.403,2.405 3.688,4.53 3.092,6.185Z"
            fill="url(#applogo_Linear5)"
          />
          <path
            id="applogo_box-right"
            className="applogo-box-right"
            d="M702.666,815.494l-0.225,135.387c0.577,3.613 3.037,5.188 7.79,2.168l120.175,-72.335c3.706,-1.878 5.867,-5.028 5.397,-10.345l0.675,-129.765c-0.128,-1.734 -1.209,-1.407 -3.363,-0.255l-126.852,70.872c-2.177,1.005 -3.142,2.53 -3.598,4.273Z"
            fill="url(#applogo_Linear6)"
          />
        </g>
      </svg>
    </div>
  );
});
