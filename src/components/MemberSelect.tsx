"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "./CurrentUser";

/** Past this many names the list scrolls and gets a search field. */
const SEARCH_FROM = 7;

const collator = new Intl.Collator("ar");

/**
 * "Who is sending this", as one field-wide button that opens a list. It reads
 * and writes the same CurrentUser value as the header's "من أنت؟", so a name
 * picked in either place shows in both, and a saved name is there on load.
 *
 * `open` is controlled so the composer can open it when a submit is missing
 * a name, as the old chip row did.
 */
export default function MemberSelect({
  open,
  onOpenChange,
  onPick,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick?: () => void;
  disabled?: boolean;
}) {
  const { members, member, setMemberId, ready } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const sorted = useMemo(
    () => [...members].sort((a, b) => collator.compare(a.name, b.name)),
    [members],
  );
  const searchable = sorted.length >= SEARCH_FROM;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((m) => m.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);

  // Opening starts on the current name, and puts focus where typing goes.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const at = sorted.findIndex((m) => m.id === member?.id);
    setActive(at < 0 ? 0 : at);
    (searchable ? searchRef.current : listRef.current)?.focus();
    // Only on the transition to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function close() {
    onOpenChange(false);
    buttonRef.current?.focus();
  }

  function pick(id: string) {
    setMemberId(id);
    onPick?.();
    close();
  }

  function onListKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = shown[active];
      if (m) pick(m.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      onOpenChange(false);
    }
  }

  if (!ready) {
    return <span className="block h-11 w-full rounded-md bg-muted" />;
  }

  const activeId = shown[active] ? `${listId}-${shown[active].id}` : undefined;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            onOpenChange(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={member ? `تُرسَل باسم ${member.name}، غيّر الاسم` : "اختر اسمك"}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-md border bg-card px-3 text-start text-sm transition-colors duration-200 disabled:opacity-50",
          open ? "border-ring" : "border-border hover:border-border-strong",
        )}
      >
        {member ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">تُرسَل باسم </span>
            <span className="text-foreground">{member.name}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">اختر اسمك</span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="fade-in absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-md border border-border bg-card">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label="ابحث عن اسمك"
                placeholder="ابحث عن اسمك"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="الأعضاء"
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={searchable ? undefined : activeId}
            onKeyDown={onListKey}
            className="max-h-60 overflow-y-auto p-1 focus-visible:outline-none"
          >
            {shown.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${m.id}`}
                data-index={i}
                role="option"
                aria-selected={m.id === member?.id}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm transition-colors duration-150",
                  i === active ? "bg-muted" : "",
                  m.id === member?.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {m.name}
                {m.id === member?.id && (
                  <Check className="ms-auto size-3.5 text-primary" aria-hidden />
                )}
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                {members.length === 0
                  ? "لا يوجد أعضاء بعد، أضفهم من الإدارة."
                  : "لا يوجد اسم مطابق."}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
