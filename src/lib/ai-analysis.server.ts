// Server-only Lovable AI gateway call for candidate analysis (Ukrainian).

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

const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `Ти — AI-асистент рекрутера. Аналізуй резюме кандидата СУВОРО відповідно до вакансії.

Правила:
- Відповідай ВИКЛЮЧНО українською мовою.
- Використовуй ТІЛЬКИ інформацію з резюме та опису вакансії. Нічого не вигадуй.
- Якщо інформація відсутня або неоднозначна — клас "частково" або "не відповідає". Не додумуй за кандидата.
- Будь критичним, без води, без зайвих слів.
- Вихід — ВИКЛЮЧНО валідний JSON за вказаною схемою.`;

function buildUserPrompt(v: Vacancy, resumeText: string) {
  return `ВАКАНСІЯ
Назва: ${v.title}

Опис вакансії:
${v.job_description || "(немає)"}

Бриф від наймаючого менеджера:
${v.hiring_manager_brief || "(немає)"}

Обов'язкові вимоги:
${v.must_have || "(немає)"}

Бажані вимоги:
${v.nice_to_have || "(немає)"}

Скринінгові питання (контекст):
${v.screening_questions || "(немає)"}

Тестове завдання:
${v.test_task || "(немає)"}

Історичний фідбек по попередніх кандидатах:
${v.historical_feedback || "(немає)"}

РЕЗЮМЕ (текст, витягнутий з файлу кандидата):
"""
${resumeText.slice(0, 15000)}
"""

Поверни ОДИН JSON-об'єкт точно такої структури:
{
  "matches": string[],            // вимоги, які ПРЯМО і ЧІТКО збігаються з резюме
  "partial_matches": string[],    // вимоги, де є сигнали, але потрібно уточнити (рівень, обсяг, суміжний досвід тощо)
  "missing": string[],            // вимоги, які не покриті в резюме або не мають жодних ознак відповідності
  "summary": {
    "current_role": string,
    "years_of_experience": string,
    "industries": string[],
    "languages": string[],
    "leadership_experience": string,
    "profile_summary": string,      // коротке загальне позиціонування кандидата
    "strengths": string[],          // ключові сильні сторони
    "overall_match_percent": number,// 0-100, загальний % відповідності вакансії
    "next_steps": string            // конкретні наступні дії для рекрутера відповідно до висновку
  },
  "risks": string[],              // ризики / питання, що потребують уточнення (тільки на основі резюме)
  "suggested_questions": string[],// 5-10 скринінгових питань українською
  "recommendation": "Strong yes" | "Yes" | "Maybe Yes" | "No" | "Strong No"
}

Поверни лише JSON без коментарів і без markdown.`;
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

  if (res.status === 429) throw new Error("Перевищено ліміт AI. Спробуйте за хвилину.");
  if (res.status === 402) throw new Error("Закінчились AI-кредити. Поповніть баланс у налаштуваннях воркспейсу.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("AI повернув не-JSON відповідь"); }

  const allowed: Verdict[] = ["Strong yes", "Yes", "Maybe Yes", "No", "Strong No"];
  const recommendation: Verdict = allowed.includes(parsed.recommendation) ? parsed.recommendation : "Maybe Yes";

  const summary = parsed.summary ?? {};
  if (typeof summary.overall_match_percent !== "number") {
    const n = Number(summary.overall_match_percent);
    summary.overall_match_percent = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  } else {
    summary.overall_match_percent = Math.max(0, Math.min(100, Math.round(summary.overall_match_percent)));
  }

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
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0);
}
