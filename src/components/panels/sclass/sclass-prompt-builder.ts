// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * sclass-prompt-builder.ts — S级组级提示词构建
 *
 * 核心功能：
 * 1. 自动从 character-library-store 提取角色参考图 → @Image
 * 2. 自动从 scene-store 提取场景参考图 → @Image
 * 3. 自动从 splitScene.dialogue 提取对白 → 唇形同步指令
 * 4. 合并组内各镜头的三层提示词为「镜头1→镜头2→镜头3」结构
 * 5. 收集用户上传的 @Video / @Audio 引用
 * 6. 检查 Seedance 2.0 限制（≤9图 + ≤3视频 + ≤3音频，总≤12，prompt≤5000字符）
 */

import type { SplitScene } from '@/stores/director-store';
import type { Character } from '@/stores/character-library-store';
import type { Scene } from '@/stores/scene-store';
import type { ShotGroup, AssetRef, SClassAspectRatio, SClassResolution, SClassDuration } from '@/stores/sclass-store';

// ==================== Types ====================

/** @引用收集结果 */
export interface CollectedRefs {
  /** 图片引用（角色图 + 场景图 + 首帧图），最多 9 张 */
  images: AssetRef[];
  /** 视频引用（用户上传），最多 3 个 */
  videos: AssetRef[];
  /** 音频引用（用户上传），最多 3 个 */
  audios: AssetRef[];
  /** 总文件数 */
  totalFiles: number;
  /** 是否超出限制 */
  overLimit: boolean;
  /** 超限详情 */
  limitWarnings: string[];
}

/** 组级 prompt 构建结果 */
export interface GroupPromptResult {
  /** 最终组装的 prompt（发送给 API） */
  prompt: string;
  /** prompt 字符数 */
  charCount: number;
  /** 是否超出 5000 字符限制 */
  overCharLimit: boolean;
  /** 收集到的 @引用 */
  refs: CollectedRefs;
  /** 各镜头的 prompt 片段（用于 UI 预览） */
  shotSegments: ShotSegment[];
  /** 对白唇形同步片段 */
  dialogueSegments: DialogueSegment[];
}

/** 单个镜头的 prompt 片段 */
export interface ShotSegment {
  sceneId: number;
  sceneName: string;
  /** 该镜头在组内的索引（1-based） */
  shotIndex: number;
  /** 镜头描述（动作 + 镜头语言） */
  description: string;
  /** 对白文本 */
  dialogue: string;
  /** 时长（秒） */
  duration: number;
}

/** 对白唇形同步片段 */
export interface DialogueSegment {
  sceneId: number;
  characterName: string;
  text: string;
  /** 在视频中的大致时间位置（秒） */
  timeOffset: number;
}

// ==================== Seedance 2.0 Limits ====================

export const SEEDANCE_LIMITS = {
  maxImages: 9,
  maxVideos: 3,
  maxAudios: 3,
  maxTotalFiles: 12,
  maxPromptChars: 5000,
  maxDuration: 15,
  minDuration: 4,
} as const;

// ==================== Grid Image Merge ====================

/**
 * 计算网格布局（N×N 策略）
 */
function calculateGridLayout(count: number): { cols: number; rows: number; paddedCount: number } {
  if (count <= 4) return { cols: 2, rows: 2, paddedCount: 4 };
  return { cols: 3, rows: 3, paddedCount: 9 };
}

/**
 * 将多张首帧图片合并为一张格子图（Canvas 拼接）
 *
 * 布局规则（N×N 策略，与 handleMergedGenerate 一致）：
 * - 1-4 张 → 2×2，不足的格子留空
 * - 5-9 张 → 3×3，不足的格子留空
 * 宽高比：N×N 网格下，整图宽高比 = 单格宽高比 = 目标画幅比
 *
 * @param imageUrls 图片 URL 列表（base64 / http / local-image://）
 * @param aspectRatio 目标宽高比，如 '16:9' 或 '9:16'
 * @returns 合并后的 dataUrl (image/png)
 */
export async function mergeToGridImage(
  imageUrls: string[],
  aspectRatio: string = '16:9',
): Promise<string> {
  if (imageUrls.length === 0) throw new Error('mergeToGridImage: 无图片可合并');
  if (imageUrls.length === 1) {
    // 单张直接返回，无需合并
    return imageUrls[0];
  }

  const { cols, rows } = calculateGridLayout(imageUrls.length);

  // 解析宽高比
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const cellAspect = (aw || 16) / (ah || 9);

  // 每个格子的像素尺寸（基于合理分辨率）
  const cellWidth = cellAspect >= 1 ? 512 : Math.round(512 * cellAspect);
  const cellHeight = cellAspect >= 1 ? Math.round(512 / cellAspect) : 512;

  const totalWidth = cellWidth * cols;
  const totalHeight = cellHeight * rows;

  // 加载所有图片
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`加载图片失败: ${src.substring(0, 60)}...`));
      img.src = src;
    });

  const images = await Promise.all(imageUrls.map(loadImage));

  // Canvas 拼接
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // 填充灰色背景（空格子）
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // 绘制每张图片到对应格子，居中裁剪保持宽高比
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dx = col * cellWidth;
    const dy = row * cellHeight;

    // 计算 cover 裁剪区域
    const imgAspect = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > cellAspect) {
      // 图片太宽，裁宽度
      sw = Math.round(img.height * cellAspect);
      sx = Math.round((img.width - sw) / 2);
    } else {
      // 图片太高，裁高度
      sh = Math.round(img.width / cellAspect);
      sy = Math.round((img.height - sh) / 2);
    }

    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cellWidth, cellHeight);
  }

  return canvas.toDataURL('image/png');
}

// ==================== Reference Collection ====================

/**
 * 从 character-library-store 提取角色参考图
 * 每个角色取第一张 view 图片
 */
export function collectCharacterRefs(
  characterIds: string[],
  characters: Character[],
): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  for (const charId of characterIds) {
    if (seen.has(charId)) continue;
    seen.add(charId);

    const char = characters.find(c => c.id === charId);
    if (!char) continue;

    // 优先使用 base64（持久化），其次使用 URL
    const view = char.views[0];
    const imageUrl = view?.imageBase64 || view?.imageUrl || char.thumbnailUrl;
    if (!imageUrl) continue;

    refs.push({
      id: `char_${charId}`,
      type: 'image',
      tag: `@Image`,  // tag 会在最终组装时重新编号
      localUrl: imageUrl,
      httpUrl: null,
      fileName: `${char.name}_ref.png`,
      fileSize: 0,
      duration: null,
    });
  }

  return refs;
}

/**
 * 从 scene-store 提取场景参考图
 * 通过 SplitScene.sceneLibraryId 关联
 */
export function collectSceneRefs(
  scenes: SplitScene[],
  sceneLibrary: Scene[],
): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  for (const splitScene of scenes) {
    // 方式1: 直接使用分镜上已关联的场景参考图
    if (splitScene.sceneReferenceImage && !seen.has(splitScene.sceneReferenceImage)) {
      seen.add(splitScene.sceneReferenceImage);
      refs.push({
        id: `scene_ref_${splitScene.id}`,
        type: 'image',
        tag: '@Image',
        localUrl: splitScene.sceneReferenceImage,
        httpUrl: null,
        fileName: `scene_${splitScene.sceneName || splitScene.id}.png`,
        fileSize: 0,
        duration: null,
      });
      continue;
    }

    // 方式2: 通过 sceneLibraryId 从场景库查找
    if (splitScene.sceneLibraryId && !seen.has(splitScene.sceneLibraryId)) {
      seen.add(splitScene.sceneLibraryId);
      const sceneObj = sceneLibrary.find(s => s.id === splitScene.sceneLibraryId);
      const sceneImg = sceneObj?.referenceImageBase64 || sceneObj?.referenceImage;
      if (sceneImg) {
        refs.push({
          id: `scene_lib_${splitScene.sceneLibraryId}`,
          type: 'image',
          tag: '@Image',
          localUrl: sceneImg,
          httpUrl: null,
          fileName: `${sceneObj?.name || 'scene'}_ref.png`,
          fileSize: 0,
          duration: null,
        });
      }
    }
  }

  return refs;
}

/**
 * 收集组内各镜头的首帧图片作为 @Image
 */
export function collectFirstFrameRefs(scenes: SplitScene[]): AssetRef[] {
  const refs: AssetRef[] = [];
  for (const scene of scenes) {
    const imageUrl = scene.imageDataUrl || scene.imageHttpUrl;
    if (!imageUrl) continue;
    refs.push({
      id: `firstframe_${scene.id}`,
      type: 'image',
      tag: '@Image',
      localUrl: imageUrl,
      httpUrl: scene.imageHttpUrl || null,
      fileName: `shot_${scene.id + 1}_frame.png`,
      fileSize: 0,
      duration: null,
    });
  }
  return refs;
}

/**
 * 汇总所有 @引用并执行配额校验
 *
 * 新版优先级（格子图模式）：
 *   @Image1 = 格子图（1张） > @Image2~9 = 角色参考图（≤8张）
 * 旧版优先级（兼容）：
 *   首帧图 > 角色图 > 场景图，合计≤9张
 *
 * @param gridImageRef 如果提供，则使用格子图模式（不再逐张添加首帧）
 */
export function collectAllRefs(
  group: ShotGroup,
  scenes: SplitScene[],
  characters: Character[],
  sceneLibrary: Scene[],
  gridImageRef?: AssetRef | null,
): CollectedRefs {
  // 1. 收集角色参考图（去重：组内所有镜头的 characterIds 合并）
  const allCharIds = Array.from(
    new Set(scenes.flatMap(s => s.characterIds || []))
  );
  const charRefs = collectCharacterRefs(allCharIds, characters);

  // 2. 收集场景参考图
  const sceneRefs = collectSceneRefs(scenes, sceneLibrary);

  let images: AssetRef[];

  if (gridImageRef) {
    // ========== 格子图模式 ==========
    // 格子图占 1 槽，剩余 8 槽给角色引用
    const remainingSlots = SEEDANCE_LIMITS.maxImages - 1;
    images = [gridImageRef, ...charRefs.slice(0, remainingSlots)];
  } else {
    // ========== 旧版兼容模式：逐张首帧 > 角色 > 场景 ==========
    const frameRefs = collectFirstFrameRefs(scenes);
    const allImageRefs = [...frameRefs, ...charRefs, ...sceneRefs];
    images = allImageRefs.slice(0, SEEDANCE_LIMITS.maxImages);
  }

  // 5. 用户上传的视频/音频引用（已在 group 中）
  const videos = (group.videoRefs || []).slice(0, SEEDANCE_LIMITS.maxVideos);
  const audios = (group.audioRefs || []).slice(0, SEEDANCE_LIMITS.maxAudios);

  // 6. 重新编号 tag
  images.forEach((ref, i) => { ref.tag = `@Image${i + 1}`; });
  videos.forEach((ref, i) => { ref.tag = `@Video${i + 1}`; });
  audios.forEach((ref, i) => { ref.tag = `@Audio${i + 1}`; });

  // 7. 配额校验
  const totalFiles = images.length + videos.length + audios.length;
  const warnings: string[] = [];
  if (images.length >= SEEDANCE_LIMITS.maxImages) {
    warnings.push(`图片引用已达上限 ${SEEDANCE_LIMITS.maxImages}`);
  }
  if (totalFiles > SEEDANCE_LIMITS.maxTotalFiles) {
    warnings.push(`总文件数 ${totalFiles} 超出限制 ${SEEDANCE_LIMITS.maxTotalFiles}`);
  }

  return {
    images,
    videos,
    audios,
    totalFiles,
    overLimit: totalFiles > SEEDANCE_LIMITS.maxTotalFiles,
    limitWarnings: warnings,
  };
}

// ==================== Dialogue / Lip-Sync ====================

/**
 * 从组内镜头提取对白，生成唇形同步片段
 */
export function extractDialogueSegments(
  scenes: SplitScene[],
  characters: Character[],
): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  let timeOffset = 0;

  for (const scene of scenes) {
    const dur = scene.duration > 0 ? scene.duration : 5;

    if (scene.dialogue && scene.dialogue.trim()) {
      const dialogueText = scene.dialogue.trim();

      // 检测对白文本是否已包含说话人格式（如 "村民：妹子" 或 "村民（操着方言）：妹子"）
      const speakerMatch = dialogueText.match(/^([^\uff1a:]{1,20})[\uff1a:](.+)$/s);

      let characterName: string;
      let text: string;

      if (speakerMatch) {
        // 对白自带说话人，直接使用
        characterName = speakerMatch[1].trim();
        text = speakerMatch[2].trim();
      } else {
        // 回退到 characterIds 查找角色名
        characterName = scene.characterIds?.[0]
          ? characters.find(c => c.id === scene.characterIds[0])?.name || '角色'
          : '角色';
        text = dialogueText;
      }

      segments.push({
        sceneId: scene.id,
        characterName,
        text,
        timeOffset,
      });
    }

    timeOffset += dur;
  }

  return segments;
}

/**
 * 将对白片段转为唇形同步指令文本
 */
function buildDialoguePromptPart(segments: DialogueSegment[]): string {
  if (segments.length === 0) return '';

  const lines = segments.map(s =>
    `[Dialogue at ~${s.timeOffset}s] ${s.characterName}: "${s.text}" — lip-sync required, natural mouth movement`
  );

  return `\n\nDialogue & Lip-Sync:\n${lines.join('\n')}`;
}

// ==================== Shot Segment Building ====================

/**
 * 为单个镜头构建描述片段（完整版 — 涵盖分镜卡片上所有可用字段）
 */
function buildShotSegment(
  scene: SplitScene,
  shotIndex: number,
  refs: CollectedRefs,
): ShotSegment {
  const parts: string[] = [];

  // 过滤无效值的辅助函数
  const isValid = (v?: string | null): v is string =>
    !!v && !['none', 'null', '无', '无技法', '默认'].includes(v.toLowerCase().trim());

  // ===== 镜头语言（运镜 + 景别 + 角度 + 焦距 + 摄影技法） =====
  if (isValid(scene.cameraMovement)) parts.push(scene.cameraMovement);
  if (isValid(scene.shotSize)) parts.push(scene.shotSize);
  if (isValid(scene.cameraAngle)) parts.push(scene.cameraAngle);
  if (isValid(scene.focalLength)) parts.push(scene.focalLength);
  if (isValid(scene.photographyTechnique)) parts.push(scene.photographyTechnique);
  if (isValid(scene.specialTechnique)) parts.push(scene.specialTechnique);

  // ===== 机位描述 =====
  if (scene.cameraPosition?.trim()) parts.push(`camera: ${scene.cameraPosition.trim()}`);

  // ===== 动作描述（优先视频提示词，其次动作摘要） =====
  const action = scene.videoPromptZh?.trim() || scene.videoPrompt?.trim()
    || scene.actionSummary?.trim() || '';
  if (action) parts.push(action);

  // ===== 灯光 =====
  const lightParts: string[] = [];
  if (isValid(scene.lightingStyle)) lightParts.push(scene.lightingStyle);
  if (isValid(scene.lightingDirection)) lightParts.push(scene.lightingDirection);
  if (isValid(scene.colorTemperature)) lightParts.push(scene.colorTemperature);
  if (scene.lightingNotes?.trim()) lightParts.push(scene.lightingNotes.trim());
  if (lightParts.length > 0) parts.push(`lighting: ${lightParts.join(', ')}`);

  // ===== 景深 + 焦点 =====
  if (isValid(scene.depthOfField)) parts.push(`DoF: ${scene.depthOfField}`);
  if (scene.focusTarget?.trim()) parts.push(`focus: ${scene.focusTarget.trim()}`);
  if (isValid(scene.focusTransition)) parts.push(`focus-transition: ${scene.focusTransition}`);

  // ===== 器材 + 运动速度 =====
  if (isValid(scene.cameraRig)) parts.push(`rig: ${scene.cameraRig}`);
  if (isValid(scene.movementSpeed) && !['normal', 'static'].includes(scene.movementSpeed!)) parts.push(`speed: ${scene.movementSpeed}`);

  // ===== 氛围特效 =====
  if (scene.atmosphericEffects && scene.atmosphericEffects.length > 0) {
    parts.push(`atmosphere: ${scene.atmosphericEffects.join(', ')}`);
  }

  // ===== 播放速度 =====
  if (scene.playbackSpeed && scene.playbackSpeed !== 'normal') {
    parts.push(`playback: ${scene.playbackSpeed}`);
  }

  // ===== 情绪氛围 =====
  if (scene.emotionTags && scene.emotionTags.length > 0) {
    parts.push(`mood: ${scene.emotionTags.join(' → ')}`);
  }

  // ===== @Image 引用（该镜头的首帧） =====
  const frameRef = refs.images.find(r => r.id === `firstframe_${scene.id}`);
  if (frameRef) parts.push(`reference: ${frameRef.tag}`);

  return {
    sceneId: scene.id,
    sceneName: scene.sceneName || `镜头${scene.id + 1}`,
    shotIndex,
    description: parts.join(', '),
    dialogue: scene.dialogue || '',
    duration: scene.duration > 0 ? scene.duration : 5,
  };
}

// ==================== Main Builder ====================

export interface BuildGroupPromptOptions {
  group: ShotGroup;
  scenes: SplitScene[];
  characters: Character[];
  sceneLibrary: Scene[];
  /** 风格 token（从 storyboardConfig） */
  styleTokens?: string[];
  /** 宽高比 */
  aspectRatio?: SClassAspectRatio;
  /** 是否包含对白唇形同步 */
  enableLipSync?: boolean;
  /** 格子图引用（如果提供，使用格子图模式收集引用） */
  gridImageRef?: AssetRef | null;
}

/**
 * 构建组级 prompt — S级核心函数
 *
 * 输出格式：
 * ```
 * Multi-shot narrative video (3 shots, 14s total):
 *
 * Shot 1 (0-5s): [camera movement], [action], reference: @Image1
 * Shot 2 (5-9s): [camera movement], [action], reference: @Image2
 * Shot 3 (9-14s): [camera movement], [action], reference: @Image3
 *
 * Character references: @Image4 (角色A), @Image5 (角色B)
 * Scene reference: @Image6 (教室)
 *
 * Dialogue & Lip-Sync:
 * [Dialogue at ~2s] 角色A: "台词" — lip-sync required
 *
 * Style: cinematic, warm lighting...
 * ```
 */
export function buildGroupPrompt(options: BuildGroupPromptOptions): GroupPromptResult {
  const {
    group,
    scenes,
    characters,
    sceneLibrary,
    styleTokens,
    aspectRatio,
    enableLipSync = true,
    gridImageRef,
  } = options;

  // 1. 收集所有 @引用（格子图模式或旧版模式）
  const refs = collectAllRefs(group, scenes, characters, sceneLibrary, gridImageRef);

  // 2. 构建各镜头片段
  const shotSegments = scenes.map((scene, idx) =>
    buildShotSegment(scene, idx + 1, refs)
  );

  // 3. 计算时间轴
  let timeOffset = 0;
  const totalDuration = shotSegments.reduce((sum, s) => sum + s.duration, 0);

  // 4. 如果用户已手动编辑过 mergedPrompt，优先使用
  if (group.mergedPrompt && group.mergedPrompt.trim()) {
    const dialogueSegs = enableLipSync ? extractDialogueSegments(scenes, characters) : [];
    return {
      prompt: group.mergedPrompt,
      charCount: group.mergedPrompt.length,
      overCharLimit: group.mergedPrompt.length > SEEDANCE_LIMITS.maxPromptChars,
      refs,
      shotSegments,
      dialogueSegments: dialogueSegs,
    };
  }

  // 5. 自动组装 prompt
  const promptParts: string[] = [];

  // 标题行
  if (gridImageRef) {
    promptParts.push(
      `Multi-shot video from grid @Image1 (${scenes.length} shots, ${totalDuration}s total):`
    );
  } else {
    promptParts.push(
      `Multi-shot narrative video (${scenes.length} shots, ${totalDuration}s total):`
    );
  }
  promptParts.push('');

  // 各镜头描述：使用原始 videoPrompt，按时间线拼接
  for (const seg of shotSegments) {
    const endTime = timeOffset + seg.duration;
    promptParts.push(
      `Shot ${seg.shotIndex} [${timeOffset}s-${endTime}s] "${seg.sceneName}": ${seg.description}`
    );
    timeOffset = endTime;
  }

  // 角色引用标签
  const charRefTags = refs.images
    .filter(r => r.id.startsWith('char_'))
    .map(r => {
      const charId = r.id.replace('char_', '');
      const char = characters.find(c => c.id === charId);
      return `${r.tag} (${char?.name || 'character'})`;
    });
  if (charRefTags.length > 0) {
    promptParts.push('');
    promptParts.push(`Character references: ${charRefTags.join(', ')}`);
  }

  // 场景引用标签
  const sceneRefTags = refs.images
    .filter(r => r.id.startsWith('scene_'))
    .map(r => r.tag);
  if (sceneRefTags.length > 0) {
    promptParts.push(`Scene references: ${sceneRefTags.join(', ')}`);
  }

  // 视频引用
  if (refs.videos.length > 0) {
    const videoTags = refs.videos.map(r => `${r.tag} (${r.fileName})`);
    promptParts.push(`Video references: ${videoTags.join(', ')} — replicate camera movement and pacing`);
  }

  // 音频引用
  if (refs.audios.length > 0) {
    const audioTags = refs.audios.map(r => `${r.tag} (${r.fileName})`);
    promptParts.push(`Audio references: ${audioTags.join(', ')} — match rhythm and mood`);
  }

  // 音频设计（环境音 + 音效，按镜头列出）
  const audioLines: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const aParts: string[] = [];
    if (s.audioAmbientEnabled !== false && s.ambientSound?.trim()) {
      aParts.push(`ambient: ${s.ambientSound.trim()}`);
    }
    const sfxText = s.soundEffectText?.trim();
    const sfxTags = s.soundEffects?.length ? s.soundEffects.join(', ') : '';
    if (s.audioSfxEnabled !== false && (sfxText || sfxTags)) {
      aParts.push(`sfx: ${sfxText || sfxTags}`);
    }
    if (aParts.length > 0) {
      audioLines.push(`Shot ${i + 1}: ${aParts.join('; ')}`);
    }
  }
  if (audioLines.length > 0) {
    promptParts.push('');
    promptParts.push('Audio design:');
    audioLines.forEach(line => promptParts.push(line));
  }

  // 对白唇形同步
  const dialogueSegments = enableLipSync
    ? extractDialogueSegments(scenes, characters)
    : [];
  const dialoguePart = buildDialoguePromptPart(dialogueSegments);
  if (dialoguePart) {
    promptParts.push(dialoguePart);
  }

  // 风格
  if (styleTokens && styleTokens.length > 0) {
    promptParts.push('');
    promptParts.push(`Style: ${styleTokens.join(', ')}`);
  }

  // 宽高比提示
  if (aspectRatio) {
    promptParts.push(`Aspect ratio: ${aspectRatio}`);
  }

  // 一致性约束
  promptParts.push('');
  promptParts.push('Maintain consistent character appearance across all shots. Smooth transitions between shots. No text or watermarks.');

  const prompt = promptParts.join('\n');

  return {
    prompt,
    charCount: prompt.length,
    overCharLimit: prompt.length > SEEDANCE_LIMITS.maxPromptChars,
    refs,
    shotSegments,
    dialogueSegments,
  };
}

/**
 * 快速预估一个组的 @引用数量（不执行完整构建）
 */
export function estimateGroupRefs(
  group: ShotGroup,
  scenes: SplitScene[],
): { images: number; videos: number; audios: number; total: number } {
  const charIds = new Set(scenes.flatMap(s => s.characterIds || []));
  const sceneRefCount = scenes.filter(s => s.sceneReferenceImage || s.sceneLibraryId).length;
  const frameCount = scenes.filter(s => s.imageDataUrl || s.imageHttpUrl).length;

  const images = Math.min(frameCount + charIds.size + sceneRefCount, SEEDANCE_LIMITS.maxImages);
  const videos = Math.min((group.videoRefs || []).length, SEEDANCE_LIMITS.maxVideos);
  const audios = Math.min((group.audioRefs || []).length, SEEDANCE_LIMITS.maxAudios);

  return { images, videos, audios, total: images + videos + audios };
}
