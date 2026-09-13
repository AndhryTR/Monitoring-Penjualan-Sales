import React from "react";

export function CustomSlider({ value, min = 1, max = 31, onChange, colors }) {
  return (
    <div className="flex items-center gap-4 w-full">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer sm-slider"
        style={{
          background: `linear-gradient(to right, ${colors.gold} ${((value - min) / (max - min)) * 100}%, ${colors.glassBorder} ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
      <div 
        className="w-12 text-center py-1.5 rounded-lg font-bold mono text-sm sm-card"
        style={{ 
          background: colors.glassFill, 
          border: `1px solid ${colors.glassBorder}`, 
          color: colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}
