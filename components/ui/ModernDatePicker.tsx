"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  isBefore,
  addMonths,
  subMonths
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ModernDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  className?: string;
}

export function ModernDatePicker({
  value,
  onChange,
  minDate = new Date(),
  className = "",
}: ModernDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const [direction, setDirection] = useState(0);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handlePreviousMonth = () => {
    setDirection(-1);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (day: Date) => {
    if (!isDateDisabled(day)) {
      onChange(day);
    }
  };

  const isDateDisabled = (day: Date) => {
    // Disable dates before minDate (excluding today if it's before minDate)
    const minDateStart = new Date(minDate);
    minDateStart.setHours(0, 0, 0, 0);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    return isBefore(dayStart, minDateStart) && !isToday(day);
  };

  const isDateSelected = (day: Date) => {
    return value ? isSameDay(day, value) : false;
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header with Month/Year and Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={handlePreviousMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <motion.h3
          key={format(currentMonth, "MMMM yyyy")}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {format(currentMonth, "MMMM yyyy")}
        </motion.h3>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={format(currentMonth, "MMMM yyyy")}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="grid grid-cols-7 gap-2"
        >
          {days.map((day, dayIdx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDisabled = isDateDisabled(day);
            const isSelected = isDateSelected(day);
            const isTodayDate = isToday(day);

            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  relative aspect-square min-h-[44px] rounded-lg font-medium text-sm
                  transition-all duration-200
                  ${!isCurrentMonth ? "text-gray-300 dark:text-gray-600" : ""}
                  ${isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:scale-110 hover:shadow-md"
                  }
                  ${isSelected
                    ? "bg-primary-600 text-white shadow-lg scale-105 ring-2 ring-primary-300 dark:ring-primary-700"
                    : isTodayDate
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-2 border-primary-400 dark:border-primary-600"
                    : "bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }
                `}
              >
                <span className="relative z-10">{format(day, "d")}</span>
                {isSelected && (
                  <motion.div
                    layoutId="selectedDate"
                    className="absolute inset-0 bg-primary-600 rounded-lg"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Selected Date Display */}
      {value && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Selected: <span className="font-semibold text-primary-600 dark:text-primary-400">{format(value, "EEEE, MMMM d, yyyy")}</span>
          </p>
        </motion.div>
      )}
    </div>
  );
}
