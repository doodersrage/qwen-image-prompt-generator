"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Generate", description: "Keywords → prompt" },
  { href: "/format", label: "Format", description: "Draft → model-ready" },
  { href: "/topics", label: "Topics", description: "Idea list" },
  { href: "/random-scene", label: "Random", description: "Surprise me" },
  { href: "/character", label: "Character", description: "Single person" },
  { href: "/background", label: "Background", description: "No people" },
  { href: "/image-prompt", label: "Image → Prompt", description: "Vision upload" },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6">
        {links.map((link) => {
          const active = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group shrink-0 rounded-lg px-3 py-2 transition ${
                active ? "bg-zinc-900" : "hover:bg-zinc-900/60"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  active ? "text-white" : "text-zinc-200 group-hover:text-white"
                }`}
              >
                {link.label}
              </span>
              <span className="block text-[11px] text-zinc-500 group-hover:text-zinc-400">
                {link.description}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
