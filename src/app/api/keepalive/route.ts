import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const [chores, elections] = await Promise.all([
    supabase.from("chores").select("id").limit(1),
    supabase.from("elections").select("id").limit(1),
  ]);

  if (chores.error || elections.error) {
    return NextResponse.json(
      {
        ok: false,
        error: chores.error?.message ?? elections.error?.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
