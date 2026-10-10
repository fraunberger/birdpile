"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * Prizmichael, the Messina-style vocal harmonizer, runs as its own static app
 * under /prizmichael (exported from the prizmichael repo with
 * `npm run export:birdpile`). This shows it full-screen below the usual way
 * back, and gives it keyboard focus so the chord keys work straight away.
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
        src="/prizmichael"
        title="Prizmichael"
        allow="midi; autoplay; fullscreen"
        className="flex-1 w-full border-0"
        onLoad={e => e.currentTarget.contentWindow?.focus()}
      />
    </div>
  );
}
