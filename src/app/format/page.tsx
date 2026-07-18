import PromptFormatter from "@/components/PromptFormatter";

export default function FormatPage() {
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-zinc-950 to-zinc-950">
      <main className="mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <PromptFormatter />
      </main>
    </div>
  );
}
