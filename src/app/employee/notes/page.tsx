"use client";

import { useEffect, useState, useCallback } from "react";
import { RichTextEditor } from "@/components/employee/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Tag, Loader2, Save, Clock, Bookmark, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Note = {
  id: string;
  title: string;
  content_json: unknown;
  content_html: string;
  tags: string[];
  updated_at: string;
};

type BookmarkItem = {
  id: string;
  timestamp_seconds: number | null;
  highlight_text: string | null;
  note_text: string | null;
  created_at: string;
  content_item_id: string;
  content_items: { title: string; source_url: string | null } | null;
};

export default function NotesDashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "bookmarks">("notes");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [notesRes, bookmarksRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/bookmarks"),
      ]);
      const notesData = await notesRes.json();
      const bookmarksData = await bookmarksRes.json();

      if (notesData.notes) {
        const list = notesData.notes as Note[];
        setNotes(list);
        setActiveNote((prev) => {
          if (list.length === 0) return null;
          if (!prev) return list[0];
          return list.find((n) => n.id === prev.id) ?? list[0];
        });
      }
      if (bookmarksData.bookmarks) {
        setBookmarks(bookmarksData.bookmarks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createNewNote = async () => {
    const newNote = {
      title: "Untitled Note",
      content_json: null,
      content_html: "",
      tags: [],
    };
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote),
      });
      const data = await res.json();
      if (data.note) {
        setNotes([data.note, ...notes]);
        setActiveNote(data.note);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveNote = useCallback(async (noteToSave: Note) => {
    if (!noteToSave.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: noteToSave.id,
          title: noteToSave.title,
          content_json: noteToSave.content_json,
          content_html: noteToSave.content_html,
          tags: noteToSave.tags,
        }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) => prev.map((n) => (n.id === data.note.id ? data.note : n)));
      }
      setLastSaved(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!activeNote) return;

    const timeoutId = setTimeout(() => {
      // Find the corresponding original note
      const originalNote = notes.find((n) => n.id === activeNote.id);
      if (originalNote) {
        const hasChanged = 
          originalNote.title !== activeNote.title || 
          originalNote.content_html !== activeNote.content_html;
        
        if (hasChanged) {
          saveNote(activeNote);
        }
      }
    }, 2000); // 2 seconds auto-save debounce

    return () => clearTimeout(timeoutId);
  }, [activeNote, notes, saveNote]);

  // Global hotkey save (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeNote) {
          saveNote(activeNote);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNote, saveNote]);

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      (b.note_text && b.note_text.toLowerCase().includes(search.toLowerCase())) ||
      (b.content_items?.title && b.content_items.title.toLowerCase().includes(search.toLowerCase()))
  );

  const formatVideoLink = (url: string, seconds: number) => {
    if (!url) return "#";
    if (url.includes("youtube") || url.includes("youtu.be")) {
       const sep = url.includes("?") ? "&" : "?";
       return `${url}${sep}t=${seconds}`;
    }
    return url;
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-border/60 bg-background/50 shadow-sm custom-scrollbar backdrop-blur-xl">
      {/* Sidebar ListView */}
      <div className="w-1/3 min-w-[280px] max-w-[360px] border-r border-border/60 bg-muted/10 flex flex-col">
        <div className="p-5 border-b border-border/60 space-y-5">
          <div className="flex bg-muted/40 p-1 rounded-lg">
            <button 
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'notes' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab("notes")}
            >
              <FileText className="w-3.5 h-3.5" /> Notes
            </button>
            <button 
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'bookmarks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab("bookmarks")}
            >
              <Bookmark className="w-3.5 h-3.5" /> Bookmarks
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">{activeTab === "notes" ? "My Notes" : "Saved Bookmarks"}</h2>
            {activeTab === "notes" && (
              <Button variant="secondary" size="icon" onClick={createNewNote} title="New Note" className="rounded-full shadow-sm">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="pl-9 h-9 bg-background/50 focus-visible:ring-1 border-border/60 placeholder:text-muted-foreground/70"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : activeTab === "notes" ? (
             filteredNotes.length === 0 ? (
                <div className="text-center p-8 text-sm text-muted-foreground">
                  {search ? "No notes found matching search." : "No notes yet. Create one above."}
                </div>
             ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setActiveNote(note)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      activeNote?.id === note.id
                        ? "bg-primary/5 border-primary/20 text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                        : "bg-transparent border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-semibold text-sm truncate text-foreground">{note.title || "Untitled Document"}</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 tracking-tight flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                      </span>
                      {note.tags && note.tags.length > 0 && <Tag className="h-3 w-3 inline-block opacity-70" />}
                    </div>
                  </button>
                ))
             )
          ) : (
             filteredBookmarks.length === 0 ? (
                <div className="text-center p-8 text-sm text-muted-foreground">
                  {search ? "No bookmarks found." : "When you bookmark training material, it will appear here."}
                </div>
             ) : (
                filteredBookmarks.map((bm) => {
 const tsSec = bm.timestamp_seconds ?? 0;
                   const timeFormat = new Date(tsSec * 1000).toISOString().substring(11, 19).replace(/^00:/, "");
                   const sourceUrl = bm.content_items?.source_url ?? "";
                   return (
                     <a
                        key={bm.id}
                        href={formatVideoLink(sourceUrl, tsSec)}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full text-left p-3 rounded-xl transition-all border border-border/50 bg-card hover:bg-muted/50 shadow-sm mb-2 group"
                     >
                        <div className="font-semibold text-[13px] text-primary truncate flex items-center justify-between mb-1">
                          <span>{bm.content_items?.title || "Unknown Content"}</span>
                          <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-mono group-hover:bg-primary/20 transition-colors">[{timeFormat}]</span>
                        </div>
                        <div className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                          {bm.note_text ? `"${bm.note_text}"` : <span className="italic opacity-50">No note attached</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-2">
                           {formatDistanceToNow(new Date(bm.created_at), { addSuffix: true })}
                        </div>
                     </a>
                   );
                })
             )
          )}
        </div>
      </div>

      {/* Editor Main Content */}
      <div className="flex-1 flex flex-col bg-background relative shadow-[inset_1px_0_0_0_rgba(0,0,0,0.05)]">
        {activeTab === "notes" && activeNote ? (
          <>
            <div className="border-b border-border/50 p-6 flex items-start sm:items-center justify-between bg-card/40 backdrop-blur-md z-10 shrink-0">
               <div className="flex-1">
                 <Input
                    value={activeNote.title}
                    onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                    className="border-none bg-transparent hover:bg-muted/40 focus-visible:ring-0 focus-visible:bg-muted/40 text-2xl font-bold px-2 rounded-lg h-auto w-full transition-colors"
                    placeholder="Note title"
                 />
                 <div className="flex items-center gap-3 mt-3 px-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded-md text-[11px] tracking-wide font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {saving ? (
                           <span className="animate-pulse text-amber-500">Saving...</span>
                        ) : lastSaved ? (
                           `Last edited: ${format(lastSaved, "h:mm a")}`
                        ) : (
                           `Last edited: ${format(new Date(activeNote.updated_at), "MMM d, h:mm a")}`
                        )}
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <Input
                         value={activeNote.tags ? activeNote.tags.join(", ") : ""}
                         onChange={(e) => {
                            const tg = e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
                            setActiveNote({ ...activeNote, tags: tg });
                         }}
                         placeholder="Add tags..."
                         className="border-none bg-transparent h-6 text-xs text-muted-foreground focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50 w-full"
                      />
                    </div>
                 </div>
               </div>
               <div className="hidden sm:flex items-center pl-6 shrink-0 flex-col sm:flex-row gap-3">
                   <Button variant="outline" size="sm" onClick={() => saveNote(activeNote)} disabled={saving} className="h-9 rounded-lg shadow-sm border-border/80">
                     <Save className="h-4 w-4 mr-2" />
                     Save
                   </Button>
               </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-background custom-scrollbar">
                <div className="max-w-4xl mx-auto h-full px-8 py-10 sm:px-12">
                   <div className="bg-card shadow-sm border border-border/40 rounded-xl overflow-hidden min-h-full">
                     <RichTextEditor
                        initialContent={activeNote.content_html}
                        onUpdate={(json, html) => {
                           setActiveNote((prev) => prev ? { ...prev, content_json: json, content_html: html } : prev);
                        }}
                     />
                   </div>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground h-full space-y-6 bg-muted/5">
             <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-muted to-muted/20 flex items-center justify-center shadow-inner border border-border/50">
                 {activeTab === "bookmarks" ? (
                   <Bookmark className="h-10 w-10 text-muted-foreground/40" />
                 ) : (
                   <FileText className="h-10 w-10 text-muted-foreground/40" />
                 )}
             </div>
             <div className="text-center space-y-2 max-w-sm px-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {activeTab === "bookmarks" ? "Browse your saved moments" : "Select a note"}
                </h3>
                <p className="text-sm leading-relaxed">
                  {activeTab === "bookmarks" 
                    ? "Click on any bookmark from the sidebar to immediately jump back to that exact timestamp in the video." 
                    : "Choose a note from the sidebar or explicitly create a new one to start writing."}
                </p>
                {activeTab === "notes" && (
                   <Button variant="default" className="mt-4 shadow-md rounded-xl" onClick={createNewNote}>
                     <Plus className="w-4 h-4 mr-2" /> Create Custom Note
                   </Button>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
