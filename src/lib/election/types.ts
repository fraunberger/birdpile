import type { RankedPairsResult } from "./rankedPairs";

export type ElectionStatus = 'nomination' | 'voting' | 'completed' | 'cancelled';
export type BallotVisibility = 'secret' | 'open';

export type TiebreakReason = 'sole_loser' | 'lookahead' | 'most_last_place' | 'timing';

export type WinnerMethod = "Condorcet" | "Instant Runoff" | "Ranked Pairs";

export interface MajorityOutcome {
    type: 'majority';
    winnerId: string;
    count: number;
    total: number;
}

export interface EliminateOutcome {
    type: 'eliminate';
    eliminatedId: string;
    reason: TiebreakReason;
    tiedCandidates: string[];
    lookaheadProjections?: Record<string, { winnerId: string | null; clean: boolean }>;
    lastPlaceCounts?: Record<string, number>;
    earliestFirstVoteTimes?: Record<string, number>;
}

export interface NoActiveVotesOutcome {
    type: 'no_active_votes';
}

export type RoundOutcome = MajorityOutcome | EliminateOutcome | NoActiveVotesOutcome;

export interface IRVRound {
    roundNumber: number;
    candidates: string[];
    counts: Record<string, number>;
    totalActiveVotes: number;
    outcome: RoundOutcome;
}

export interface Nomination {
    id: string;
    nominatorName: string;
    restaurantName: string;
    modifications?: string;
    isWriteIn?: boolean;
    createdAt: number;
    // Rich Data (Simulated for Coot)
    metadata?: {
        address?: string;
        rating?: number;
        reviewCount?: number;
        photo?: string;
        priceLevel?: string; // $, $$, $$$
    };
}

export interface Vote {
    voterName: string;
    rankings: string[]; // array of nomination IDs in order of preference
    createdAt: number;
}

export interface Election {
    id: string;
    name: string; // "Dinner" or custom
    groupCodeword: string;
    adminName: string;

    // Scheduling
    voteStartTime: number; // Unix timestamp

    // State
    state?: ElectionStatus; // Manual override status
    ballotVisibility: BallotVisibility;
    participants: string[];
    nominations: Nomination[];
    votes: Vote[];

    // Computed or explicitly set
    createdAt: number;
    votingAlgorithm?: 'condorcet' | 'irv'; // default: 'irv'
    winner?: string | null;
    winnerMethod?: WinnerMethod;
    tieBroken?: boolean;
    winnerVoteTime?: number;
    irvRounds?: IRVRound[];
    rankedPairs?: RankedPairsResult;
}
