// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Export View - Timeline visualization and export
 * Based on CineGen-AI StageExport.tsx
 */

import { useScriptStore, useActiveScriptProject } from "@/stores/script-store";
import { useActiveDirectorProject } from "@/stores/director-store";
import { useProjectStore } from "@/stores/project-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Film,
  Download,
  Share2,
  FileVideo,
  Layers,
  Clock,
  CheckCircle,
  BarChart3,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ExportView() {
  const { activeProject } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  const directorProject = useActiveDirectorProject();

  const shots = scriptProject?.shots || [];
  const splitScenes = directorProject?.splitScenes || [];
  const scriptData = scriptProject?.scriptData;
  const targetDuration = scriptProject?.targetDuration || "60s";

  // === 进度计算：合并 Script shots 和 Director splitScenes 的状态 ===
  // Director 的 splitScenes 是实际生成作业的主数据源
  const directorCompleted = splitScenes.filter(
    (s) => s.videoStatus === 'completed' || (s.imageStatus === 'completed' && s.videoUrl)
  ).length;
  const directorWithImage = splitScenes.filter((s) => s.imageStatus === 'completed').length;
  // Script 侧的独立生成（通过 shot-list 生成的）
  const scriptCompleted = shots.filter((s) => s.imageUrl || s.videoUrl).length;

  // 优先使用 Director 的进度，因为这是实际工作流
  const hasSplitScenes = splitScenes.length > 0;
  const totalItems = hasSplitScenes ? splitScenes.length : shots.length;
  const completedItems = hasSplitScenes ? directorCompleted : scriptCompleted;
  const imageReadyItems = hasSplitScenes ? directorWithImage : scriptCompleted;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const imageProgress = totalItems > 0 ? Math.round((imageReadyItems / totalItems) * 100) : 0;

  // 估算时长：使用实际时长数据
  const estimatedDuration = hasSplitScenes
    ? splitScenes.reduce((acc, s) => acc + (s.duration || 5), 0)
    : shots.reduce((acc, s) => acc + (s.duration || 3), 0);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
            <Film className="w-5 h-5 text-primary" />
            成片与导出
            <span className="text-xs text-muted-foreground font-mono font-normal uppercase tracking-wider bg-muted px-2 py-1 rounded">
              Rendering & Export
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono uppercase bg-muted border border-border px-2 py-1 rounded">
            Status: {progress === 100 ? "READY" : "IN PROGRESS"}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 md:p-12">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Main Status Panel */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-2xl relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 p-48 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 p-32 bg-green-500/5 blur-[100px] rounded-full pointer-events-none" />

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                      {scriptData?.title || activeProject?.name || "未命名项目"}
                    </h3>
                    <span className="px-2 py-0.5 bg-muted border border-border text-muted-foreground text-[10px] rounded uppercase font-mono tracking-wider">
                      Master Sequence
                    </span>
                  </div>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        {hasSplitScenes ? 'Split Scenes' : 'Shots'}
                      </span>
                      <span className="text-sm font-mono text-foreground/80">{totalItems}</span>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        Est. Duration
                      </span>
                      <span className="text-sm font-mono text-foreground/80">~{estimatedDuration}s</span>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        Target
                      </span>
                      <span className="text-sm font-mono text-foreground/80">{targetDuration}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right bg-muted/50 p-4 rounded-lg border border-border backdrop-blur-sm min-w-[160px]">
                  <div className="flex items-baseline justify-end gap-1 mb-1">
                    <span className="text-3xl font-mono font-bold text-primary">{progress}</span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-end gap-2">
                    {progress === 100 ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <BarChart3 className="w-3 h-3" />
                    )}
                    Render Status
                  </div>
                </div>
              </div>

              {/* Timeline Visualizer Strip */}
              <div className="mb-10">
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-2 px-1">
                  <span>Sequence Map{hasSplitScenes ? ' (Director)' : ''}</span>
                  <span>TC 00:00:00:00</span>
                </div>
                <div className="h-20 bg-muted/30 rounded-lg border border-border flex items-center px-2 gap-1 overflow-x-auto relative shadow-inner">
                  {totalItems === 0 ? (
                    <div className="w-full flex items-center justify-center text-muted-foreground/50 text-xs font-mono uppercase tracking-widest">
                      <Film className="w-4 h-4 mr-2" />
                      No Shots Available
                    </div>
                  ) : hasSplitScenes ? (
                    splitScenes.map((scene, idx) => {
                      const hasImage = scene.imageStatus === 'completed' && !!scene.imageDataUrl;
                      const hasVideo = scene.videoStatus === 'completed' && !!scene.videoUrl;
                      return (
                        <div
                          key={scene.id}
                          className={cn(
                            "h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden",
                            hasVideo
                              ? "bg-green-500/40 border border-green-500/30 hover:bg-green-500/50"
                              : hasImage
                              ? "bg-primary/40 border border-primary/30 hover:bg-primary/50"
                              : "bg-muted border border-border hover:bg-muted/80"
                          )}
                          title={`Scene ${idx + 1}: ${scene.actionSummary || scene.sceneName || ''}`}
                        >
                          {hasVideo && <div className="h-full w-full bg-green-500/20" />}
                          {hasImage && !hasVideo && <div className="h-full w-full bg-primary/20" />}
                          
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                            <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-xl">
                              Scene {idx + 1}{hasVideo ? ' ✓视频' : hasImage ? ' ✓图片' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    shots.map((shot, idx) => {
                      const isDone = !!shot.imageUrl || !!shot.videoUrl;
                      return (
                        <div
                          key={shot.id}
                          className={cn(
                            "h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden",
                            isDone
                              ? "bg-primary/40 border border-primary/30 hover:bg-primary/50"
                              : "bg-muted border border-border hover:bg-muted/80"
                          )}
                          title={`Shot ${idx + 1}: ${shot.actionSummary}`}
                        >
                          {isDone && <div className="h-full w-full bg-primary/20" />}
                          
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                            <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-xl">
                              Shot {idx + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* 图片/视频状态摘要 */}
                {hasSplitScenes && (
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                    <span>图片: {imageReadyItems}/{totalItems}</span>
                    <span>视频: {completedItems}/{totalItems}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  disabled={progress < 100}
                  className={cn(
                    "h-12 font-bold text-xs uppercase tracking-widest transition-all",
                    progress === 100
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Master (.mp4)
                </Button>

                <Button
                  variant="outline"
                  className="h-12 font-bold text-xs uppercase tracking-widest"
                >
                  <FileVideo className="w-4 h-4 mr-2" />
                  Export EDL / XML
                </Button>
              </div>
            </div>

            {/* Secondary Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                <Layers className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">Source Assets</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Download all generated images and raw video clips.
                  </p>
                </div>
              </div>
              <div className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                <Share2 className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">Share Project</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Create a view-only link for client review.
                  </p>
                </div>
              </div>
              <div className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                <Clock className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">Render Logs</h4>
                  <p className="text-[10px] text-muted-foreground">
                    View generation history and token usage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
