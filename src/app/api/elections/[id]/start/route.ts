import { store } from "@/lib/election/store";
import { NextResponse } from "next/server";
import { verifyCodeword } from "@/lib/election/auth";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { groupCodeword } = body;

    const election = await store.getElection(id);
    if (!election) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    // Validate codeword for admin actions
    const isValid = await verifyCodeword(groupCodeword, election.groupCodeword);
    if (!isValid) {
        return NextResponse.json({ error: "Invalid Codeword" }, { status: 403 });
    }

    await store.startVoting(id);
    return NextResponse.json({ success: true });
}
