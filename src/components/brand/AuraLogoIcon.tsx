import { cn } from "../../lib/cn";

const GRADIENT_ID = "aura-logo-gradient";

export function AuraLogoIcon({
  size = 36,
  className,
  mono,
}: {
  size?: number;
  className?: string;
  mono?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={GRADIENT_ID} x1="8" y1="42" x2="40" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7B5CFF" />
          <stop offset="0.5" stopColor="#4361FF" />
          <stop offset="1" stopColor="#00D4FF" />
        </linearGradient>
      </defs>
      {/* Stylized A ribbon */}
      <path
        d="M24 6L8 42h7.5l3.2-8.5h12.6l3.2 8.5H40L24 6zm0 12.5l4.8 12.5h-9.6L24 18.5z"
        fill={mono ? "currentColor" : `url(#${GRADIENT_ID})`}
      />
      {/* Sparkle star */}
      <path
        d="M24 14l1.2 2.8 2.8 1.2-2.8 1.2L24 22.2l-1.2-2.8-2.8-1.2 2.8-1.2L24 14z"
        fill={mono ? "currentColor" : "#00D4FF"}
      />
    </svg>
  );
}
