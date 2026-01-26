"use client";

import { useState } from "react";
import { MapPin, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

interface GoogleMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
  height?: string;
  className?: string;
  showDirectionsButton?: boolean;
  embedUrl?: string; // Optional: Manual embed URL from Google Maps (Share > Embed a map)
}

export function GoogleMap({
  latitude,
  longitude,
  address,
  zoom = 15,
  height = "400px",
  className = "",
  showDirectionsButton = true,
  embedUrl,
}: GoogleMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate Google Maps embed URL
  // Priority: 1) Manual embed URL, 2) API key method, 3) Simple address/coordinates format
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // Build map URL - prefer manual embed URL, then API key, then simple format
  let mapUrl: string;
  if (embedUrl) {
    // Use manual embed URL from Google Maps (Share > Embed a map) - most reliable
    mapUrl = embedUrl;
  } else if (apiKey) {
    // Use Maps Embed API with API key (recommended when API key is available)
    const query = address 
      ? encodeURIComponent(address)
      : `${latitude},${longitude}`;
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
    });
    if (zoom) {
      params.append('zoom', zoom.toString());
    }
    mapUrl = `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
  } else if (address) {
    // Fallback: Use simple address-based query (no API key, no output=embed)
    // This format works without the deprecated output=embed parameter
    mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&hl=en&z=${zoom}`;
  } else {
    // Fallback: Use coordinates (simple format without output=embed)
    mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=${zoom}`;
  }

  // Generate directions URL
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}${
    address ? `&destination_place_id=${encodeURIComponent(address)}` : ""
  }`;

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full" style={{ height }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading map...</p>
            </div>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center p-4">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Unable to load map
              </p>
              {address && (
                <Link
                  href={`https://www.google.com/maps?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View on Google Maps
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <iframe
            src={mapUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            title="Clinic Location Map"
            aria-label="Interactive map showing clinic location"
          />
        )}
      </div>

      {showDirectionsButton && !hasError && (
        <div className="mt-4 flex justify-center">
          <Link
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            aria-label="Get directions to clinic"
          >
            <MapPin className="w-4 h-4" />
            Get Directions
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )}

      {address && (
        <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
          {address}
        </p>
      )}
    </div>
  );
}
