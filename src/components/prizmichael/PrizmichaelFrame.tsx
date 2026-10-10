"use client";

import Image from "next/image";
import Link from "next/link";

// Prizmichael is its own Vercel project, deployed from the prizmichael repo on
// every push to main, so the bird always shows the latest version
const PRIZMICHAEL_URL = "https://prizmichael.vercel.app";

/**
 * Prizmichael, the Messina-style vocal harmonizer, full-screen below the usual
 * way back. It gets keyboard focus on load so the chord keys work straight
 * away, and MIDI so a keyboard can play it.
 */
export function PrizmichaelFrame() {
  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="flex items-center h-11 px-4 shrink-0 border-b border-black/10 font-mono text-black">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity group">
          <span className="text-xl group-hover:-translate-x-1 transition-transform">&larr;</span>
          <div className="relative w-12 h-8">
            <Image src="/logo.png" alt="Apps" fill className="object-contain" />
          </div>
        </Link>
      </div>
      <iframe
        src={PRIZMICHAEL_URL}
        title="Prizmichael"
        allow="midi; autoplay; fullscreen"
        className="flex-1 w-full border-0"
        onLoad={e => e.currentTarget.contentWindow?.focus()}
      />
    </div>
  );
}
