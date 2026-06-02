
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreateElection } from './CreateElection';
import { RestaurantElectionRoom } from './RestaurantElectionRoom';

export function RestaurantVotingApp() {
    const [activeElectionId, setActiveElectionId] = useState<string | null>(null);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-red-200 selection:text-red-900">
            {activeElectionId ? (
                <RestaurantElectionRoom
                    electionId={activeElectionId}
                    onExit={() => setActiveElectionId(null)}
                />
            ) : (
                <div className="max-w-4xl mx-auto p-6 pt-20">
                    <header className="mb-12 text-center space-y-4">
                        <div className="text-6xl mb-4">🍕</div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 uppercase">
                            Dinner Voting Tool
                        </h1>
                        {/* Subtitle removed per user request */}
                    </header>

                    <CreateElection onJoined={(id: string) => setActiveElectionId(id)} />

                    <div className="mt-16 text-center">
                        <Link
                            href="/runoff-playground"
                            className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black underline decoration-gray-300 hover:decoration-black"
                        >
                            🧪 Runoff Playground — test ballots & see the flow chart
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
