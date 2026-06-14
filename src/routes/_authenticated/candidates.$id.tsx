import { useServerFn } from "@tanstack/react-start";
import { getCandidate, updateAnalysis, reanalyzeCandidate, addNote } from "@/lib/candidates.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export default function CandidatePage({ params }: { params: { id: string } }) {
  const id = params.id;
  const qc = useQueryClient();

  // --- SERVER FUNCTIONS ---
  const getFn = useServerFn(getCandidate);
  const updateFn = useServerFn(updateAnalysis);
  const reFn = useServerFn(reanalyzeCandidate);
  const noteFn = useServerFn(addNote);

  // --- LOAD CANDIDATE ---
  const { data, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const candidate = data?.candidate;
  const analysis = data?.analysis;
  const notes = data?.notes ?? [];

  // --- EXTRA NOTES ---
  const [extra, setExtra] = useState("");

  const extraMut = useMutation({
    mutationFn: () => updateFn({ data: { candidate_id: id, extra: extra.trim() } }),
    onSuccess: async () => {
      setExtra("");
      await qc.invalidateQueries({ queryKey: ["candidate", id] });
      await qc.refetchQueries({ queryKey: ["candidate", id] });
      toast.success("Доповнення збережено");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  // --- REANALYZE ---
  const reanalyzeMut = useMutation({
    mutationFn: () => reFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["candidate", id] });
      await qc.refetchQueries({ queryKey: ["candidate", id] });
      toast.success("Переаналізовано");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  const handleReanalyze = async () => {
    await qc.invalidateQueries({ queryKey: ["candidate", id] });
    await qc.refetchQueries({ queryKey: ["candidate", id] });
    reanalyzeMut.mutate();
  };

  // --- ADD NOTE ---
  const [note, setNote] = useState("");

  const noteMut = useMutation({
    mutationFn: () => noteFn({ data: { candidate_id: id, body: note.trim() } }),
    onSuccess: async () => {
      setNote("");
      await qc.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Нотатку додано");
    },
    onError: (e: any) => toast.error(e.message ?? "Помилка"),
  });

  if (isLoading) return <div>Завантаження...</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          onClick={handleReanalyze}
          disabled={reanalyzeMut.isPending || !candidate.resume_text}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          🔄 Переаналізувати
        </button>
      </div>

      {/* ANALYSIS */}
      <div className="p-4 border rounded-lg bg-card">
        <h2 className="font-semibold text-lg mb-2">AI Аналіз</h2>
        {analysis ? (
          <pre className="text-sm whitespace-pre-wrap">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        ) : (
          <p>Аналіз відсутній</p>
        )}
      </div>

      {/* EXTRA NOTES */}
      <div className="p-4 border rounded-lg bg-card">
        <h2 className="font-semibold text-lg mb-2">Доповнення рекрутера</h2>
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          className="w-full border rounded p-2"
          rows={4}
          placeholder="Додайте уточнення..."
        />
        <button
          onClick={() => extraMut.mutate()}
          disabled={extraMut.isPending || !extra.trim()}
          className="mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Зберегти доповнення
        </button>
      </div>

      {/* RECRUITER NOTES */}
      <div className="p-4 border rounded-lg bg-card">
        <h2 className="font-semibold text-lg mb-2">Нотатки рекрутера</h2>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Нотатка..."
        />
        <button
          onClick={() => noteMut.mutate()}
          disabled={noteMut.isPending || !note.trim()}
          className="mt-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Додати нотатку
        </button>

        <div className="mt-4 space-y-2">
          {notes.map((n: any) => (
            <div key={n.id} className="p-2 border rounded bg-muted">
              {n.body}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
