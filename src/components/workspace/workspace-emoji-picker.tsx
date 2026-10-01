"use client";

import { useMemo, useState } from "react";
import { emojisInCategory, WORKSPACE_EMOJI_CATEGORIES } from "@/components/workspace/workspace-emoji-data";

export function WorkspaceEmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [categoryName, setCategoryName] = useState(WORKSPACE_EMOJI_CATEGORIES[0].name);
  const emojis = useMemo(() => {
    const search = query.trim().toLowerCase();
    const topicMatches = search ? WORKSPACE_EMOJI_CATEGORIES.filter((category) => category.name.toLowerCase().includes(search) || category.keywords.includes(search)) : [];
    const categories = search
      ? topicMatches.length ? topicMatches : WORKSPACE_EMOJI_CATEGORIES.filter((category) => emojisInCategory(category).some((emoji) => emoji.includes(query.trim())))
      : WORKSPACE_EMOJI_CATEGORIES.filter((category) => category.name === categoryName);
    return categories.flatMap((category) => emojisInCategory(category).map((emoji) => ({ emoji, category: category.name })))
      .filter((item, index, all) => (!search || topicMatches.length > 0 || item.emoji.includes(query.trim())) && all.findIndex((candidate) => candidate.emoji === item.emoji) === index);
  }, [categoryName, query]);

  return (
    <div role="dialog" aria-label="Choose an emoji" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} className="w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
      <input autoFocus aria-label="Search emoji" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search emoji" className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Emoji categories">
        {WORKSPACE_EMOJI_CATEGORIES.map((category) => <button key={category.name} type="button" aria-pressed={categoryName === category.name && !query} onClick={() => { setCategoryName(category.name); setQuery(""); }} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors ${categoryName === category.name && !query ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}>{category.name}</button>)}
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto" role="group" aria-label="Emoji choices">
        {emojis.map((item, index) => <button key={`${item.emoji}-${index}`} type="button" onClick={() => onSelect(item.emoji)} aria-label={`${item.emoji}, ${item.category.toLowerCase()} emoji`} title={`${item.emoji} · ${item.category}`} className="grid h-8 w-8 place-items-center rounded-md text-xl hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.emoji}</button>)}
        {!emojis.length && <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">No emoji found</p>}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{emojis.length} emoji · Choose a category or search by topic</p>
    </div>
  );
}
