"use client";

export function SonantIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <style>{`
        .color-primary {
          fill: oklch(0.55 0.14 55);
          stroke: oklch(0.55 0.14 55);
        }
        .color-glow {
          fill: oklch(0.85 0.14 65);
        }
        @media (prefers-color-scheme: dark) {
          .color-primary {
            fill: oklch(0.78 0.14 62);
            stroke: oklch(0.78 0.14 62);
          }
          .color-glow {
            fill: oklch(0.78 0.16 65);
          }
        }
        .ring {
          fill: none;
          stroke-width: 6;
        }
        .bar {
          stroke: none;
        }
      `}</style>

      <circle className="ring color-primary" cx="50" cy="50" r="40" />

      <rect
        className="bar color-primary"
        x="25"
        y="40"
        width="8"
        height="20"
        rx="4"
      />
      <rect
        className="bar color-primary"
        x="39"
        y="25"
        width="8"
        height="50"
        rx="4"
      />

      <rect
        className="bar color-glow"
        x="53"
        y="15"
        width="8"
        height="70"
        rx="4"
      />

      <rect
        className="bar color-primary"
        x="67"
        y="35"
        width="8"
        height="30"
        rx="4"
      />
    </svg>
  );
}
