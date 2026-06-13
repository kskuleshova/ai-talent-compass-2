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

const MODEL = "gemini-2.0-flash-lite";

const SYSTEM = `Ти — AI-асистент рекрутера. Аналізуй резюме кандидата СУВОРО відповідно до вакансії.

Правила:
- Відповідай ВИКЛЮЧНО українською мовою.
- Використовуй ТІЛЬКИ інформацію з резюме та опису вакансії. Нічого не вигадуй.
- Якщо інформація відсутня або неоднозначна — клас "частково" або "не відповідає". Не додумуй за кандидата.
- Будь критичним, без води, без зайвих слів.
- Вихід — ВИКЛЮЧНО валідний JSON за вказаною схемою.`;

function buildPrompt(v: Vacancy, resumeText: string) {
  return `${SYSTEM}

ВАКАНСІЯ
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
${resumeText.slice(0, 15000) || "(резюме не вдалось прочитати, проаналізуй на основі вакансії)"}
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

// ---------------------------------------------------------
// 🔥 Ось тут починається твоя функція analyzeCandidate
// ---------------------------------------------------------

export async function analyzeCandidate({
  vacancy,
  resumeText,
}: {
  vacancy: Vacancy;
  resumeText: string;
}): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Gemini apiKey present:", !!apiKey, "length:", apiKey?.length);
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  // 🔥 ДОДАНО — правильний URL у лапках
  const url = https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey};

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(vacancy, resumeText) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });

  console.log("Gemini response status:", res.status);

  if (!res.ok) {const t = await res.text().catch(() => "");
    console.error("Gemini error response:", t.slice(0, 500));
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 300)}`);
  }

  // 🔥 ДОДАНО — читаємо JSON
  const json = await res.json();

  // 🔥 ДОДАНО — дістаємо текст з моделі
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned empty response");

  // 🔥 ДОДАНО — повертаємо розпарсений JSON
  return JSON.parse(raw);
}
