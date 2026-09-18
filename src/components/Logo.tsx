interface LogoProps {
  size?: number;
  expanded?: boolean;
}

export function Logo({ size = 32, expanded }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M10 16L14 20L22 12"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {expanded && (
        <span className="font-semibold text-sm tracking-tight">ZeqouXChat</span>
      )}
    </div>
  );
}
