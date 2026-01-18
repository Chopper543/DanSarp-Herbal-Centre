"use client";

import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">DanSarp Herbal Centre</h3>
            <p className="text-gray-400 mb-4 max-w-md">
              Your trusted partner in natural healing and wellness. We provide comprehensive herbal treatments 
              to support your journey towards optimal health.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>Ghana</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4" />
                <span>+233 XX XXX XXXX</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-4 h-4" />
                <span>info@dansarpherbal.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-primary-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-primary-400 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/treatments" className="hover:text-primary-400 transition-colors">
                  Treatments
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary-400 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/treatments" className="hover:text-primary-400 transition-colors">
                  All Treatments
                </Link>
              </li>
              <li>
                <Link href="/appointments" className="hover:text-primary-400 transition-colors">
                  Book Appointment
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-primary-400 transition-colors">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href="/testimonials" className="hover:text-primary-400 transition-colors">
                  Testimonials
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright - Middle Bottom Section */}
        <div className="border-t border-gray-800 pt-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              © {currentYear} DanSarp Herbal Centre. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
