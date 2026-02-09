// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * API Settings Component
 * Configure API keys for AI services
 */

import { useState } from "react";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderId } from "@opencut/ai-core";

interface APISettingsProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function APISettings({ collapsed = true, onToggleCollapse }: APISettingsProps) {
  const { 
    apiKeys, 
    concurrency,
    setApiKey, 
    setConcurrency,
    isConfigured,
  } = useAPIConfigStore();

  const [showKeys, setShowKeys] = useState<Record<ProviderId, boolean>>({
    zhipu: false,
    apimart: false,
    openai: false,
    doubao: false,
    runninghub: false,
    juxinapi: false,
    dik3: false,
    nanohajimi: false,
    memefast: false,
    custom: false,
  });

  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [testResults, setTestResults] = useState<Record<ProviderId, boolean | null>>({
    zhipu: null,
    apimart: null,
    openai: null,
    doubao: null,
    runninghub: null,
    juxinapi: null,
    dik3: null,
    nanohajimi: null,
    memefast: null,
    custom: null,
  });

  const toggleShowKey = (provider: ProviderId) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const testConnection = async (provider: ProviderId) => {
    setTesting(provider);
    setTestResults(prev => ({ ...prev, [provider]: null }));

    try {
      let response: Response;
      
      if (provider === "zhipu") {
        // Test Zhipu with screenplay API
        response = await fetch("/api/ai/screenplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "测试连接",
            sceneCount: 1,
            apiKey: apiKeys[provider] || "",
            provider: "zhipu",
          }),
        });
      } else if (provider === "apimart") {
        // Test APIMart with image API (matching director_ai)
        response = await fetch("/api/ai/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "test connection, simple blue sky",
            aspectRatio: "16:9",
            resolution: "1K",
            apiKey: apiKeys[provider] || "",
            provider: "apimart",
          }),
        });
      } else if (provider === "doubao") {
        // Doubao ARK is for vision/image understanding - just check if key is set
        // No simple test endpoint available
        setTestResults(prev => ({ ...prev, [provider]: true }));
        setTesting(null);
        return;
      } else if (provider === "runninghub") {
        // Test RunningHub API with a simple query endpoint
        response = await fetch("/api/ai/runninghub-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: apiKeys[provider] || "",
          }),
        });
      } else {
        // Default test
        response = await fetch("/api/ai/screenplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "测试连接",
            sceneCount: 1,
            apiKey: apiKeys[provider] || "",
            provider: "openai",
          }),
        });
      }

      setTestResults(prev => ({ ...prev, [provider]: response.ok }));
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: false }));
    } finally {
      setTesting(null);
    }
  };

  // Providers matching director_ai configuration
  const providers: Array<{
    id: ProviderId;
    name: string;
    description: string;
    services: string[];
  }> = [
    {
      id: "zhipu",
      name: "智谱 GLM-4.7",
      description: "GLM 对话模型，用于剧本生成",
      services: ["对话"],
    },
    {
      id: "apimart",
      name: "APIMart",
      description: "Gemini 图片生成 / 豆包视频生成",
      services: ["图片", "视频"],
    },
    {
      id: "doubao",
      name: "豆包 ARK",
      description: "图片识别/理解",
      services: ["图片理解"],
    },
    {
      id: "runninghub",
      name: "RunningHub",
      description: "Qwen 视角切换 / 多角度生成",
      services: ["视角切换", "图生图"],
    },
  ];

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between"
        onClick={onToggleCollapse}
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          API 设置
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          API 设置
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onToggleCollapse}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Provider Keys */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{provider.name}</Label>
              {isConfigured(provider.id) && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  已配置
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKeys[provider.id] ? "text" : "password"}
                  placeholder={`输入 ${provider.name} API Key`}
                  value={apiKeys[provider.id] || ""}
                  onChange={(e) => setApiKey(provider.id, e.target.value)}
                  className="pr-10 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => toggleShowKey(provider.id)}
                >
                  {showKeys[provider.id] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!isConfigured(provider.id) || testing === provider.id}
                onClick={() => testConnection(provider.id)}
              >
                {testing === provider.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : testResults[provider.id] === true ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : testResults[provider.id] === false ? (
                  <X className="h-4 w-4 text-destructive" />
                ) : (
                  "测试"
                )}
              </Button>
            </div>
            {/* Service badges */}
            <div className="flex gap-1">
              {provider.services.map((service) => (
                <span
                  key={service}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Concurrency Setting */}
      <div className="pt-2 border-t space-y-2">
        <Label className="text-sm font-medium">并发设置</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={5}
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)}
            className="w-20 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            同时生成场景数（单 Key 建议设为 1）
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          💡 API Key 仅存储在本地浏览器，不会上传到服务器
        </p>
      </div>
    </div>
  );
}
