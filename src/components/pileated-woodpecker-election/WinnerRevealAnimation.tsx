'use client';

import { useState, useEffect, useRef } from 'react';
import { Nomination } from '@/lib/election/types';

interface WinnerRevealAnimationProps {
    nominations: Nomination[];
    winnerId: string;
    onComplete: () => void;
}

export function WinnerRevealAnimation({ nominations, winnerId, onComplete }: WinnerRevealAnimationProps) {
    const [displayIdx, setDisplayIdx] = useState(0);
    const [phase, setPhase] = useState<'spinning' | 'slowing' | 'landed'>('spinning');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const winnerIdx = nominations.findIndex(n => n.id === winnerId);

    useEffect(() => {
        if (nominations.length === 0) {
            onComplete();
            return;
        }

        let iteration = 0;
        // Total spin iterations: 20 fast + 15 slow
        const fastRounds = 20;
        const slowRounds = 15;
        const totalRounds = fastRounds + slowRounds;

        const spin = (delay: number, iter: number) => {
            timeoutRef.current = setTimeout(() => {
                if (iter >= totalRounds) {
                    // Land on winner
                    setDisplayIdx(winnerIdx >= 0 ? winnerIdx : 0);
                    setPhase('landed');
                    setTimeout(onComplete, 2200);
                    return;
                }

                if (iter === fastRounds) setPhase('slowing');

                // For last few, steer toward winner index
                if (iter >= totalRounds - nominations.length) {
                    const stepsLeft = totalRounds - iter;
                    const targetIdx = winnerIdx >= 0 ? winnerIdx : 0;
                    const currentIdx = ((targetIdx - stepsLeft) % nominations.length + nominations.length) % nominations.length;
                    setDisplayIdx(currentIdx);
                } else {
                    setDisplayIdx(iter % nominations.length);
                }

                // Exponential slowdown: start at 60ms, end at ~500ms
                const t = iter / totalRounds;
                const nextDelay = iter < fastRounds
                    ? 60 + iter * 5
                    : 120 + (iter - fastRounds) * 28;

                spin(nextDelay, iter + 1);
            }, delay);
        };

        spin(60, 0);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [nominations.length, winnerId]);

    const current = nominations[displayIdx];
    const isLanded = phase === 'landed';
    const meta = current?.metadata;

    return (
        <div className="flex flex-col items-center justify-center py-16 select-none">
            {/* Label */}
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">
                {isLanded ? '🏆 And the winner is...' : '🎰 Rolling...'}
            </div>

            {/* Slot machine drum */}
            <div className={`relative border-4 w-full max-w-sm mx-auto overflow-hidden transition-all duration-300 ${
                isLanded
                    ? 'border-black shadow-[8px_8px_0px_#000] bg-yellow-50'
                    : 'border-gray-700 shadow-[4px_4px_0px_#555] bg-white'
            }`}>
                {/* Decorative side stripes */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isLanded ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${isLanded ? 'bg-yellow-400' : 'bg-gray-300'}`} />

                {/* Ghost row above */}
                <div className="h-10 flex items-center justify-center border-b border-dashed border-gray-200 opacity-20 overflow-hidden px-6">
                    {nominations[(displayIdx - 1 + nominations.length) % nominations.length]?.restaurantName}
                </div>

                {/* Main display */}
                <div className={`py-6 px-8 flex flex-col items-center justify-center text-center transition-all duration-150 ${
                    isLanded ? 'py-10' : ''
                }`}>
                    {meta?.photo && meta.photo !== '📍' && (
                        <div className={`text-5xl mb-3 transition-all duration-300 ${isLanded ? 'text-7xl mb-4' : ''}`}>
                            {meta.photo}
                        </div>
                    )}
                    <div className={`font-black uppercase tracking-tight leading-tight transition-all duration-150 ${
                        isLanded ? 'text-3xl text-black' : 'text-2xl text-gray-800'
                    }`}>
                        {current?.restaurantName || '—'}
                    </div>
                    {isLanded && meta?.address && (
                        <div className="text-xs text-gray-500 mt-2 font-mono">{meta.address}</div>
                    )}
                    {isLanded && (meta?.rating || meta?.priceLevel) && (
                        <div className="flex gap-2 mt-2 justify-center text-xs font-mono">
                            {meta?.rating && <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">★ {meta.rating}</span>}
                            {meta?.priceLevel && <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded">{meta.priceLevel}</span>}
                        </div>
                    )}
                </div>

                {/* Ghost row below */}
                <div className="h-10 flex items-center justify-center border-t border-dashed border-gray-200 opacity-20 overflow-hidden px-6">
                    {nominations[(displayIdx + 1) % nominations.length]?.restaurantName}
                </div>
            </div>

            {/* Spin indicator dots */}
            <div className="flex gap-2 mt-6">
                {nominations.map((_, i) => (
                    <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-100 ${
                            i === displayIdx
                                ? (isLanded ? 'bg-yellow-500 w-3' : 'bg-black')
                                : 'bg-gray-300'
                        }`}
                    />
                ))}
            </div>

            {isLanded && (
                <div className="mt-8 text-center animate-bounce">
                    <div className="text-3xl">🎉</div>
                </div>
            )}
        </div>
    );
}
