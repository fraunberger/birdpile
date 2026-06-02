import { store } from "@/lib/election/store";
import { calculatePairwiseMatrix, determineCondorcetWinner } from "@/lib/election/condorcet";
import { calculateIRV } from "@/lib/election/irv";
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
    if (status === 'completed') {
        if (!winner || !irvRounds) {
            const irvResult = calculateIRV(election.nominations, election.votes);
            irvRounds = irvRounds ?? irvResult.rounds;
            if (!winner) {
                if (election.votingAlgorithm === 'condorcet') {
                    winner = determineCondorcetWinner(election.nominations, election.votes) ?? irvResult.winnerId;
                } else {
                    winner = irvResult.winnerId;
                }
            }
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
