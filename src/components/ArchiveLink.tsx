import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The way back to every published issue. The archive is its own site, so this
 * opens in a new tab, and it is the one loud thing above the quiet nav: filled
 * with the identity's interactive teal so it reads apart from the four links
 * and from the brand-green "new contribution" button.
 *
 * The address comes from the server (NEWSLETTER.archiveUrl) as a prop, so the
 * environment override in rules.ts is the only place it is set.
 */
export default function ArchiveLink({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-interactive px-6 text-sm font-semibold text-primary-foreground",
        "transition-[background-color,translate] duration-200 hover:bg-[color-mix(in_srgb,var(--interactive)_82%,var(--neutral-100))] motion-safe:hover:-translate-y-px",
        className,
      )}
    >
      <BookOpen className="size-4" aria-hidden />
      الأعداد السابقة
      <span className="sr-only">(يفتح في تبويب جديد)</span>
    </a>
  );
}
