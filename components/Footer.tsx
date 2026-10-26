"use client";

import { useState, useRef, useEffect } from "react";

const CHANGELOG: { date: string; changes: string[] }[] = [
  {
    date: "Oct 26",
    changes: [
      "Copy now leaves out spillover ZIPs, where under 5% of residents live in the district",
      "New \"Include spillover ZIPs\" switch copies every ZIP that touches a district",
      "Districts with a ZIP mostly in another state are marked, and the copy message names it",
    ],
  },
  {
    date: "Feb 14",
    changes: ["Add changelog modal to footer"],
  },
];

export default function Footer() {
  const [showChangelog, setShowChangelog] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showChangelog) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowChangelog(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showChangelog]);

  return (
    <>
      <footer className="shrink-0 pt-4 pb-4 text-center border-t border-slate-200">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
          Built by The Canter Company
          <a
            href="https://www.linkedin.com/in/joshuacanter/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-600 transition-colors duration-200"
            title="LinkedIn"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <span className="text-slate-300">|</span>
          <a
            href="/methodology"
            className="hover:text-slate-600 hover:underline transition-colors duration-200"
          >
            Methodology
          </a>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setShowChangelog(true)}
            className="hover:text-slate-600 hover:underline transition-colors duration-200"
          >
            Changelog
          </button>
        </p>
      </footer>

      {showChangelog && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) setShowChangelog(false);
          }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-white max-w-md w-full max-h-[80vh] overflow-y-auto p-6 sm:p-8 rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowChangelog(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-5">
              Changelog
            </h2>

            <div className="space-y-5">
              {CHANGELOG.slice(0, 5).map((day, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-blue-600 mb-1.5">
                    {day.date}
                  </p>
                  <ul className="space-y-1 pl-3">
                    {day.changes.map((change, j) => (
                      <li
                        key={j}
                        className="text-sm text-slate-600 leading-relaxed list-disc"
                      >
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
