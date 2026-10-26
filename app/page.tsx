"use client";

import { useState, useEffect, useCallback } from "react";
import { DistrictData, StateUpdates } from "@/lib/types";
import StateGrid from "@/components/StateGrid";
import DistrictView from "@/components/DistrictView";
import CopyToast from "@/components/CopyToast";
import Footer from "@/components/Footer";

const SPILLOVER_KEY = "includeSpillover";

function readSpilloverPreference() {
  try {
    return localStorage.getItem(SPILLOVER_KEY) === "1";
  } catch {
    // Storage unavailable (private mode, blocked site data): use the default
    return false;
  }
}

export default function Home() {
  const [data, setData] = useState<DistrictData | null>(null);
  const [stateUpdates, setStateUpdates] = useState<StateUpdates>({});
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastDetail, setToastDetail] = useState<string | undefined>();
  const [toastVisible, setToastVisible] = useState(false);
  const [includeSpillover, setIncludeSpillover] = useState(false);

  const toggleSpillover = useCallback(() => {
    setIncludeSpillover((on) => {
      try {
        localStorage.setItem(SPILLOVER_KEY, on ? "0" : "1");
      } catch {
        // Not remembered, but the toggle still works for this visit
      }
      return !on;
    });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/data/districts.json").then((r) => r.json()),
      fetch("/data/state-updates.json").then((r) => r.json()),
    ])
      .then(([districtData, updates]) => {
        setData(districtData);
        setStateUpdates(updates);
        setIncludeSpillover(readSpilloverPreference());
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setLoading(false);
      });
  }, []);

  const handleCopied = useCallback((message: string, detail?: string) => {
    setToastMessage(message);
    setToastDetail(detail);
    setToastVisible(true);
  }, []);

  const handleDismissToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-400 text-lg animate-pulse">Loading district data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-500 text-lg">
          Failed to load data. Please refresh.
        </div>
      </div>
    );
  }

  const selectedStateData = selectedState
    ? data.states[selectedState]
    : null;

  return (
    <div className="h-screen flex flex-col px-4 py-6 max-w-7xl mx-auto overflow-hidden">
      <header className="text-center mb-6 shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
          State Leg ZIPs
        </h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
          Copy ZIP codes by state legislative district. Click a state, then
          click a district to copy its ZIPs to your clipboard.
        </p>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {selectedStateData ? (
          <DistrictView
            state={selectedStateData}
            stateFips={selectedState!}
            stateUpdates={stateUpdates}
            shareThreshold={data.metadata.zip_share_threshold}
            includeSpillover={includeSpillover}
            onToggleSpillover={toggleSpillover}
            onBack={() => setSelectedState(null)}
            onCopied={handleCopied}
          />
        ) : (
          <div className="h-full">
            <StateGrid
              states={data.states}
              onSelectState={setSelectedState}
            />
          </div>
        )}
      </main>

      <CopyToast
        message={toastMessage}
        detail={toastDetail}
        visible={toastVisible}
        onDismiss={handleDismissToast}
      />

      <Footer />
    </div>
  );
}
