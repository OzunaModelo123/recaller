"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyCheck, CheckCircle2, AlertCircle, Bookmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  assignmentId: string;
  sourceUrl: string | null;
  sourceType: string | null;
  transcript: string | null;
  onComplete: () => void;
};

type YoutubePlayerLite = {
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
};

type YoutubeIframeConstructor = new (
  elementId: string,
  config: {
    height?: string;
    width?: string;
    videoId?: string;
    playerVars?: Record<string, number>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
    };
  },
) => YoutubePlayerLite;

type YoutubeGlobal = {
  Player: YoutubeIframeConstructor;
  PlayerState: { PLAYING: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YoutubeGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

export function ContentConsumptionView({ assignmentId, sourceUrl, sourceType, transcript, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Document strict requirements
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [timeReqMet, setTimeReqMet] = useState(false);

  const [showBookmark, setShowBookmark] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [bookmarkTime, setBookmarkTime] = useState(0);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);

  const watchTimeRef = useRef(0);
  const lastHeartbeat = useRef(0);
  const playerRef = useRef<YoutubePlayerLite | null>(null);

  // Periodic heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchTimeRef.current > lastHeartbeat.current + 5) {
        lastHeartbeat.current = Math.floor(watchTimeRef.current);
        fetch("/api/consumptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            action: "heartbeat",
            watchTimeSeconds: lastHeartbeat.current,
          }),
        }).catch(console.error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [assignmentId]);

  // YouTube Script injection
  useEffect(() => {
    if (["youtube", "vimeo", "loom", "web_article", "url"].includes(sourceType || "") && sourceUrl && extractYouTubeId(sourceUrl)) {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            document.head.appendChild(tag);
        }
      }

      const initPlayer = () => {
        const ytId = extractYouTubeId(sourceUrl);
        if (!ytId) return;

        const ytApi = window.YT;
        if (!ytApi?.Player) return;

        playerRef.current = new ytApi.Player("yt-player", {
          height: "100%",
          width: "100%",
          videoId: ytId,
          playerVars: { playsinline: 1 },
          events: {
            onReady: () => {
              const timer = setInterval(() => {
                if (
                  playerRef.current &&
                  typeof playerRef.current.getCurrentTime === "function" &&
                  typeof playerRef.current.getPlayerState === "function" &&
                  playerRef.current.getPlayerState() === ytApi.PlayerState.PLAYING
                ) {
                  const t = playerRef.current.getCurrentTime();
                  if (t !== undefined && t > watchTimeRef.current) {
                    watchTimeRef.current = t;
                  }
                }
              }, 1000);
              // Clean up polling if player unmounts
              return () => clearInterval(timer);
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === ytApi.PlayerState.ENDED) {
                setCanProceed(true);
              }
            },
          },
        });
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }
  }, [sourceUrl, sourceType]);

  const handleMediaTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    if (e.currentTarget.currentTime > watchTimeRef.current) {
        watchTimeRef.current = e.currentTarget.currentTime;
    }
  };

  const handleMediaEnded = () => {
    setCanProceed(true);
  };

  const handleComplete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/consumptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          action: "complete",
          watchTimeSeconds: watchTimeRef.current,
        }),
      });
      if (!res.ok) {
         setError("Failed to mark content as completely consumed.");
         return;
      }
      onComplete();
    } catch {
       setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleBookmarkClick = () => {
    setBookmarkTime(Math.floor(watchTimeRef.current));
    setBookmarkNote("");
    setShowBookmark(true);
  };

  const saveBookmark = async () => {
    setBookmarkSaving(true);
    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          timestampSeconds: bookmarkTime,
          noteText: bookmarkNote,
        }),
      });
      setShowBookmark(false);
    } catch (e) {
      console.error(e);
    } finally {
      setBookmarkSaving(false);
    }
  };

  // If it's a PDF or DOCX, they must read transcript
  useEffect(() => {
    if (sourceType === "pdf" || sourceType === "docx") {
       // Estimate time based on reading speed 250 WPM
       const words = (transcript || "").split(/\s+/).length;
       const estSeconds = Math.max(5, Math.min(Math.round((words / 250) * 60) / 4, 30)); // 25% of reading time or max 30s for demo
       
       // Automatically pass scroll requirement if text is extremely short
       if (words < 100) setHasScrolledToBottom(true);
       
       const start = Date.now();
       const interval = setInterval(() => {
         const elapsed = Math.round((Date.now() - start) / 1000);
         watchTimeRef.current = elapsed;
         if (elapsed >= estSeconds) {
           setTimeReqMet(true);
           clearInterval(interval);
         }
       }, 1000);
       return () => clearInterval(interval);
    }
  }, [sourceType, transcript]);

  // Unlock when both time and scroll requirements are met
  useEffect(() => {
    if ((sourceType === "pdf" || sourceType === "docx") && timeReqMet && hasScrolledToBottom) {
      setCanProceed(true);
    }
  }, [sourceType, timeReqMet, hasScrolledToBottom]);

  const handleDocumentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setHasScrolledToBottom(true);
    }
  };

  const renderPlayer = () => {
    if (sourceType === "pdf" || sourceType === "docx") {
      return (
          <div className="rounded-xl border border-border bg-muted/30 h-[500px] overflow-hidden flex flex-col relative w-full shadow-inner">
            {/* Header (Non-overlapping) */}
            <div className="bg-card w-full py-3 px-5 border-b border-border shadow-sm flex items-center justify-between z-10 shrink-0">
              <h3 className="text-sm font-bold text-foreground tracking-tight">Document Viewer</h3>
              {!canProceed && (
                <div className="text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-600 dark:text-amber-500 py-1.5 px-3 rounded-full flex items-center shrink-0 shadow-sm border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> 
                  {!timeReqMet ? "Reading required..." : "Scroll to end to proceed"}
                </div>
              )}
            </div>
            
            {/* Scrollable Document Area */}
            <div 
              className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar"
              onScroll={handleDocumentScroll}
            >
              <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 max-w-3xl mx-auto rounded-sm shadow-md border border-neutral-200 dark:border-zinc-800 p-8 sm:p-14 min-h-full transition-colors">
                <div className="whitespace-pre-wrap text-[15px] sm:text-base leading-relaxed sm:leading-loose font-serif selection:bg-primary/20">
                  {transcript || "No text available for this document."}
                </div>
              </div>
            </div>
          </div>
      );
    }

    if (sourceType === "mp4") {
      return (
        <video 
           src={sourceUrl!} 
           controls 
           className="w-full aspect-video rounded-xl bg-black" 
           onTimeUpdate={handleMediaTimeUpdate}
           onEnded={handleMediaEnded}
           controlsList="nodownload"
        />
      );
    }

    if (sourceType === "mp3") {
      return (
        <div className="w-full bg-sidebar/50 rounded-xl p-8 flex flex-col items-center justify-center border border-border">
          <audio 
             src={sourceUrl!} 
             controls 
             className="w-full max-w-md"
             onTimeUpdate={handleMediaTimeUpdate}
             onEnded={handleMediaEnded}
          />
        </div>
      );
    }

    if (["youtube", "vimeo", "loom", "web_article", "url"].includes(sourceType || "") && sourceUrl) {
      if (extractYouTubeId(sourceUrl)) {
         return (
           <div className="w-full aspect-video rounded-xl bg-black overflow-hidden relative">
             <div id="yt-player" className="absolute inset-0"></div>
           </div>
         );
      }
      
      // Other generic URL
      return (
         <div className="w-full rounded-xl p-8 border border-border bg-sidebar/50 text-center">
             <p className="text-sm text-foreground font-medium mb-4">External Content Requires Review</p>
             <a href={sourceUrl} target="_blank" rel="noreferrer" onClick={() => { setTimeout(() => setCanProceed(true), 5000); }} className="inline-flex items-center text-primary hover:underline font-semibold bg-primary/10 px-4 py-2 rounded-lg">
                Click here to view content
             </a>
             <p className="text-xs text-muted-foreground mt-3">Return after viewing to proceed.</p>
         </div>
      );
    }

    return null;
  };

  return (
     <div className="mx-auto w-full max-w-2xl px-4 sm:px-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
        <div className="space-y-4 border-b border-border pb-5">
           <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Phase 0: Training Content
           </h1>
           <p className="mt-1 text-sm text-muted-foreground">
             Please thoroughly consume the material below to unlock your assignment steps.
           </p>
        </div>

        {renderPlayer()}

        <div className="flex justify-start pt-2">
            <Button variant="outline" size="sm" onClick={handleBookmarkClick} className="rounded-full shadow-sm">
                <Bookmark className="w-4 h-4 mr-2" />
                Bookmark Current {sourceType === "pdf" || sourceType === "docx" ? "Location" : "Time"}
            </Button>
        </div>

        <Dialog open={showBookmark} onOpenChange={setShowBookmark}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Bookmark</DialogTitle>
              <DialogDescription>
                Add a quick note or highlight for this section.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea 
                placeholder="This part is interesting because..." 
                value={bookmarkNote} 
                onChange={e => setBookmarkNote(e.target.value)} 
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBookmark(false)} disabled={bookmarkSaving}>Cancel</Button>
              <Button onClick={saveBookmark} disabled={bookmarkSaving}>
                {bookmarkSaving ? "Saving..." : "Save Bookmark"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-none border-primary/20 bg-primary/5 transition-all">
            <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                   {canProceed ? (
                       <CheckCircle2 className="text-green-500 w-8 h-8" />
                   ) : (
                       <CopyCheck className="text-muted-foreground/60 w-8 h-8" />
                   )}
                   <div>
                       <p className="font-semibold text-foreground text-sm uppercase tracking-wide">Ready to begin?</p>
                       <p className="text-xs text-muted-foreground mt-0.5">
                          {canProceed ? "Great job. You may now start your assignment." : "Watch or read the content fully to unlock."}
                       </p>
                   </div>
                </div>
                
                <div className="flex flex-col items-end">
                    <Button 
                       type="button" 
                       size="lg" 
                       disabled={!canProceed || busy}
                       onClick={handleComplete}
                       className="rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
                    >
                       {busy ? "Saving..." : "I've Consumed This Content"}
                    </Button>
                    {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
            </CardContent>
        </Card>
     </div>
  );
}

