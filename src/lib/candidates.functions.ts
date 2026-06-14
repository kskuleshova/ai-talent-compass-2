export const reanalyzeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Завантажуємо кандидата
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("*, vacancies(*)")
      .eq("id", data.id)
      .single();
    if (error || !candidate) throw new Error("Candidate not found");

    let resumeText = candidate.resume_text ?? "";

    // 2. Якщо тексту немає — витягуємо файл зі storage і парсимо
    if (!resumeText && candidate.resume_path) {
      const { data: file } = await supabase.storage
        .from("resumes")
        .download(candidate.resume_path);

      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        const ext = candidate.resume_filename?.split(".").pop()?.toLowerCase() ?? "pdf";

        resumeText = await extractResumeText(buf, ext as "pdf" | "docx");

        // зберігаємо текст у БД, щоб не парсити кожного разу
        await supabase
          .from("candidates")
          .update({ resume_text: resumeText })
          .eq("id", candidate.id);
      }
    }

    console.log("Reanalyze: resume_text length:", resumeText.length);

    // 3. Оновлюємо статус
    await supabase
      .from("candidates")
      .update({ status: "reanalyzing" })
      .eq("id", candidate.id);

    // 4. Запускаємо AI аналіз
    const result = await analyzeCandidate({
      vacancy: candidate.vacancies,
      resumeText,
    });

    // 5. Записуємо новий аналіз
    await supabase.from("candidate_analyses").insert({
      candidate_id: candidate.id,
      owner_id: userId,
      matches: result.matches,
      partial_matches: result.partial_matches,
      missing: result.missing,
      summary: result.summary,
      risks: result.risks,
      suggested_questions: result.suggested_questions,
      recommendation: result.recommendation,
      model: result.model,
    });

    // 6. Оновлюємо статус
    await supabase
      .from("candidates")
      .update({ status: "analyzed" })
      .eq("id", candidate.id);

    return { ok: true };
  });
