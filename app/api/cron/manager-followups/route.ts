import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runManagerFollowups } from "@/lib/notifications/manager-followups";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "manager-followups", status: "running", payload: { date: today } })
      .select()
      .single();

    const result = await runManagerFollowups(supabase);

    await supabase
      .from("automation_logs")
      .update({ status: "success", payload: { date: today, ...result } })
      .eq("id", log?.id ?? "");

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({ type: "manager-followups", status: "error", error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
