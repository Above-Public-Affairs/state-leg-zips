"use client";

import { useState } from "react";
import { StateData, StateUpdates } from "@/lib/types";
import DistrictPill, { copiedZips } from "./DistrictPill";

interface DistrictViewProps {
  state: StateData;
  stateFips: string;
  stateUpdates: StateUpdates;
  shareThreshold: number;
  includeSpillover: boolean;
  onToggleSpillover: () => void;
  onBack: () => void;
  onCopied: (message: string, detail?: string) => void;
}

export default function DistrictView({
  state,
  stateUpdates,
  shareThreshold,
  includeSpillover,
  onToggleSpillover,
  onBack,
  onCopied,
}: DistrictViewProps) {
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const handleRequestUpdate = async () => {
    setUpdateStatus("sending");
    try {
      const res = await fetch("/api/request-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: state.name,
          stateCode: state.abbreviation,
        }),
      });
      setUpdateStatus(res.ok ? "sent" : "error");
    } catch {
      setUpdateStatus("error");
    }
  };
  const isNebraska = state.abbreviation === "NE";
  const upper = state.chambers.upper;
  const lower = state.chambers.lower;

  const sortedUpperDistricts = upper
    ? Object.entries(upper.districts).sort(
        ([a], [b]) => parseInt(a) - parseInt(b)
      )
    : [];

  const sortedLowerDistricts = lower
    ? Object.entries(lower.districts).sort(
        ([a], [b]) => parseInt(a) - parseInt(b)
      )
    : [];

  const hasCrossState = [...sortedUpperDistricts, ...sortedLowerDistricts].some(
    ([, district]) =>
      district.crossState &&
      copiedZips(district, includeSpillover).some((z) => district.crossState![z])
  );

  const lastUpdated = stateUpdates[state.abbreviation];
  const formattedDate = lastUpdated
    ? new Date(lastUpdated + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          All States
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {formattedDate && <span>Updated {formattedDate}</span>}
          <button
            onClick={handleRequestUpdate}
            disabled={updateStatus === "sending" || updateStatus === "sent"}
            className={`cursor-pointer ${
              updateStatus === "sent"
                ? "text-emerald-500"
                : updateStatus === "error"
                  ? "text-red-500 underline"
                  : "hover:underline hover:text-blue-600"
            } ${updateStatus === "sending" ? "opacity-50" : ""}`}
          >
            {updateStatus === "sending"
              ? "Sending..."
              : updateStatus === "sent"
                ? "✓ Requested"
                : updateStatus === "error"
                  ? "Failed — retry?"
                  : "Request Update"}
          </button>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">{state.name}</h2>
      <p className="text-sm text-slate-400 mb-4">
        Click a district to copy its ZIP codes
      </p>

      <div className="mb-8 flex flex-col gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={includeSpillover}
          onClick={onToggleSpillover}
          className="group -mx-2 flex w-fit items-start gap-3 rounded-lg px-2 py-1.5 text-left cursor-pointer hover:bg-slate-100/70 transition-colors duration-150"
        >
          <span
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 group-active:scale-[0.96] ${
              includeSpillover ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                includeSpillover ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-700">
              Include spillover ZIPs
            </span>
            <span className="block text-xs text-slate-400 leading-relaxed text-pretty">
              ZIPs that touch the district but have under{" "}
              {Math.round(shareThreshold * 100)}% of their residents in it, or
              none at all
            </span>
          </span>
        </button>
        {hasCrossState && (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-amber-400"
            />
            Includes a ZIP whose residents mostly live in another state
          </p>
        )}
      </div>

      {isNebraska ? (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
            Legislature
          </h3>
          <div className="flex flex-wrap gap-2">
            {sortedUpperDistricts.map(([num, district]) => (
              <DistrictPill
                key={num}
                number={num}
                district={district}
                includeSpillover={includeSpillover}
                onCopied={onCopied}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {lower && sortedLowerDistricts.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                House Districts
                <span className="text-sm font-normal text-slate-400 ml-2">
                  ({sortedLowerDistricts.length})
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedLowerDistricts.map(([num, district]) => (
                  <DistrictPill
                    key={num}
                    number={num}
                    district={district}
                    includeSpillover={includeSpillover}
                    onCopied={onCopied}
                  />
                ))}
              </div>
            </div>
          )}
          {upper && sortedUpperDistricts.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                Senate Districts
                <span className="text-sm font-normal text-slate-400 ml-2">
                  ({sortedUpperDistricts.length})
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedUpperDistricts.map(([num, district]) => (
                  <DistrictPill
                    key={num}
                    number={num}
                    district={district}
                    includeSpillover={includeSpillover}
                    onCopied={onCopied}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
