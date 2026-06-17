import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVacancy } from "@/lib/vacancies.functions";
import { uploadCandidate, deleteCandidate } from "@/lib/candidates.functions";
import { ArrowLeft, Upload, FileText, Loader2, ChevronRight, Trash2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/vacancies/$id")({
  head: () => ({ meta: [{ title: "Vacancy — Hirelens" }] }),
  component: VacancyDetail,
});

function VacancyDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getVacancy);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["vacancy", id], queryFn: () => fn({ data: { id } }) });

  const upload = useServerFn(uploadCandidate);
  const deleteFn = useServerFn(deleteCandidate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [candName, setCandName] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext ?? "")) {
      toast.error("Підтримуються лише PDF або DOCX файли");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileRef.current) fileRef.current.files = dt.files;
    setFileName(file.name);
  };


  // — Single delete (inline confirm) —
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // — Bulk select —
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const mutation = useMutation({
    mutationFn: async (vars: { name: string; file: File }) => {
      const buf = await vars.file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      return upload({ data: {
        vacancy_id: id, name: vars.name, filename: vars.file.name,
        mime: vars.file.type || "application/octet-stream", base64,
      } });
    },
    onSuccess: () => {
      toast.success("Candidate uploaded and analyzed");
      setShowUpload(false); setCandName("");
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      qc.invalidateQueries({ queryKey: ["vacancy", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Upload failed"),
    onSettled: () => setBusy(false),
  });

  const deleteMut = useMutation({
    mutationFn: (candidateId: string) => deleteFn({ data: { id: candidateId } }),
    onSuccess: () => {
      toast.success("Кандидата видалено");
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["vacancy", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка видалення"),
  });

  if (!data) {
    return <div className="mx-auto max-w-6xl px-6 py-10"><div className="h-8 w-64 animate-pulse rounded bg-muted" /></div>;
  }
  const { vacancy, candidates } = data;

  const allIds = candidates.map((c: any) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((cid: string) => selected.has(cid));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (cid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    let failed = 0;
    for (const cid of ids) {
      try {
        await deleteFn({ data: { id: cid } });
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setSelected(new Set());
    setShowBulkConfirm(false);
    await qc.invalidateQueries({ queryKey: ["vacancy", id] });
    if (failed === 0) toast.success(`Видалено ${ids.length} кандидат${ids.length === 1 ? "а" : "ів"}`);
    else toast.error(`Видалено ${ids.length - failed} з ${ids.length}. Помилок: ${failed}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Choose a PDF or DOCX file"); return; }
    if (!candName.trim()) { toast.error("Enter the candidate's name"); return; }
    setBusy(true);
    mutation.mutate({ name: candName.trim(), file });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Vacancies
      </Link>

      <header className="mt-4 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{vacancy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {new Date(vacancy.created_at).toLocaleDateString()} · {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/vacancies/$id/edit"
            params={{ id }}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Редагувати
          </Link>
          <button
            onClick={() => setShowUpload((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" /> Upload candidate
          </button>
        </div>
      </header>

      {showUpload && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Candidate name</label>
              <input
                value={candName} onChange={(e) => setCandName(e.target.value)} maxLength={200}
                placeholder="e.g. Jane Doe"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Resume (PDF or DOCX)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-5 text-center transition-colors
                  ${dragging
                    ? "border-primary bg-primary/5"
                    : fileName
                      ? "border-primary/40 bg-primary/5"
                      : "border-input bg-background hover:border-ring hover:bg-accent/40"
                  }`}
              >
                <Upload className={`h-6 w-6 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
                {fileName ? (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="max-w-[220px] truncate">{fileName}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {dragging ? "Відпустіть файл" : "Перетягніть файл сюди"}
                    </p>
                    <p className="text-xs text-muted-foreground">або <span className="text-primary underline underline-offset-2">оберіть через провідник</span></p>
                    <p className="text-xs text-muted-foreground">PDF або DOCX, до 10 MB</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowUpload(false); setFileName(null); }} className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Upload & analyze
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section>
          {/* Candidates header with select-all + bulk toolbar */}
          <div className="mb-3 flex min-h-[28px] items-center gap-3">
            {candidates.length > 0 && (
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                title="Виділити всіх"
              />
            )}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Candidates
            </h2>

            {someSelected && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Обрано: {selected.size}</span>
                {showBulkConfirm ? (
                  <>
                    <span className="text-xs font-medium text-destructive">
                      Видалити {selected.size}?
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="inline-flex items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Так, видалити"}
                    </button>
                    <button
                      onClick={() => setShowBulkConfirm(false)}
                      disabled={bulkDeleting}
                      className="rounded bg-muted px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      Скасувати
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowBulkConfirm(true)}
                      className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" /> Видалити
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="rounded bg-muted px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Скасувати
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
              <p className="text-sm text-muted-foreground">No candidates yet. Upload a resume to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {candidates.map((c: any) => {
                const isSelected = selected.has(c.id);
                return (
                  <li
                    key={c.id}
                    className={`flex items-center gap-2 px-5 py-4 transition-colors hover:bg-accent/40 ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
                    />

                    <Link to="/candidates/$id" params={{ id: c.id }} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                        {c.name.split(" ").map((p: string) => p[0]).slice(0,2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <FileText className="mr-1 inline h-3 w-3" />
                          {c.resume_filename ?? "—"} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      <RecommendationBadge value={c.latest_analysis?.recommendation} status={c.status} />
                      <Link to="/candidates/$id" params={{ id: c.id }}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      {confirmDeleteId === c.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMut.mutate(c.id)}
                            disabled={deleteMut.isPending}
                            className="rounded bg-destructive px-2 py-1 text-xs font-medium text-white hover:bg-destructive/90"
                          >
                            {deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Так"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded bg-muted px-2 py-1 text-xs font-medium hover:bg-accent"
                          >
                            Ні
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Видалити кандидата"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Brief</h2>
          <DetailBlock title="Job description" body={vacancy.job_description} />
          <DetailBlock title="Hiring manager brief" body={vacancy.hiring_manager_brief} />
          <DetailBlock title="Must-have" body={vacancy.must_have} />
          <DetailBlock title="Nice-to-have" body={vacancy.nice_to_have} />
          <DetailBlock title="Screening questions" body={vacancy.screening_questions} />
          <DetailBlock title="Test task" body={vacancy.test_task} />
          <DetailBlock title="Historical feedback" body={vacancy.historical_feedback} />
        </aside>
      </div>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!body?.trim()) return null;

  // Estimate if text is longer than ~5 lines (approx 400 chars or contains many newlines)
  const trimmed = body.trim();
  const lineCount = trimmed.split("\n").length;
  const isLong = trimmed.length > 400 || lineCount > 5;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {isLong && (
          <button
            onClick={() => setExpanded((s) => !s)}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Згорнути</> : <><ChevronDown className="h-3.5 w-3.5" /> Розгорнути</>}
          </button>
        )}
      </div>
      <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${!expanded && isLong ? "line-clamp-5" : ""}`}>
        {trimmed}
      </p>
    </div>
  );
}

export function RecommendationBadge({ value, status }: { value?: string | null; status?: string }) {
  if (status === "analyzing") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Аналізуємо</span>;
  }
  if (status === "analysis_failed") {
    return <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Помилка аналізу</span>;
  }
  if (!value) return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Очікує</span>;
  const map: Record<string, string> = {
    "Strong yes": "bg-success/15 text-success border border-success/30",
    "Yes": "bg-success/10 text-success border border-success/20",
    "Maybe Yes": "bg-warning/15 text-warning-foreground border border-warning/40",
    "No": "bg-destructive/10 text-destructive border border-destructive/30",
    "Strong No": "bg-destructive/20 text-destructive border border-destructive/40",
    "Strong Match": "bg-success/15 text-success border border-success/30",
    "Moderate Match": "bg-warning/15 text-warning-foreground border border-warning/40",
    "Weak Match": "bg-destructive/10 text-destructive border border-destructive/30",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[value] ?? "bg-muted"}`}>{value}</span>;
}
