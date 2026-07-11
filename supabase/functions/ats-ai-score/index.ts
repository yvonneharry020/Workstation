import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Fixed HR-persona system prompt — not editable by the company. Combined at
// request time with the company's own criteria (the actual variable part).
const SYSTEM_PROMPT = `You are an experienced HR professional with 15+ years of recruitment experience across multiple industries, screening candidates on behalf of the hiring company. You will be given the job's requirements, the company's specific scoring criteria, and a list of candidates with their profile data, verified badges, and screening question answers.

For each candidate, produce a match score from 0-100 and clear reasoning:
- Score strictly against the criteria the company explicitly gave you — nothing else. If the company's criteria explicitly names a characteristic (for example a specific gender, age range, or location requirement stated as part of the job's genuine requirements), you may score against it, because they set it deliberately for their own business reasons. What you must never do is infer, assume, or penalize a candidate based on gender, age, ethnicity, or any other characteristic that is present in their data but was NOT explicitly part of the criteria the company gave you.
- A company-verified badge (one employer confirmed this specific job) and an admin-verified badge (Workstation staff confirmed the entire profile) are not interchangeable when criteria require a specific one.
- Always state which criteria matched and which were missing.
- If data is insufficient to judge a criterion, say so rather than guessing.
- Never fabricate a score or reasoning for a candidate — every score must be grounded in the actual data provided for that specific candidate, and nothing else.
- Every result you return must use the exact applicationId given for that candidate. Never swap, guess, or reuse an applicationId — a score attached to the wrong candidate is worse than no score at all.
- Output strict JSON only, matching the given schema.`;

interface Criteria {
  customInstructions?: string;
  mustHaveSkills?: string[];
  niceToHaveSkills?: string[];
  minYearsExperience?: number | null;
  requiredDegree?: string | null;
  requiredBadges?: ("admin" | "company")[];
  allowedColumns?: string[];
  updatedAt?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Server misconfigured: missing GROQ_API_KEY secret" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  // Scoped to the caller's own JWT — every read/write below runs as that
  // user, so job_postings/job_applications RLS (company owns this job)
  // is enforced exactly as it would be for a direct client call. No
  // service-role key.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  try {
    const body = (await req.json()) as { jobId?: string; criteria?: Criteria };
    if (!body.jobId) {
      return jsonResponse({ error: "Missing jobId" }, 400);
    }

    // Save criteria if provided — this is what makes "save filter" and
    // "run scoring" a single action from the modal. If omitted, re-use
    // whatever's already saved on the job.
    let criteria: Criteria | null = body.criteria ?? null;
    if (body.criteria) {
      const { error: saveErr } = await supabase
        .from("job_postings")
        .update({ ai_match_criteria: { ...body.criteria, updatedAt: new Date().toISOString() } })
        .eq("id", body.jobId);
      if (saveErr) return jsonResponse({ error: saveErr.message }, 500);
    } else {
      const { data: job } = await supabase.from("job_postings").select("ai_match_criteria").eq("id", body.jobId).maybeSingle();
      criteria = (job?.ai_match_criteria as Criteria | null) ?? null;
    }

    if (!criteria) {
      return jsonResponse({ error: "No scoring criteria set for this job yet" }, 400);
    }

    const { data: job, error: jobErr } = await supabase
      .from("job_postings")
      .select("id, title, requirements, screening_questions")
      .eq("id", body.jobId)
      .single();
    if (jobErr || !job) {
      return jsonResponse({ error: "Job not found or not owned by your company" }, 404);
    }

    const allowed = new Set(criteria.allowedColumns ?? ["full_name", "profile", "screening"]);

    const { data: applications, error: appsErr } = await supabase
      .from("job_applications")
      .select(`
        id, candidate_id, cover_note, screening_answers,
        candidate_profiles!candidate_id (
          first_name, last_name, headline, bio, tools, updated_at,
          candidate_work_history(company_name, role_title, start_date, end_date, is_current),
          candidate_education(institution, degree, field_of_study, end_year),
          candidate_skills(skills(name))
        )
      `)
      .eq("job_id", body.jobId);
    if (appsErr) return jsonResponse({ error: appsErr.message }, 500);

    const criteriaHash = await sha256Hex(JSON.stringify(criteria));

    // Only fetch badges when the criteria actually asks for them.
    let badgesByCandidateId = new Map<string, Set<string>>();
    if (criteria.requiredBadges && criteria.requiredBadges.length > 0) {
      const candidateIds = (applications ?? []).map((a) => a.candidate_id);
      const { data: badges } = await supabase
        .from("badges")
        .select("recipient_id, badge_type")
        .in("recipient_id", candidateIds)
        .eq("status", "active");
      badgesByCandidateId = (badges ?? []).reduce((map, b) => {
        const set = map.get(b.recipient_id) ?? new Set<string>();
        set.add(b.badge_type);
        map.set(b.recipient_id, set);
        return map;
      }, new Map<string, Set<string>>());
    }

    type AppRow = typeof applications extends (infer T)[] | null ? T : never;

    // Skip candidates already scored against this exact criteria whose
    // profile hasn't changed since — avoids re-paying for a full re-score
    // on every filter tweak or repeat run.
    const { data: existingScores } = await supabase
      .from("job_applications")
      .select("id, ai_match_analysis")
      .eq("job_id", body.jobId);
    const cachedIds = new Set(
      (existingScores ?? [])
        .filter((r) => {
          const analysis = r.ai_match_analysis as { criteriaHash?: string; scoredAt?: string } | null;
          if (!analysis?.criteriaHash || analysis.criteriaHash !== criteriaHash) return false;
          const app = (applications ?? []).find((a) => a.id === r.id) as AppRow | undefined;
          const cp = (app as unknown as { candidate_profiles: { updated_at: string } | null })?.candidate_profiles;
          if (!cp?.updated_at || !analysis.scoredAt) return false;
          return new Date(cp.updated_at) <= new Date(analysis.scoredAt);
        })
        .map((r) => r.id)
    );

    const toScore = (applications ?? []).filter((a) => !cachedIds.has(a.id));
    if (toScore.length === 0) {
      return jsonResponse({ scored: 0, skipped: cachedIds.size });
    }

    const candidatePayload = toScore.map((app) => {
      const cp = (app as unknown as {
        candidate_profiles: {
          first_name: string; last_name: string; headline: string | null; bio: string | null; tools: string[] | null
          candidate_work_history: { company_name: string; role_title: string; start_date: string; end_date: string | null; is_current: boolean }[]
          candidate_education: { institution: string; degree: string; field_of_study: string | null; end_year: number | null }[]
          candidate_skills: { skills: { name: string } | null }[]
        } | null
      }).candidate_profiles;

      const entry: Record<string, unknown> = { candidateId: app.candidate_id, applicationId: app.id };
      if (allowed.has("full_name") && cp) entry.fullName = `${cp.first_name} ${cp.last_name}`.trim();
      if (allowed.has("cover") ) entry.coverNote = app.cover_note;
      if (allowed.has("profile") && cp) {
        entry.headline = cp.headline;
        entry.bio = cp.bio;
        entry.tools = cp.tools ?? [];
        entry.skills = (cp.candidate_skills ?? []).map((s) => s.skills?.name).filter(Boolean);
        entry.workHistory = cp.candidate_work_history ?? [];
        entry.education = cp.candidate_education ?? [];
      }
      if (allowed.has("screening")) entry.screeningAnswers = app.screening_answers;
      if (criteria!.requiredBadges && criteria!.requiredBadges.length > 0) {
        entry.badges = Array.from(badgesByCandidateId.get(app.candidate_id) ?? []);
      }
      return entry;
    });

    const userPrompt = JSON.stringify({
      job: { title: job.title, requirements: job.requirements, screeningQuestions: job.screening_questions },
      criteria,
      candidates: candidatePayload,
    });

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${userPrompt}\n\nRespond with a JSON object of shape { "results": [{ "applicationId": string, "score": number, "matchedCriteria": string[], "missingCriteria": string[], "reasoning": string }] }.`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return jsonResponse({ error: `Groq request failed: ${errText}` }, 502);
    }

    const groqJson = await groqRes.json();
    const content = groqJson?.choices?.[0]?.message?.content;
    if (!content) return jsonResponse({ error: "Groq returned no content" }, 502);

    const parsed = JSON.parse(content) as { results: { applicationId: string; score: number; matchedCriteria: string[]; missingCriteria: string[]; reasoning: string }[] };

    // The model echoes back applicationId itself — never trust that echo
    // blindly. A hallucinated or mismatched id would otherwise write one
    // candidate's score onto a completely different candidate's row. Only
    // ids that were actually sent to the model in this exact batch are
    // eligible to be written.
    const sentApplicationIds = new Set(toScore.map((a) => a.id));
    const validResults = (parsed.results ?? []).filter((r) => sentApplicationIds.has(r.applicationId));
    const rejectedCount = (parsed.results?.length ?? 0) - validResults.length;

    const now = new Date().toISOString();
    for (const result of validResults) {
      await supabase
        .from("job_applications")
        .update({
          skills_match_pct: Math.max(0, Math.min(100, Math.round(result.score))),
          ai_match_analysis: {
            matchedCriteria: result.matchedCriteria ?? [],
            missingCriteria: result.missingCriteria ?? [],
            reasoning: result.reasoning ?? "",
            criteriaHash,
            scoredAt: now,
            model: "llama-3.3-70b-versatile",
          },
        })
        .eq("id", result.applicationId);
    }

    return jsonResponse({ scored: validResults.length, skipped: cachedIds.size, rejectedInvalidId: rejectedCount });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
