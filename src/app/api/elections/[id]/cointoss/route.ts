import { store } from "@/lib/election/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Toggle the caller's request for a random coin toss on a tied, completed
// election. The store enforces that the caller is a voter and only spins once a
// majority of voters have asked.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name : "";
    if (!name) {
        return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const election = await store.requestCoinToss(id, name);
    if (!election) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({
        coinToss: election.coinToss ?? { requesters: [] },
        winner: election.winner ?? null,
        winnerMethod: election.winnerMethod,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
