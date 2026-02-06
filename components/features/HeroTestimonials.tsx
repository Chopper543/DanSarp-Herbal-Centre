"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Star, Quote } from "lucide-react";

const MAX_QUOTE_LENGTH = 120;
const ROTATE_INTERVAL_MS = 6000;

export type HeroTestimonial = {
  id: string;
  patient_name: string | null;
  content: string;
};

function truncateQuote(text: string): string {
  if (text.length <= MAX_QUOTE_LENGTH) return text;
  return text.slice(0, MAX_QUOTE_LENGTH).trim() + "…";
}

export function HeroTestimonials({ testimonials }: { testimonials: HeroTestimonial[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = testimonials.length;
  const current = testimonials[index];

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || isPaused) return;
    intervalRef.current = setInterval(goNext, ROTATE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [total, isPaused, goNext]);

  if (!total || !current) return null;

  return (
    <div
      className="relative w-full max-w-2xl mx-auto mt-10 sm:mt-12"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="bg-white/10 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/50 px-6 py-5 text-left">
        <div className="flex gap-2 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="w-4 h-4 fill-primary-300 text-primary-300 dark:fill-primary-400 dark:text-primary-400"
              aria-hidden
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <Quote className="w-6 h-6 text-primary-200 dark:text-primary-400 mb-2 opacity-80" aria-hidden />
            <p className="text-white/95 dark:text-gray-100 text-sm sm:text-base leading-relaxed">
              &ldquo;{truncateQuote(current.content)}&rdquo;
            </p>
            {current.patient_name && (
              <p className="mt-3 text-primary-200 dark:text-primary-300 text-sm font-medium">
                — {current.patient_name}
              </p>
            )}
            <p className="mt-1 text-xs text-white/70 dark:text-gray-400">Approved testimonial</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={goPrev}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
            aria-label="Previous testimonial"
          >
            <span className="sr-only">Previous</span>
            <span aria-hidden="true">&larr;</span>
          </button>
          <span className="text-sm text-white/80" aria-live="polite">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={goNext}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
            aria-label="Next testimonial"
          >
            <span className="sr-only">Next</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      <p className="mt-3 text-center">
        <Link
          href="/testimonials"
          className="text-sm text-primary-200 hover:text-white dark:text-primary-300 dark:hover:text-white underline focus:outline-none focus:ring-2 focus:ring-primary-400 rounded"
        >
          Read more testimonials
        </Link>
      </p>
    </div>
  );
}
