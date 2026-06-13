import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCandidate, addNote, reanalyzeCandidate, updateAnalysis } from "@/lib/candidates.functions";
import { ArrowLeft, FileText, Sparkles, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";і
import { RecommendationBadge } from "./vacancies.$id";

export const Route = createFileRoute("/_authenticated/candidates/$id")({
  head: () => ({ meta: [{ title: "Кандидат — Hirelens" }] }),
  component: CandidatePage,
});

function CandidatePage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCandidate);
  const noteFn = useServerFn(addNote);
  const reFn = useServerFn(reanalyzeCandidate);
  const updateFn = useServerFn(updateAnalysis);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["candidate", id], queryFn: () => fn({ data: { id } }) });

  const [noteBody, setNoteBody] = useState("");
  const [extra, setExtra] = useState("");

  const noteMut = useMutation({
    mutationFn: () => noteFn({ data: { candidate_id: id, body: noteBody.trim() } }),
    onSuccess: () => {
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Нотатку додано");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  const reanalyzeMut = useMutation({
    mutationFn: () => reFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Переаналізовано");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  const extraMut = useMutation({
    mutationFn: () => updateFn({ data: { candidate_id: id, extra: extra.trim() } }),
    onSuccess: () => {
      setExtra("");
      qc.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Доповнення збережено");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  if (!data)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      </div>
    );

  const { candidate, notes, resume_url } = data;
  const analysis: any = data.analysis;
  const percent: number | undefined = analysis?.summary?.overall_match_percent;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/vacancies/$id"
        params={{ id: candidate.vacancy_id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {candidate.vacancies?.title}
      </Link>

      <header className="mt-4 flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
            {candidate.name
              .split(" ")
              .map((p: string) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{candidate.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {analysis ? <>Проаналізовано {new Date(analysis.created_at).toLocaleString("uk-UA")}</> : "Аналізу ще немає"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {resume_url && (
            <a
              href={resume_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <FileText className="h-4 w-4" /> Резюме
            </a>
          )}

          <button
            onClick={() => reanalyzeMut.mutate()}
            disabled={reanalyzeMut.isPending || !candidate.resume_text}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {reanalyzeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Переаналізувати
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* LEFT COLUMN — AI ANALYSIS */}
        <section className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-medium">AI-аналіз</h2>
              </div>
              <RecommendationBadge value={analysis?.recommendation} status={candidate.status} />
            </div>

            {!analysis ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {candidate.status === "analyzing" ? "Аналіз триває…" : "Аналізу ще немає."}
              </p>
            ) : (
              <div className="mt-5 space-y-6">
                {/* MATCH PERCENT */}
                {typeof percent === "number" && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Загальна відповідність</span>
                      <span className="font-semibold">{percent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${
                          percent >= 75 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {analysis.summary?.profile_summary && (
                      <p className="mt-3 text-sm leading-relaxed">{analysis.summary.profile_summary}</p>
                    )}
                  </div>
                )}

                {/* MATCH GROUPS */}
                <Group
                  icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                  title="Відповідає"
                  items={analysis.matches}
                  empty="Поки що нічого."
                />

                <Group
                  icon={<AlertTriangle className="h-4 w-4 text-warning-foreground" />}
                  title="Частково відповідає / потрібно уточнити"
                  items={analysis.partial_matches}
                  empty="Немає часткових збігів."
                />

                <Group
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                  title="Не відповідає"
                  items={analysis.missing}
                  empty="Прогалин не виявлено."
                />

                {/* SUMMARY */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Профіль кандидата</h3>
                  <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-4 text-sm">
                    <SummaryItem label="Поточна роль" value={analysis.summary?.current_role} />
                    <SummaryItem label="Досвід" value={analysis.summary?.years_of_experience} />
                    <SummaryItem label="Індустрії" value={(analysis.summary?.industries ?? []).join(", ")} />
                    <SummaryItem label="Мови" value={(analysis.summary?.languages ?? []).join(", ")} />
                    <SummaryItem label="Лідерський досвід" value={analysis.summary?.leadership_experience} full />
                  </dl>
                </div>

                {analysis.summary?.strengths?.length > 0 && (
                  <Group
                    icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                    title="Сильні сторони"
                    items={analysis.summary.strengths}
                    empty=""
                  />
                )}

                {analysis.risks?.length > 0 && (
                  <Group
                    icon={<AlertTriangle className="h-4 w-4 text-warning-foreground" />}
                    title="Ризики"
                    items={analysis.risks}
                    empty=""
                  />
                )}

                {/* NEXT STEPS */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Висновок</h3>
                    <RecommendationBadge value={analysis.recommendation} />
                  </div>

                  {analysis.summary?.next_steps && (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Наступні дії</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {analysis.summary.next_steps}
                      </p>
                    </div>
                  )}
                </div>

                {/* QUESTIONS */}
                {analysis.suggested_questions?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Рекомендовані скринінгові питання</h3>
                    <ol className="list-decimal space-y-2 pl-5 text-sm">
                      {analysis.suggested_questions.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN — NOTES + EXTRA ANALYSIS */}
        <aside>
          {/* NOTES */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-medium">Нотатки рекрутера</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (noteBody.trim()) noteMut.mutate();
              }}
              className="mt-3"
            >
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Додати нотатку…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={noteMut.isPending || !noteBody.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Додати нотатку
                </button>
              </div>
            </form>

            <ul className="mt-4 space-y-3">
              {notes.length === 0 && (
                <li className="text-xs text-muted-foreground">Нотаток поки немає.</li>
              )}

              {notes.map((n: any) => (
                <li key={n.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("uk-UA")}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* EXTRA ANALYSIS — NEW BLOCK */}
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-medium">Доповнити аналіз</h2>

            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Додай свої коментарі до аналізу…"
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />

            <div className="mt-2 flex justify-end">
              <button
                onClick={() => extraMut.mutate()}
                disabled={extraMut.isPending || !extra.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Зберегти доповнення
              </button>
            </div>

            {/* SHOW EXTRA NOTES */}
            {analysis?.extra_notes && (
              <div className="mt-4 rounded-md border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">Доповнення рекрутера</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{analysis.extra_notes}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Group({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon} {title}
      </h3>

      {items?.length ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">•</span>
              <span className="flex-1">{it}</span>
            </li>
          ))}
        </ul>
      ) : empty ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">
        {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
