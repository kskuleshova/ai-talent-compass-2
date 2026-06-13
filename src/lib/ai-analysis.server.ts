// Server-only Lovable AI gateway call for candidate analysis (Ukrainian).
 
import { GoogleAuth } from "google-auth-library";

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

export type Verdict = "Strong yes" | "Yes" | "Maybe Yes" | "No" | "Strong No";

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
    profile_summary?: string;
    strengths?: string[];
    overall_match_percent?: number;
    next_steps?: string;
  };
  risks: string[];
  suggested_questions: string[];
  recommendation: Verdict;
  model: string;
};

const MODEL = "gemini-2.0-flash-lite";

const SYSTEM = `Ти — AI-асистент рекрутера. Аналізуй резюме кандидата СУВОРО відповідно до вакансії.

Правила:
- Відповідай ВИКЛЮЧНО українською мовою.
- Використовуй ТІЛЬКИ інформацію з резюме та опису вакансії. Нічого не вигадуй.
- Якщо інформація відсутня або неоднозначна — клас "частково" або "не відповідає".
- Будь критичним, без води.
- Вихід — ВИКЛЮЧНО валідний JSON.`;

function buildPrompt(v: Vacancy, resumeText: string) {
  return `${SYSTEM}

ВАКАНСІЯ
Назва: ${v.title}

Опис вакансії:
${v.job_description || "(немає)"}

Бриф:
${v.hiring_manager_brief || "(немає)"}

Обов'язкові вимоги:
${v.must_have || "(немає)"}

Бажані вимоги:
${v.nice_to_have || "(немає)"}

Скринінгові питання:
${v.screening_questions || "(немає)"}

Тестове:
${v.test_task || "(немає)"}

Історичний фідбек:
${v.historical_feedback || "(немає)"}

РЕЗЮМЕ:
"""
${resumeText.slice(0, 15000) || "(резюме не вдалось прочитати)"}
"""

Поверни ОДИН JSON-об'єкт точно такої структури:
{
  "matches": [],
  "partial_matches": [],
  "missing": [],
  "summary": {
    "current_role": "",
    "years_of_experience": "",
    "industries": [],
    "languages": [],
    "leadership_experience": "",
    "profile_summary": "",
    "strengths": [],
    "overall_match_percent": 72,
    "next_steps": ""
  },
  "risks": [],
  "suggested_questions": [],
  "recommendation": "Strong yes"
}`;
}

export async function analyzeCandidate({
  vacancy,
  resumeText,
}: {
  vacancy: Vacancy;
  resumeText: string;
}): Promise<AnalysisResult> {
  const projectId = process.env.GCP_PROJECT_ID;
  const saKey = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (!projectId) throw new Error("GCP_PROJECT_ID not set");
  if (!saKey) throw new Error("GCP_SERVICE_ACCOUNT_KEY not set");

  const credentials = JSON.parse(saKey);

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(vacancy, resumeText) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vertex AI error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  const cleaned = rawText.replace(/```json|```/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Vertex AI повернув не-JSON відповідь");
  }

  const allowed: Verdict[] = ["Strong yes", "Yes", "Maybe Yes", "No", "Strong No"];
  const recommendation: Verdict = allowed.includes(parsed.recommendation)
    ? parsed.recommendation
    : "Maybe Yes";

  const summary = parsed.summary ?? {};
  const n = Number(summary.overall_match_percent);
  summary.overall_match_percent = Number.isFinite(n)
    ? Math.max(0, Math.min(100, Math.round(n)))
    : 0;

  return {
    matches: arr(parsed.matches),
    partial_matches: arr(parsed.partial_matches),
    missing: arr(parsed.missing),
    summary,
    risks: arr(parsed.risks),
    suggested_questions: arr(parsed.suggested_questions),
    recommendation,
    model: MODEL,
  };
}

function arr(v: any): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];
}
