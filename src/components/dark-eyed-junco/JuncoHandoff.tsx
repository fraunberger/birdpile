"use client";

import { useEffect } from "react";

/** The 4000-footer log lives on birdfinds.com, where it can use the BirdFinds sign-in. */
export const JUNCO_APP_URL = "https://birdfinds.com/dark_eyed_junco";

// Climbs logged here before the move, and the copy last handed over.
const LOG_KEY = "birdpile.nh48.log.v1";
const HANDED_OFF_KEY = "birdpile.nh48.handedOff.v1";

/**
 * Sends the visitor on to the app. A log still saved in this browser rides
 * along in the address (birdfinds.com can't read birdpile.com's storage),
 * once: sending it again would bring back climbs deleted over there.
 */
export function JuncoHandoff() {
  useEffect(() => {
    let target = JUNCO_APP_URL;
    try {
      const saved = window.localStorage.getItem(LOG_KEY);
      if (saved && window.localStorage.getItem(HANDED_OFF_KEY) !== saved) {
        target += `#import=${encodeURIComponent(saved)}`;
        window.localStorage.setItem(HANDED_OFF_KEY, saved);
      }
    } catch {
      // No storage: nothing to bring along.
    }
    window.location.replace(target);
  }, []);

  return (
    <p className="text-sm text-neutral-500">
      Opening 4000 Footers…{" "}
      <a href={JUNCO_APP_URL} className="underline underline-offset-2 hover:text-black">
        Go now
      </a>
    </p>
  );
}
