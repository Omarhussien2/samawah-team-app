import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotification, createNotificationForMany } from "@/lib/notifications/create-notification";

// GET /api/comments?task_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const taskId = request.nextUrl.searchParams.get("task_id");
  if (!taskId) {
    return NextResponse.json({ error: "task_id مطلوب" }, { status: 400 });
  }

  const { data: comments, error } = await supabase
    .from("comments")
    .select("*, user:profiles(id, full_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(comments ?? []);
}

// POST /api/comments  { task_id, body }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: { task_id: string; body: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  if (!body.task_id || !body.body?.trim()) {
    return NextResponse.json({ error: "task_id و body مطلوبان" }, { status: 400 });
  }

  // Insert comment
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      task_id: body.task_id,
      user_id: user.id,
      body: body.body.trim(),
    })
    .select("*, user:profiles(id, full_name, avatar_url)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // --- Notification Logic (using service client to bypass RLS for notification inserts) ---
  const serviceClient = createServiceClient();

  // Get task details
  const { data: task } = await serviceClient
    .from("tasks")
    .select("id, title, project_id, owner_id")
    .eq("id", body.task_id)
    .single();

  if (task) {
    // Get commenter's name
    const { data: commenter } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const commenterName = commenter?.full_name ?? "مستخدم";
    const notifyUserIds: string[] = [];

    // 1. Notify task owner (if not the commenter)
    if (task.owner_id && task.owner_id !== user.id) {
      notifyUserIds.push(task.owner_id);
    }

    // 2. Notify project manager (if not already notified and not the commenter)
    if (task.project_id) {
      const { data: project } = await serviceClient
        .from("projects")
        .select("manager_id")
        .eq("id", task.project_id)
        .single();

      if (project?.manager_id && project.manager_id !== user.id && !notifyUserIds.includes(project.manager_id)) {
        notifyUserIds.push(project.manager_id);
      }
    }

    // 3. Check for @mentions in the comment body
    const mentionRegex = /@([\p{L}\p{N}\s]+?)(?=\s|@|$)/gu;
    const mentions = [...body.body.matchAll(mentionRegex)].map((m) => m[1].trim());

    if (mentions.length > 0) {
      const { data: mentionedUsers } = await serviceClient
        .from("profiles")
        .select("id, full_name")
        .eq("active", true);

      for (const mentioned of mentionedUsers ?? []) {
        if (
          mentioned.id !== user.id &&
          !notifyUserIds.includes(mentioned.id) &&
          mentions.some((m) => mentioned.full_name?.includes(m))
        ) {
          // Mention notification
          await createNotification({
            user_id: mentioned.id,
            project_id: task.project_id,
            task_id: task.id,
            type: "mention",
            title: `تمت الإشارة إليك في تعليق`,
            body: `أشار ${commenterName} إليك في تعليق على "${task.title}"`,
          });
        }
      }
    }

    // Send regular comment notifications to owner/manager
    if (notifyUserIds.length > 0) {
      await createNotificationForMany(notifyUserIds, {
        project_id: task.project_id,
        task_id: task.id,
        type: "comment",
        title: "تعليق جديد على مهمتك",
        body: `${commenterName} علّق على "${task.title}": ${body.body.substring(0, 100)}${body.body.length > 100 ? "..." : ""}`,
      });
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
