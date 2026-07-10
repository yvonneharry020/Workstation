import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Holds the Daily.co API key server-side only. It must be set as a Supabase
// Edge Function secret (DAILY_API_KEY), never as an EXPO_PUBLIC_* mobile env
// var — that prefix ships straight into the client bundle, which is the bug
// this function replaces.
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface CreateRoomBody {
  jobPostingId: string;
  jobTitle: string;
  interviewType: "live" | "scheduled";
  scheduledAt: string | null;
}

interface EndRoomBody {
  roomId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!DAILY_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Server misconfigured: missing DAILY_API_KEY secret" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  // Scoped to the caller's own JWT — every read/write below runs as that
  // user, so the existing interview_rooms RLS policy (company_id =
  // auth.uid()) is enforced exactly as it was for the old client-side code.
  // This function never uses a service-role key.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }
  const companyId = userData.user.id;

  try {
    if (req.method === "POST") {
      const body = (await req.json()) as CreateRoomBody;
      if (!body.jobPostingId || !body.jobTitle || !body.interviewType) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }

      const roomName = `ivw-${companyId.slice(0, 8)}-${Date.now()}`;

      const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "public",
          properties: {
            max_participants: 10,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            enable_chat: true,
            enable_people_ui: true,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });

      if (!dailyRes.ok) {
        const err = (await dailyRes.json().catch(() => ({}))) as { error?: string };
        return jsonResponse({ error: err.error ?? "Failed to create room on Daily.co" }, 502);
      }
      const daily = (await dailyRes.json()) as { url: string; name: string };

      const { data: room, error: insertErr } = await supabase
        .from("interview_rooms")
        .insert({
          company_id: companyId,
          room_name: daily.name,
          room_url: daily.url,
          label: body.jobTitle,
          job_posting_id: body.jobPostingId,
          job_title: body.jobTitle,
          interview_type: body.interviewType,
          scheduled_at: body.scheduledAt,
          status: "active",
        })
        .select()
        .single();

      if (insertErr) {
        // Daily room now exists but the DB write failed — clean up so we
        // don't leak an orphaned room the company can never see or close.
        await fetch(`https://api.daily.co/v1/rooms/${daily.name}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        }).catch(() => {});
        return jsonResponse({ error: insertErr.message }, 500);
      }

      return jsonResponse({ room });
    }

    if (req.method === "DELETE") {
      const body = (await req.json()) as EndRoomBody;
      if (!body.roomId) {
        return jsonResponse({ error: "Missing roomId" }, 400);
      }

      // RLS already scopes this select to the caller's own rooms, so a
      // stranger's roomId simply matches nothing here.
      const { data: existing, error: fetchErr } = await supabase
        .from("interview_rooms")
        .select("room_name")
        .eq("id", body.roomId)
        .single();

      if (fetchErr || !existing) {
        return jsonResponse({ error: "Room not found" }, 404);
      }

      await fetch(`https://api.daily.co/v1/rooms/${existing.room_name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      }).catch(() => {});

      const { error: updateErr } = await supabase
        .from("interview_rooms")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", body.roomId);

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
