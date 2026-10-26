"use client";

import { useEffect } from "react";

interface CopyToastProps {
  message: string;
  detail?: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function CopyToast({
  message,
  detail,
  visible,
  onDismiss,
}: CopyToastProps) {
  useEffect(() => {
    if (visible) {
      // Leave time to read the second line
      const timer = setTimeout(onDismiss, detail ? 4000 : 2000);
      return () => clearTimeout(timer);
    }
  }, [visible, message, detail, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in w-max max-w-[calc(100vw-2rem)]"
    >
      <div
        className={`bg-emerald-600 text-white px-6 py-3 shadow-xl text-sm text-center ${
          detail ? "rounded-2xl" : "rounded-full"
        }`}
      >
        <p className="font-medium">{message}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-emerald-50/90 tabular-nums text-pretty">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
