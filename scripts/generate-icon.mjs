import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.join(__dirname, '../build')

// 确保 build 目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

// 创建一个现代风格的图标 SVG
// 紫色渐变背景 + 白色 "魔" 字艺术化设计
const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6"/>
      <stop offset="50%" style="stop-color:#7C3AED"/>
      <stop offset="100%" style="stop-color:#6D28D9"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F472B6"/>
      <stop offset="100%" style="stop-color:#EC4899"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- 圆角背景 -->
  <rect x="32" y="32" width="448" height="448" rx="80" fill="url(#bg)" filter="url(#shadow)"/>
  
  <!-- 装饰性光效 -->
  <ellipse cx="180" cy="180" rx="120" ry="80" fill="white" opacity="0.1"/>
  
  <!-- 魔 字的艺术化表现 - 使用几何图形 -->
  <!-- 上部横线 -->
  <rect x="140" y="140" width="232" height="24" rx="12" fill="white"/>
  
  <!-- 中间部分 - 广字头 -->
  <rect x="160" y="180" width="24" height="180" rx="12" fill="white"/>
  <rect x="160" y="180" width="192" height="24" rx="12" fill="white"/>
  
  <!-- 林字左边 -->
  <rect x="200" y="220" width="16" height="100" rx="8" fill="white"/>
  <rect x="180" y="280" width="56" height="16" rx="8" fill="white"/>
  
  <!-- 林字右边 -->
  <rect x="270" y="220" width="16" height="100" rx="8" fill="white"/>
  <rect x="250" y="280" width="56" height="16" rx="8" fill="white"/>
  
  <!-- 鬼字底部 -->
  <path d="M200 340 Q256 380 312 340" stroke="url(#accent)" stroke-width="20" fill="none" stroke-linecap="round"/>
  <circle cx="230" cy="370" r="12" fill="url(#accent)"/>
  <circle cx="282" cy="370" r="12" fill="url(#accent)"/>
  
  <!-- 点缀星星 -->
  <circle cx="380" cy="120" r="8" fill="white" opacity="0.8"/>
  <circle cx="400" cy="160" r="5" fill="white" opacity="0.6"/>
  <circle cx="120" cy="400" r="6" fill="white" opacity="0.7"/>
</svg>
`

async function generateIcons() {
  console.log('🎨 生成图标中...')
  
  const pngPath = path.join(buildDir, 'icon.png')
  const icoPath = path.join(buildDir, 'icon.ico')
  
  // 生成 512x512 PNG
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(pngPath)
  console.log('✅ 生成 icon.png (512x512)')
  
  // 生成多尺寸 PNG 用于 ICO
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map(size => 
      sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toBuffer()
    )
  )
  
  // 转换为 ICO
  const icoBuffer = await pngToIco(pngBuffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log('✅ 生成 icon.ico (多尺寸)')
  
  console.log(`\n📁 图标已保存到: ${buildDir}`)
}

generateIcons().catch(console.error)
