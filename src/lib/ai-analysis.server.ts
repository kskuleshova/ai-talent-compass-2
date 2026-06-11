// Server-only Lovable AI gateway call for candidate analysis.

type Vacancy = {
  title: string;
  job_description?: string | null;
  hiring_manager_brief?: string | null;
  must_have?: string | null;
  nice_to_have?: string | null;
  screening_questions?: string | null;
  test_task?: string | null;
  historical_feedback?: string | null;
};

export type AnalysisResult = {
  matches: string[];
  partial_matches: string[];
  missing: string[];
  summary: {
    current_role?: string;
    years_of_experience?: string;
    industries?: string[];
    languages?: string[];
    leadership_experience?: string;
  };
  risks: string[];
  suggested_questions: string[];
  recommendation: "Strong Match" | "Moderate Match" | "Weak Match";
  model: string;
};

const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `You are an expert recruiter assistant. You analyze a candidate's resume strictly against a vacancy brief.

Strict rules:
- Use ONLY information present in the resume and in the vacancy brief.
- Never invent facts, employers, dates, education, or skills.
- If something is unclear or missing, classify it as "partial" or "missing" — do not guess.
- Be concise, factual, recruiter-friendly. No flattery.
- Output MUST be valid JSON matching the requested schema exactly.`;

function buildUserPrompt(v: Vacancy, resumeText: string) {
  return `VACANCY
Title: ${v.title}

Job description:
${v.job_description || "(none)"}

Hiring manager brief:
${v.hiring_manager_brief || "(none)"}

Must-have requirements:
${v.must_have || "(none)"}

Nice-to-have requirements:
${v.nice_to_have || "(none)"}

Screening questions (for context):
${v.screening_questions || "(none)"}

Test task:
${v.test_task || "(none)"}

Historical feedback from past hires:
${v.historical_feedback || "(none)"}

RESUME (verbatim text extracted from the candidate's file):
"""
${resumeText.slice(0, 15000)}
"""

Produce ONE JSON object with this exact shape:
{
  "matches": string[],            // requirements clearly covered, each as a short factual sentence
  "partial_matches": string[],    // requirements partially covered or needing clarification
  "missing": string[],            // requirements not found in the resume
  "summary": {
    "current_role": string,       // empty string if unknown
    "years_of_experience": string,// e.g. "8+ years" or empty
    "industries": string[],
    "languages": string[],
    "leadership_experience": string
  },
  "risks": string[],              // concerns based ONLY on resume (gaps, job-hopping, mismatched seniority, etc.)
  "suggested_questions": string[],// 5-10 recruiter questions to clarify missing info
  "recommendation": "Strong Match" | "Moderate Match" | "Weak Match"
}

Return JSON only, no prose, no markdown fences.`;
}

export async function analyzeCandidate({ vacancy, resumeText }: { vacancy: Vacancy; resumeText: string }): Promise<AnalysisResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserPrompt(vacancy, resumeText) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace settings.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("AI returned non-JSON response"); }

  return {
    matches: arr(parsed.matches),
    partial_matches: arr(parsed.partial_matches),
    missing: arr(parsed.missing),
    summary: parsed.summary ?? {},
    risks: arr(parsed.risks),
    suggested_questions: arr(parsed.suggested_questions),
    recommendation: ["Strong Match", "Moderate Match", "Weak Match"].includes(parsed.recommendation)
      ? parsed.recommendation : "Moderate Match",
    model: MODEL,
  };
}

function arr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0);
}
