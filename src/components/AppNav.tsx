"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
  description: string;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

const navGroups: NavGroup[] = [
  {
    label: "Prompt",
    links: [
      { href: "/", label: "Generate", description: "Keywords → prompt" },
      { href: "/format", label: "Format", description: "Draft → model-ready" },
      { href: "/lint", label: "Lint", description: "Diagnostics & fix" },
      { href: "/topics", label: "Topics", description: "Idea list" },
    ],
  },
  {
    label: "Scene",
    links: [
      { href: "/character", label: "Character", description: "Single person" },
      { href: "/duo", label: "Duo", description: "Sport & pairs" },
      { href: "/compose", label: "Compose", description: "Scene merge" },
      { href: "/background", label: "Background", description: "No people" },
      { href: "/random-scene", label: "Random", description: "Surprise me" },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/image-prompt", label: "Image → Prompt", description: "Vision upload" },
      { href: "/refine", label: "Refine", description: "Image + intent fix" },
      { href: "/negative", label: "Negative", description: "SD negatives" },
      { href: "/studio", label: "Studio", description: "History & tools" },
      { href: "/gallery", label: "Gallery", description: "ComfyUI outputs" },
      { href: "/variations", label: "Variations", description: "Grid queue" },
    ],
  },
];

const settingsLink: NavLink = {
  href: "/settings",
  label: "Settings",
  description: "Health & ComfyUI",
};

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      title={link.description}
      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-300 hover:bg-zinc-900/70 hover:text-white"
      }`}
    >
      {link.label}
    </Link>
  );
}

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-hidden border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <Link
            href="/"
            className="mr-1 shrink-0 rounded-md px-2 py-1.5 text-sm font-semibold text-zinc-100 hover:text-white"
          >
            Prompt Tools
          </Link>

          {navGroups.map((group, index) => (
            <div
              key={group.label}
              className="flex min-w-0 flex-wrap items-center gap-1"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className="mx-0.5 hidden h-4 w-px shrink-0 bg-zinc-800 sm:block"
                />
              )}
              <span className="hidden shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 lg:inline">
                {group.label}
              </span>
              {group.links.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  active={pathname === link.href}
                />
              ))}
            </div>
          ))}

          <div className="ml-auto flex shrink-0 items-center">
            <NavItem
              link={settingsLink}
              active={pathname === settingsLink.href}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
