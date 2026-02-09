// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Add Provider Dialog
 * For adding new API providers with platform selection
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { IProvider } from "@/lib/api-key-manager";

/**
 * Platform presets - matching OpenCut original exactly (3 providers only)
 * 平台预设配置 - 完全与 OpenCut 原版一致（只有 3 个供应商）
 * 
 * 参考原版配置：
 * - api-settings.tsx: 定义 3 个 provider 及其服务
 * - route.ts: 定义具体的 API 端点和模型
 * 
 * 1. 智谱 GLM-4.7 - 对话/剧本生成 (glm-4.7 无图, glm-4.6v 有图)
 * 2. APIMart - Gemini 图片生成 (gemini-3-pro-image-preview) / 豆包视频生成 (doubao-seedance-1-5-pro)
 * 3. 豆包 ARK - 图片识别/理解
 */
const PLATFORM_PRESETS: Array<{
  platform: string;
  name: string;
  baseUrl: string;
  description: string;
  services: string[];
  models: string[];
  recommended?: boolean;
}> = [
  {
    platform: "memefast",
    name: "魔因API",
    baseUrl: "https://memefast.top",
    description: "543+ 模型中转，支持 GPT/Claude/Gemini/DeepSeek/Veo/Sora 等",
    services: ["对话", "图片生成", "视频生成", "图片理解"],
    models: [
      "deepseek-v3.2",
      "glm-4.7",
      "gemini-3-pro-preview",
      "gemini-3-pro-image-preview",
      "gpt-image-1.5",
      "doubao-seedance-1-5-pro-251215",
      "veo3.1",
      "sora-2-all",
      "wan2.6-i2v",
      "grok-video-3-10s",
      "claude-haiku-4-5-20251001",
    ],
    recommended: true,
  },
  {
    platform: "zhipu",
    name: "智谱 GLM-4.7",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    description: "GLM 对话模型，用于剧本生成",
    services: ["对话"],
    models: ["glm-4.7", "glm-4.6v", "cogview-3-plus", "cogvideox"],
  },
  {
    platform: "apimart",
    name: "APIMart",
    baseUrl: "https://api.apimart.ai",
    description: "Gemini 图片生成 / 豆包视频生成",
    services: ["图片", "视频"],
    models: ["gemini-3-pro-image-preview", "doubao-seedance-1-5-pro", "gemini-2.0-flash"],
  },
  {
    platform: "doubao",
    name: "豆包 ARK",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    description: "图片识别/理解",
    services: ["图片理解"],
    models: ["doubao-vision"],
  },
  {
    platform: "runninghub",
    name: "RunningHub",
    baseUrl: "https://www.runninghub.cn/openapi/v2",
    description: "Qwen 视角切换 / 多角度生成",
    services: ["视角切换", "图生图"],
    models: ["2009613632530812930"],
  },
  {
    platform: "juxinapi",
    name: "聚鑫API",
    baseUrl: "https://api.jxincm.cn",
    description: "Grok 视频生成 / Gemini 图片生成",
    services: ["视频生成", "图片生成"],
    models: ["grok-video-3", "gemini-3-pro-image-preview"],
  },
  {
    platform: "dik3",
    name: "dik3",
    baseUrl: "https://ai.dik3.cn",
    description: "DeepSeek / GLM / Kimi / Qwen 多模型对话",
    services: ["对话", "剧本分析", "推理"],
    models: [
      "deepseek-v3",
      "deepseek-v3.2",
      "deepseek-r1",
      "glm-4.7",
      "kimi-k2",
      "MiniMax-M2.1",
      "qwen3-max",
      "qwen3-max-preview",
    ],
  },
  {
    platform: "nanohajimi",
    name: "纳米哈基米",
    baseUrl: "https://free.nanohajimi.mom",
    description: "Gemini 对话 / 图片生成 / 视频生成",
    services: ["对话", "图片生成", "视频生成"],
    models: [
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-imagen",
      "gemini-veo",
    ],
  },
  {
    platform: "custom",
    name: "自定义",
    baseUrl: "",
    description: "自定义 OpenAI 兼容 API 供应商",
    services: [],
    models: [],
  },
];

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (provider: Omit<IProvider, "id">) => void;
  existingPlatforms?: string[];
}

export function AddProviderDialog({
  open,
  onOpenChange,
  onSubmit,
  existingPlatforms = [],
}: AddProviderDialogProps) {
  const [platform, setPlatform] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  // Get selected preset
  const selectedPreset = PLATFORM_PRESETS.find((p) => p.platform === platform);
  const isCustom = platform === "custom";

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPlatform("");
      setName("");
      setBaseUrl("");
      setApiKey("");
      setModel("");
    }
  }, [open]);

  // Auto-fill when platform changes
  useEffect(() => {
    if (selectedPreset && !isCustom) {
      setName(selectedPreset.name);
      setBaseUrl(selectedPreset.baseUrl);
      // 自动填充默认模型
      if (selectedPreset.models && selectedPreset.models.length > 0) {
        setModel(selectedPreset.models[0]);
      }
    }
  }, [platform, selectedPreset, isCustom]);

  const handleSubmit = () => {
    if (!platform) {
      toast.error("请选择平台");
      return;
    }
    if (!name.trim()) {
      toast.error("请输入名称");
      return;
    }
    if (isCustom && !baseUrl.trim()) {
      toast.error("自定义平台需要输入 Base URL");
      return;
    }
    if (!apiKey.trim()) {
      toast.error("请输入 API Key");
      return;
    }

    // 保存该平台的所有预设模型，确保 provider.model 不为空
    const presetModels = selectedPreset?.models || [];
    const modelArray = presetModels.length > 0 
      ? presetModels 
      : (model ? [model] : []);
    
    onSubmit({
      platform,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: modelArray,
    });

    onOpenChange(false);
    toast.success(`已添加 ${name}`);
  };

  // Filter out already existing platforms (except custom which can have multiple)
  const availablePlatforms = PLATFORM_PRESETS.filter(
    (p) => p.platform === "custom" || !existingPlatforms.includes(p.platform)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加 API 供应商</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>平台</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="选择平台" />
              </SelectTrigger>
              <SelectContent>
              {availablePlatforms.map((preset) => (
                  <SelectItem key={preset.platform} value={preset.platform}>
                    <span className="flex items-center gap-2">
                      {preset.name}
                      {preset.recommended && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded font-medium">
                          推荐
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="供应商名称"
            />
          </div>

          {/* Base URL (only for custom or editable) */}
          {(isCustom || platform) && (
            <div className="space-y-2">
              <Label>Base URL {!isCustom && "(可选修改)"}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={isCustom ? "https://api.example.com/v1" : ""}
              />
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              支持多个 Key，用逗号分隔
            </p>
          </div>

          {/* Model - optional input */}
          <div className="space-y-2">
            <Label>模型 (可选)</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="输入模型名称，如 gpt-4o"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
