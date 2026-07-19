import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function redirectWithMode(
  targetMode: "duo" | "compose",
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }
  params.set("mode", targetMode);
  redirect(`/character?${params.toString()}`);
}

export default async function ComposePage({ searchParams }: PageProps) {
  redirectWithMode("compose", await searchParams);
}
