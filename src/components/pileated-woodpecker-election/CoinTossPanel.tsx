'use client';

import { useState } from 'react';
import type { CoinTossState, Nomination } from '@/lib/election/types';
import { WinnerRevealAnimation } from './WinnerRevealAnimation';

interface Props {
    electionId: string;
    username: string;
    canToss: boolean; // the caller cast a ballot
    tied: string[]; // tied finalist ids
    nominations: Nomination[];
    coinToss?: CoinTossState;
    voterCount: number;
    speedWinnerId: string | null;
    onChange: () => void; // ask the parent to refetch the election
}

/**
 * Shown when a completed election ends in a genuine tie. Voters can each request
 * a random coin toss; once a strict majority of voters have, the server freezes
 * a random pick and this spins the same reveal wheel — over just the tied
 * finalists — to land on it.
 */
export function CoinTossPanel({
    electionId,
    username,
    canToss,
    tied,
    nominations,
    coinToss,
    voterCount,
    speedWinnerId,
    onChange,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [spinDone, setSpinDone] = useState(false);

    const nameOf = (id: string) => nominations.find(n => n.id === id)?.restaurantName ?? id;
    const tossWinner = coinToss?.winnerId ?? null;
    const requesters = coinToss?.requesters ?? [];
    const mine = requesters.includes(username.trim().toLowerCase());
    const needed = Math.floor(voterCount / 2) + 1;
    const tiedNoms = nominations.filter(n => tied.includes(n.id));

    const press = async () => {
        if (!canToss || busy || tossWinner) return;
        setBusy(true);
        try {
            await fetch(`/api/elections/${electionId}/cointoss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username }),
            });
            onChange();
        } finally {
            setBusy(false);
        }
    };

    // Resolved: spin the wheel once, then show the result.
    if (tossWinner) {
        if (!spinDone) {
            return (
                <div className="max-w-sm mx-auto py-6">
                    <WinnerRevealAnimation
                        nominations={tiedNoms.length ? tiedNoms : nominations}
                        winnerId={tossWinner}
                        tieNote={`Random toss between ${tied.map(nameOf).join(' & ')}`}
                        onComplete={() => setSpinDone(true)}
                    />
                </div>
            );
        }
        return (
            <div className="mt-4 border-2 border-purple-300 bg-purple-50 p-4 text-center max-w-md mx-auto">
                <div className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-1">🎲 Coin toss</div>
                <div className="text-sm text-gray-700">
                    Randomly chose <span className="font-bold">{nameOf(tossWinner)}</span> from{' '}
                    {tied.map(nameOf).join(' & ')}.
                </div>
            </div>
        );
    }

    // Unresolved: show the tie + the request button.
    return (
        <div className="mt-4 border border-gray-200 bg-gray-50 p-4 text-center max-w-md mx-auto">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Dead heat</div>
            <div className="text-sm text-gray-700 mb-3">
                {tied.map(nameOf).join(' vs ')}
                {speedWinnerId && (
                    <> — <span className="font-bold">{nameOf(speedWinnerId)}</span> wins on speed by default.</>
                )}
            </div>
            <button
                onClick={press}
                disabled={!canToss || busy}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2 border-2 transition-colors disabled:opacity-40 ${
                    mine
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-purple-700 border-purple-400 hover:bg-purple-50'
                }`}
            >
                🎲 {mine ? "Random choice (you're in)" : 'Random choice'}
            </button>
            <div className="text-[11px] text-gray-500 mt-2">
                {requesters.length} of {needed} voters needed to spin the wheel
            </div>
            {!canToss && <div className="text-[11px] text-gray-400 mt-1">Only voters can call a toss.</div>}
        </div>
    );
}
