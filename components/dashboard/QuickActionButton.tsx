"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface QuickActionButtonProps {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  className?: string;
}

export function QuickActionButton({
  href,
  icon: Icon,
  label,
  description,
  className = "",
}: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all group ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-900/40 transition-colors">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {label}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
