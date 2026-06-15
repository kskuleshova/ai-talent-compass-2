// Server-only AI gateway — OpenRouter

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

// Змінюй модель тут. Популярні безкоштовні варіанти на OpenRouter:
// "google/gemini-2.0-flash-exp:free"
// "meta-llama/llama-3.3-70b-instruct:free"
// "mistralai/mistral-7b-instruct:free"
// Платні (якісніші):
// "openai/gpt-4o-mini"
// "anthropic/claude-haiku-4-5"
const MODEL = "google/gemini-3.5-flash";

const SYSTEM = `Ти — AI-асистент рекрутера. Аналізуй резюме кандидата СУВОРО відповідно до вакансії.

Правила:
- Відповідай ВИКЛЮЧНО українською мовою.
- Використовуй ТІЛЬКИ інформацію з резюме та опису вакансії. Нічого не вигадуй.
- Якщо інформація відсутня або неоднозначна — клас "частково" або "не відповідає". Не додумуй за кандидата.
- Будь критичним, без води, без зайвих слів.
- Вихід — ВИКЛЮЧНО валідний JSON за вказаною схемою.`;

function buildPrompt(v: Vacancy, resumeText: string) {
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

РЕЗЮМЕ:
"""
${resumeText.slice(0, 15000)}
"""

Поверни ОДИН JSON-об'єкт точно такої структури (без markdown, без коментарів, лише чистий JSON):
{
  "matches": ["вимога яка прямо покрита в резюме"],
  "partial_matches": ["вимога де є сигнали але потрібно уточнити"],
  "missing": ["вимога яка відсутня в резюме"],
  "summary": {
    "current_role": "поточна або остання посада",
    "years_of_experience": "загальний досвід",
    "industries": ["галузь 1", "галузь 2"],
    "languages": ["мова 1", "мова 2"],
    "leadership_experience": "є / немає / є ознаки",
    "profile_summary": "коротке загальне позиціонування кандидата",
    "strengths": ["сильна сторона 1", "сильна сторона 2"],
    "overall_match_percent": 72,
    "next_steps": "конкретні наступні дії для рекрутера"
  },
  "risks": ["ризик або питання що потребує уточнення"],
  "suggested_questions": ["Питання 1?", "Питання 2?"],
  "recommendation": "Strong yes"
}

Поле "recommendation" — лише одне з: "Strong yes", "Yes", "Maybe Yes", "No", "Strong No".
Поле "overall_match_percent" — ціле число від 0 до 100.`;
}

export async function analyzeCandidate({
  vacancy,
  resumeText,
}: {
  vacancy: Vacancy;
  resumeText: string;
}): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      // Рекомендовано OpenRouter для ідентифікації проекту
      "HTTP-Referer": process.env.VITE_APP_URL ?? "https://ai-analyze-resumes.vercel.app",
      "X-Title": "AI-screening by Kiruka",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(vacancy, resumeText) },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${t.slice(0, 300)}`);
  }

  const json = await res.json();
  const rawText: string = json.choices?.[0]?.message?.content ?? "{}";

  // OpenRouter може повернути JSON у ```json блоці — очищаємо
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch
    ? jsonMatch[0]
    : rawText.replace(/```json|```/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("OpenRouter raw response:", rawText.slice(0, 500));
    throw new Error("OpenRouter повернув не-JSON відповідь");
  }

  const allowed: Verdict[] = ["Strong yes", "Yes", "Maybe Yes", "No", "Strong No"];
  const recommendation: Verdict = allowed.includes(parsed.recommendation)
    ? parsed.recommendation
    : "Maybe Yes";

  const summary = parsed.summary ?? {};
  const rawPercent = summary.overall_match_percent;
  const n = Number(rawPercent);
  summary.overall_match_percent = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;

  return {
    matches: arr(parsed.matches),
    partial_matches: arr(parsed.partial_matches),
    missing: arr(parsed.missing),
    summary,
    risks: arr(parsed.risks),
    suggested_questions: arr(parsed.suggested_questions),
    recommendation,
    model: json.model ?? MODEL, // OpenRouter повертає фактичну модель
  };
}

function arr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0);
}
