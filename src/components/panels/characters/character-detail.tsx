// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Character Detail Panel - Right column
 * Shows selected character's preview images, info, and actions
 */

import { useState } from "react";
import { useCharacterLibraryStore, type Character } from "@/stores/character-library-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  User,
  Image as ImageIcon,
  Edit3,
  Check,
  X,
  Shirt,
  Trash2,
  Download,
  GripVertical,
  Tag,
  StickyNote,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WardrobeModal } from "./wardrobe-modal";
import { LocalImage } from "@/components/ui/local-image";

// View type labels
const VIEW_LABELS: Record<string, string> = {
  front: "正面",
  side: "侧面",
  back: "背面",
  "three-quarter": "四分之三",
};

// Gender labels
const GENDER_LABELS: Record<string, string> = {
  male: "男",
  female: "女",
  other: "其他",
};

// Age labels
const AGE_LABELS: Record<string, string> = {
  child: "儿童",
  teen: "青少年",
  "young-adult": "青年",
  adult: "中年",
  senior: "老年",
};

interface CharacterDetailProps {
  character: Character | null;
}

export function CharacterDetail({ character }: CharacterDetailProps) {
  const { updateCharacter, deleteCharacter, selectCharacter } = useCharacterLibraryStore();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [newTag, setNewTag] = useState("");

  if (!character) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          选择一个角色查看详情
        </p>
      </div>
    );
  }

  const handleSaveName = () => {
    if (editName.trim() && editName.trim() !== character.name) {
      updateCharacter(character.id, { name: editName.trim() });
      toast.success("名称已更新");
    }
    setIsEditingName(false);
  };

  const handleDelete = () => {
    if (confirm(`确定要删除角色 "${character.name}" 吗？`)) {
      deleteCharacter(character.id);
      selectCharacter(null);
      toast.success("角色已删除");
    }
  };

  const handleSaveNotes = () => {
    updateCharacter(character.id, { notes: editNotes.trim() || undefined });
    setIsEditingNotes(false);
    toast.success("备注已更新");
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim().replace(/^#/, '');
    const currentTags = character.tags || [];
    if (!currentTags.includes(tag)) {
      updateCharacter(character.id, { tags: [...currentTags, tag] });
      toast.success("标签已添加");
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = character.tags || [];
    updateCharacter(character.id, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  const handleExportImage = async (imageUrl: string, name: string) => {
    try {
      let blob: Blob;
      
      // Handle different URL formats
      if (imageUrl.startsWith('data:')) {
        // Base64 data URL
        const res = await fetch(imageUrl);
        blob = await res.blob();
      } else if (imageUrl.startsWith('local-image://')) {
        // Local image protocol - fetch through Electron's custom protocol
        const res = await fetch(imageUrl);
        blob = await res.blob();
      } else if (imageUrl.startsWith('http')) {
        // Remote URL
        const res = await fetch(imageUrl);
        blob = await res.blob();
      } else {
        // Fallback
        const res = await fetch(imageUrl);
        blob = await res.blob();
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${name}.png 导出成功`);
    } catch (err) {
      console.error('Export image failed:', err);
      toast.error('导出失败');
    }
  };

  const currentView = character.views[selectedViewIndex];
  const variationCount = character.variations?.length || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 pb-2 border-b">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm truncate">{character.name}</h3>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setEditName(character.name);
                setIsEditingName(true);
              }}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Main preview */}
          <div className="space-y-2">
            <div 
              className="aspect-square rounded-lg bg-muted overflow-hidden border relative"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({
                  type: "character",
                  characterId: character.id,
                  characterName: character.name,
                  visualTraits: character.visualTraits,
                  thumbnailUrl: character.thumbnailUrl,
                }));
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
            {currentView ? (
                <LocalImage 
                  src={currentView.imageUrl} 
                  alt={`${character.name} - ${VIEW_LABELS[currentView.viewType] || currentView.viewType}`}
                  className="w-full h-full object-cover"
                />
              ) : character.thumbnailUrl ? (
                <LocalImage 
                  src={character.thumbnailUrl} 
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              
              {/* Drag hint */}
              <div className="absolute top-2 right-2 bg-black/50 text-white rounded p-1">
                <GripVertical className="h-4 w-4" />
              </div>
            </div>

            {/* View thumbnails */}
            {character.views.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {character.views.map((view, index) => (
                  <button
                    key={view.viewType}
                    className={cn(
                      "w-12 h-12 rounded border overflow-hidden transition-all",
                      "hover:ring-1 hover:ring-foreground/30",
                      selectedViewIndex === index && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedViewIndex(index)}
                  >
                    <LocalImage 
                      src={view.imageUrl} 
                      alt={VIEW_LABELS[view.viewType] || view.viewType}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Character info */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">角色信息</div>
            
            {/* Basic info badges */}
            <div className="flex flex-wrap gap-1.5">
              {character.gender && (
                <Badge variant="secondary" className="text-xs">
                  {GENDER_LABELS[character.gender] || character.gender}
                </Badge>
              )}
              {character.age && (
                <Badge variant="secondary" className="text-xs">
                  {AGE_LABELS[character.age] || character.age}
                </Badge>
              )}
              {character.personality && (
                <Badge variant="outline" className="text-xs">
                  {character.personality}
                </Badge>
              )}
            </div>

            {/* Description */}
            {character.description && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">描述</Label>
                <p className="text-xs whitespace-pre-wrap bg-muted rounded p-2 max-h-[120px] overflow-y-auto">
                  {character.description}
                </p>
              </div>
            )}

            {/* Visual traits */}
            {character.visualTraits && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">视觉特征</Label>
                <p className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {character.visualTraits}
                </p>
              </div>
            )}

            {/* Notes / 角色备注 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  角色备注
                </Label>
                {!isEditingNotes && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => {
                      setEditNotes(character.notes || '');
                      setIsEditingNotes(true);
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="添加剧情相关的备注..."
                    className="text-xs min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={handleSaveNotes}>
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setIsEditingNotes(false)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded p-2 text-indigo-800 dark:text-indigo-200">
                  {character.notes || '点击编辑添加备注...'}
                </p>
              )}
            </div>

            <Separator />

            {/* Tags / 标签 */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                角色标签
              </Label>
              <div className="flex flex-wrap gap-1">
                {(character.tags || []).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs gap-1 group">
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="添加标签..."
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleAddTag}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Reference images */}
            {character.referenceImages && character.referenceImages.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">参考图片</Label>
                <div className="flex gap-1.5">
                  {character.referenceImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`参考图 ${i + 1}`}
                      className="w-10 h-10 object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              size="sm"
              onClick={() => setShowWardrobe(true)}
            >
              <Shirt className="h-4 w-4 mr-2" />
              衣橱 ({variationCount})
            </Button>

            {currentView && (
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => handleExportImage(currentView.imageUrl, `${character.name}-${currentView.viewType}`)}
              >
                <Download className="h-4 w-4 mr-2" />
                导出当前视图
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除角色
            </Button>
          </div>

          {/* Tips */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 拖拽角色图片到 AI 导演面板使用</p>
          </div>
        </div>
      </ScrollArea>

      {/* Wardrobe Modal */}
      <WardrobeModal
        character={character}
        open={showWardrobe}
        onOpenChange={setShowWardrobe}
      />
    </div>
  );
}
