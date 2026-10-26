"use client";

import { useState } from "react";
import { DistrictInfo } from "@/lib/types";

interface DistrictPillProps {
  number: string;
  district: DistrictInfo;
  includeSpillover: boolean;
  onCopied: (message: string, detail?: string) => void;
}

export function copiedZips(district: DistrictInfo, includeSpillover: boolean) {
  return includeSpillover
    ? [...district.zips, ...district.spillover].sort()
    : district.zips;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatCoverage(coverage: number) {
  // Floor so a district that loses any residents never reads as 100%
  const pct = Math.floor(coverage * 1000) / 10;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

// "42223 mostly in KY" or "3 ZIPs mostly in other states"
function crossStateNote(zips: string[], crossState: Record<string, string>) {
  const outside = zips.filter((z) => crossState[z]);
  if (outside.length === 0) return null;
  if (outside.length <= 2) {
    return outside.map((z) => `${z} mostly in ${crossState[z]}`).join(", ");
  }
  return `${outside.length} ZIPs mostly in other states`;
}

export default function DistrictPill({
  number,
  district,
  includeSpillover,
  onCopied,
}: DistrictPillProps) {
  const [justCopied, setJustCopied] = useState(false);
  const { name, spillover, crossState = {}, coverage } = district;
  const zips = copiedZips(district, includeSpillover);
  const crossNote = crossStateNote(zips, crossState);

  const reach = `reaches ${formatCoverage(coverage)} of residents`;
  const detail = [
    includeSpillover
      ? spillover.length > 0 && `Includes ${plural(spillover.length, "spillover ZIP")}`
      : spillover.length > 0 &&
        `${plural(spillover.length, "spillover ZIP")} left out · ${reach}`,
    crossNote,
  ]
    .filter(Boolean)
    .join(" · ");

  const trackCopy = () => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "zip_copy", {
        district_name: name,
        zip_count: zips.length,
        mode: includeSpillover ? "with_spillover" : "default",
        spillover_count: spillover.length,
      });
    }
  };

  const confirmCopy = () => {
    setJustCopied(true);
    onCopied(`Copied ${plural(zips.length, "ZIP")} from ${name}`, detail || undefined);
    trackCopy();
    setTimeout(() => setJustCopied(false), 1500);
  };

  const handleClick = async () => {
    const csv = zips.join(",");
    try {
      await navigator.clipboard.writeText(csv);
      confirmCopy();
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = csv;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      confirmCopy();
    }
  };

  const title = [
    `${name} — ${plural(zips.length, "ZIP")}`,
    !includeSpillover && spillover.length > 0 && reach,
    crossNote,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      onClick={handleClick}
      title={`${title} (click to copy)`}
      className={`relative px-3 py-2 rounded-lg text-sm font-medium tabular-nums transition-[translate,scale,box-shadow,background-color,border-color,color] duration-150 cursor-pointer min-w-[2.5rem] text-center ${
        justCopied
          ? "bg-emerald-500 text-white scale-95 shadow-md ring-2 ring-emerald-300"
          : "bg-white border border-slate-200 text-slate-700 shadow-sm hover:shadow-md hover:border-blue-400 hover:text-blue-700 hover:-translate-y-px active:translate-y-0 active:scale-[0.96] active:shadow-none"
      }`}
    >
      {justCopied ? (
        <span className="animate-pulse-check inline-block">✓</span>
      ) : (
        number
      )}
      {crossNote && !justCopied && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 ring-2 ring-white"
        />
      )}
    </button>
  );
}
