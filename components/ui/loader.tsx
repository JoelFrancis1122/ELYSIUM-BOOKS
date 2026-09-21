"use client";
import React from "react";

export interface LoaderOneProps {
  className?: string;
  size?: number;
  color?: string;
  text?: string;
}

export function LoaderOne({
  className = "",
  size = 72,
  color = "#b8542a",
  text = "BOOKSAW",
}: LoaderOneProps) {
  return (
    <div className={`relative flex flex-col items-center justify-center gap-5 ${className}`}>
      {/* Visual rings */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Outer orbital gradient ring */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            padding: "3px",
            background: `conic-gradient(from 0deg, transparent 20%, rgba(184,84,42,0.1) 50%, ${color} 100%)`,
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
            filter: `drop-shadow(0 0 8px ${color}66)`,
            animationDuration: "1.1s",
          }}
        />

        {/* Inner counter-rotating dashed ring */}
        <div
          className="absolute rounded-full border-2 border-dashed border-neutral-700/40"
          style={{
            inset: `${Math.round(size * 0.14)}px`,
            borderTopColor: color,
            animation: "spin 1.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite reverse",
          }}
        />

        {/* Center pulsing glowing core */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: `${Math.round(size * 0.2)}px`,
            height: `${Math.round(size * 0.2)}px`,
            backgroundColor: color,
            boxShadow: `0 0 16px ${color}b3, 0 0 24px ${color}4d`,
            animationDuration: "1.4s",
          }}
        />
      </div>

      {/* Label with pulsing dots */}
      {text && (
        <div className="flex items-center gap-1 font-serif text-sm font-bold tracking-widest text-neutral-800 uppercase dark:text-neutral-200">
          <span>{text}</span>
          <span className="inline-flex gap-1 ml-1">
            <span
              className="w-1 h-1 rounded-full animate-ping"
              style={{ backgroundColor: color, animationDuration: "1.2s" }}
            />
            <span
              className="w-1 h-1 rounded-full animate-ping"
              style={{
                backgroundColor: color,
                animationDuration: "1.2s",
                animationDelay: "0.2s",
              }}
            />
            <span
              className="w-1 h-1 rounded-full animate-ping"
              style={{
                backgroundColor: color,
                animationDuration: "1.2s",
                animationDelay: "0.4s",
              }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export default LoaderOne;
