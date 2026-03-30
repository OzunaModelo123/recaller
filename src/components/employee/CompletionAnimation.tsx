"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  planTitle: string;
  onDismiss: () => void;
};

export function CompletionAnimation({ planTitle, onDismiss }: Props) {
  const [open, setOpen] = useState(true);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    // Update the latest callback without mutating refs during render.
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setOpen(false);
      dismissRef.current();
    }, 5000);
    return () => window.clearTimeout(t);
  }, []);

  function close() {
    setOpen(false);
    onDismiss();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-labelledby="completion-title"
        >
          <motion.div
            className="relative max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-xl"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(12)].map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute h-2 w-2 rounded-sm bg-amber-400"
                  style={{ left: `${10 + (i % 4) * 25}%`, top: "0%" }}
                  initial={{ y: -8, opacity: 1, rotate: 0 }}
                  animate={{
                    y: 280,
                    opacity: 0.3,
                    rotate: 180 + i * 30,
                    x: (i % 2 === 0 ? 1 : -1) * 40,
                  }}
                  transition={{ duration: 2 + (i % 3) * 0.2, ease: "easeIn" }}
                />
              ))}
            </div>
            <h2
              id="completion-title"
              className="relative text-center text-lg font-semibold text-stone-900"
            >
              Congratulations!
            </h2>
            <p className="relative mt-3 text-center text-sm leading-relaxed text-stone-600">
              You completed{" "}
              <span className="font-medium text-stone-800">{planTitle}</span>.
            </p>
            <div className="relative mt-6 flex justify-center">
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
