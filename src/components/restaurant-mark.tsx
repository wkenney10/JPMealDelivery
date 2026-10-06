import type { LogoInfo } from "@/lib/data";

const SIZES = {
  sm: { w: 96, h: 52 },
  md: { w: 150, h: 72 },
  lg: { w: 300, h: 132 },
};

/**
 * A restaurant's logo printed in the page's ink colour (the logo file is used
 * as a mask), or, when there's no logo, a typographic house mark in the same
 * spirit: the name set in small capitals inside a double rule.
 */
export function RestaurantMark({
  name,
  logo,
  size = "sm",
  className = "",
}: {
  name: string;
  logo?: LogoInfo;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = SIZES[size];

  if (logo?.mode === "original") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.file}
        alt={name}
        className={`object-contain ${className}`}
        style={{ width: box.w, height: box.h }}
      />
    );
  }

  if (logo) {
    // Fit the logo's aspect ratio inside the box so the mask never stretches.
    const scale = Math.min(box.w / logo.width, box.h / logo.height, 1.5);
    const mask = `url("${logo.file}") center / contain no-repeat`;
    return (
      <span
        role="img"
        aria-label={name}
        className={`inline-block shrink-0 bg-current ${className}`}
        style={{
          width: Math.round(logo.width * scale),
          height: Math.round(logo.height * scale),
          mask,
          WebkitMask: mask,
        }}
      />
    );
  }

  // Size the name so its longest word fits the box width (Caslon capitals run ~0.8em wide with tracking).
  const longestWord = Math.max(...name.split(/\s+/).map((w) => w.length));
  const lines = name.length > 12 ? 2 : 1;
  const maxSize = size === "lg" ? 34 : size === "md" ? 19 : 14;
  const fontSize = Math.min(maxSize, (box.w - 16) / (longestWord * 0.8), box.h / (lines * 1.6));
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border-[3px] border-double border-current px-2 text-center font-serif leading-[1.05] smallcaps ${className}`}
      style={{ width: box.w, height: box.h, fontSize }}
    >
      {name}
    </span>
  );
}
