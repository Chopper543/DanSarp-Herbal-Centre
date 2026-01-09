"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminContentPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Content Management
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/content/gallery"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Gallery Items
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage doctor photos, events, and clinic gallery
          </p>
        </Link>

        <Link
          href="/admin/content/blog"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Blog Posts
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage blog articles
          </p>
        </Link>

        <Link
          href="/admin/content/treatments"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Treatments
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage treatment directory and pricing
          </p>
        </Link>

        <Link
          href="/admin/content/testimonials"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Testimonials
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Review and approve patient testimonials
          </p>
        </Link>

        <Link
          href="/admin/content/reviews"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Reviews
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Moderate user reviews
          </p>
        </Link>

        <Link
          href="/admin/content/organization"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Organization Profile
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Update mission, vision, and values
          </p>
        </Link>
      </div>
    </div>
  );
}
