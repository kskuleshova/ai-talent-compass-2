import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createVacancy } from "@/lib/vacancies.functions";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/vacancies/new")({
  head: () => ({ meta: [{ title: "Нова вакансія — Hirelens" }] }),
  component: NewVacancy,
});

const fields: { key: string; label: string; hint?: string; rows: number }[] = [
  { key: "job_description", label: "Опис вакансії", rows: 6 },
  { key: "hiring_manager_brief", label: "Бриф від наймаючого менеджера", hint: "Контекст, команда, як виглядає успіх.", rows: 5 },
  { key: "must_have", label: "Обов'язкові вимоги", hint: "По одній у рядку.", rows: 5 },
  { key: "nice_to_have", label: "Бажані вимоги", hint: "По одній у рядку.", rows: 4 },
  { key: "screening_questions", label: "Скринінгові питання", rows: 4 },
];

function NewVacancy() {
  const navigate = useNavigate();
  const create = useServerFn(createVacancy);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ title: "" });
  const [hasTestTask, setHasTestTask] = useState(false);
  const [hasHistoricalFeedback, setHasHistoricalFeedback] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) { toast.error("Введіть назву вакансії"); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        test_task: hasTestTask ? (form.test_task ?? "") : "",
        historical_feedback: hasHistoricalFeedback ? (form.historical_feedback ?? "") : "",
      };
      const v = await create({ data: payload as any });
      toast.success("Вакансію створено");
      navigate({ to: "/vacancies/$id", params: { id: v.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Не вдалося створити");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> До вакансій
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Створити вакансію</h1>
      <p className="mt-1 text-sm text-muted-foreground">Чим більше контексту — тим точніший AI-скринінг.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <Field label="Назва вакансії" required>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={200}
            placeholder="напр. Senior Backend Engineer"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </Field>

        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <textarea
              rows={f.rows}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </Field>
        ))}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Checkbox id="has-test-task" checked={hasTestTask} onCheckedChange={(v) => setHasTestTask(!!v)} />
            <label htmlFor="has-test-task" className="text-sm font-medium cursor-pointer">Є тестове завдання</label>
          </div>
          {hasTestTask && (
            <textarea
              rows={4}
              placeholder="Опишіть тестове завдання..."
              value={form.test_task ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, test_task: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Checkbox id="has-hist" checked={hasHistoricalFeedback} onCheckedChange={(v) => setHasHistoricalFeedback(!!v)} />
            <label htmlFor="has-hist" className="text-sm font-medium cursor-pointer">Є історичний фідбек по минулих кандидатах</label>
          </div>
          {hasHistoricalFeedback && (
            <textarea
              rows={4}
              placeholder="Що працювало або ні з минулими кандидатами..."
              value={form.historical_feedback ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, historical_feedback: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/dashboard" className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent">Скасувати</Link>
          <button
            type="submit" disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Створити вакансію
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
