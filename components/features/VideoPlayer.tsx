"use client";

import dynamic from "next/dynamic";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface VideoPlayerProps {
  url: string;
  width?: string;
  height?: string;
}

export function VideoPlayer({ url, width = "100%", height = "200px" }: VideoPlayerProps) {
  return (
    <div className="mb-4 rounded-lg overflow-hidden">
      <ReactPlayer url={url} width={width} height={height} controls />
    </div>
  );
}
