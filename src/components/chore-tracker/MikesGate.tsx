"use client";

import { useState, useEffect } from "react";
import bcrypt from "bcryptjs";
import { ChoreTracker } from "./ChoreTracker";

const HASH = "$2b$10$cMsY5MfoIb3DirBWcTet0eNq54iMIxCfoISd.TDKMjm.vOMhITPSa";
const SESSION_KEY = "mikes_things_auth";

export function MikesGate() {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setAuthed(true);
    }
    setLoaded(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(false);
    const ok = await bcrypt.compare(input, HASH);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
    setChecking(false);
  };

  if (!loaded) return null;

  if (authed) return <ChoreTracker />;

  return (
    <div className="max-w-xs mx-auto mt-20">
      <h1 className="text-2xl font-bold font-mono mb-1">Mike&apos;s Things</h1>
      <p className="text-sm text-gray-500 font-mono mb-6">Enter the password to continue</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          autoFocus
          className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black"
        />
        {error && (
          <p className="text-xs text-red-600 font-mono">Incorrect password.</p>
        )}
        <button
          type="submit"
          disabled={checking || !input}
          className="font-mono text-sm border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
        >
          {checking ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
