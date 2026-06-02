import { store } from "@/lib/election/store";
import { calculatePairwiseMatrix } from "@/lib/election/condorcet";
import { resolveElectionWinner } from "@/lib/election/resolve";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const election = await store.getElection(id);

    if (!election) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const now = Date.now();
    const votingEndsAt = election.voteStartTime + 10 * 60 * 1000;

    let status = election.state || 'nomination';
    let winner: string | null = election.winner || null;
    const ballotVisibility = election.ballotVisibility || "secret";

    if (!election.state) {
        if (now >= election.voteStartTime) {
            status = 'voting';
        }
        if (now >= votingEndsAt) {
            status = 'completed';
        }
    }

    let matrix = null;
    let irvRounds = election.irvRounds;
    let winnerMethod = election.winnerMethod;
    let tieBroken = !!election.tieBroken;
    let winnerVoteTime = election.winnerVoteTime;
    let rankedPairs = election.rankedPairs;
    let tiedOptions = election.tiedOptions;
    let decidedBySpeed = !!election.decidedBySpeed;
    let borda = election.borda;
    let speed = election.speed;
    if (status === 'completed') {
        if (!winner || !irvRounds) {
            // Resolve through the single source of truth so a lazily-completed
            // election can never disagree with a finalized one.
            const resolved = resolveElectionWinner(election.nominations, election.votes);
            winner = winner ?? resolved.winnerId;
            winnerMethod = winnerMethod ?? resolved.method;
            if (election.tieBroken === undefined) tieBroken = resolved.tieBroken;
            winnerVoteTime = winnerVoteTime ?? resolved.winnerVoteTime;
            rankedPairs = rankedPairs ?? resolved.rankedPairs;
            irvRounds = irvRounds ?? resolved.irvRounds;
            tiedOptions = tiedOptions ?? resolved.tiedOptions;
            if (election.decidedBySpeed === undefined) decidedBySpeed = resolved.decidedBySpeed;
            borda = borda ?? resolved.borda;
            speed = speed ?? resolved.speed;
        }
        if (ballotVisibility === "open") {
            matrix = calculatePairwiseMatrix(election.nominations, election.votes);
        }
    }

    const shouldHideRankings = ballotVisibility === "secret" && status === "completed";
    const safeVotes = shouldHideRankings
        ? election.votes.map((vote) => ({ ...vote, rankings: [] }))
        : election.votes;
    const ballots = status === "completed" && ballotVisibility === "open"
        ? election.votes.map((vote) => ({
            voterName: vote.voterName,
            rankings: vote.rankings.map((nominationId) => {
                const nomination = election.nominations.find((item) => item.id === nominationId);
                return {
                    nominationId,
                    restaurantName: nomination?.restaurantName || "Unknown",
                };
            }),
        }))
        : null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { groupCodeword: _pw, votes: _votes, ...safeElection } = election;

    return NextResponse.json({
        ...safeElection,
        ballotVisibility,
        votes: safeVotes,
        status,
        winner,
        winnerMethod,
        tieBroken,
        winnerVoteTime,
        rankedPairs,
        tiedOptions,
        decidedBySpeed,
        borda,
        speed,
        ballots,
        matrix,
        irvRounds,
        votingEndsAt
    }, {
        headers: {
            "Cache-Control": "no-store, max-age=0",
        },
    });
}
