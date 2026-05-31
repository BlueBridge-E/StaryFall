---
title: Recordly 深度解析：开源全栈录屏工具的技术架构与设计哲学
description: Recordly 是一个拥有 15.6k+ stars 的开源录屏与演示视频制作工具，支持 macOS、Windows、Linux 三平台。本文从架构设计、录屏管线、渲染引擎、导出流程到扩展体系进行完整技术拆解。
date: 2026-05-31
tags: [open-source, electron, typescript, screen-recorder, swift]
---

[Recordly](https://github.com/webadderallorg/Recordly) 是一个开源的全功能录屏和演示视频编辑器，允许用户无需后期剪辑就能直接产出专业级演示视频。项目在 GitHub 上拥有 15.6k+ stars，3 个月即达此规模，社区关注度很高。

## 项目概况

| 维度 | 信息 |
|------|------|
| **仓库** | webadderallorg/Recordly |
| **Star** | 15,600+ |
| **语言** | TypeScript + Swift + C++ (C++) |
| **框架** | Electron 39 + React 18 + PixiJS 8 |
| **许可证** | AGPL 3.0 |
| **版本** | 1.3.3 |
| **平台** | macOS 14.0+ / Windows 10 19041+ / Linux |

## 一句话定位

> **免剪辑的录屏+演示视频工作台**。无需把原始素材丢给后期人员做缩放、光标美化、背景装饰，一个 App 内全部搞定。

## 整体架构

### 技术栈全景

```
┌──────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Electron Main Process                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐   │  │
│  │  │ window   │ │  ipc     │ │  updater        │   │  │
│  │  │ manager  │ │ handlers │ │  (auto-update)  │   │  │
│  │  └──────────┘ └──────────┘ └─────────────────┘   │  │
│  │  ┌──────────┐ ┌──────────┐                       │  │
│  │  │ media    │ │ renderer │                       │  │
│  │  │ server   │ │ server   │                       │  │
│  │  └──────────┘ └──────────┘                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Native Helpers (子进程/二进制)              │  │
│  │  ┌────────────────────┐  ┌─────────────────────┐  │  │
│  │  │ ScreenCaptureKit   │  │ WGC Capture         │  │  │
│  │  │ Recorder (Swift)   │  │ (C++ WinRT)         │  │  │
│  │  └────────────────────┘  └─────────────────────┘  │  │
│  │  ┌────────────────────┐  ┌─────────────────────┐  │  │
│  │  │ Cursor Monitor     │  │ GPU Export Probes   │  │  │
│  │  │ (C++/node addon)   │  │ (CUDA/Vulkan)       │  │  │
│  │  └────────────────────┘  └─────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Renderer Process (React)               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐   │  │
│  │  │ Launcher │ │ Editor   │ │ Timeline        │   │  │
│  │  │ UI       │ │ UI       │ │ dnd-timeline    │   │  │
│  │  └──────────┘ └──────────┘ └─────────────────┘   │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │        PixiJS 8 (渲染引擎)                   │   │  │
│  │  │  场景合成 / 动画 / 光标 / 字幕 / 覆盖物      │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
         │                     │
         ▼                     ▼
   ffmpeg (导出)       recordly 项目文件
```

### 跨平台录屏管线

Recordly 最核心的能力是**平台原生录屏**，每一层的平台适配策略值得细看。

#### macOS：ScreenCaptureKit + Swift CLI

Recordly 在 macOS 上走的是 ScreenCaptureKit（苹果在 macOS 12.3+ 引入的录屏框架），封装为一个独立的 Swift 可执行文件 `ScreenCaptureKitRecorder.swift`。

关键设计要点：

1. **CLI 子进程模式**：Electron 主进程通过 child_process 调用 Swift 二进制，JSON 传配置、stdio 传控制命令。这种架构使录屏与 UI 进程完全解耦，录屏不会因 UI 卡顿受影响。

2. **四音轨输出**：录屏时会写入四条音轨：
   - **视频内联音频**（inlineAudioInput）— 直接写进 MP4 轨道，保证基础播放兼容
   - **系统音频独立文件**（systemAudioWriter）— 分离出纯净系统音频
   - **麦克风音频独立文件**（microphoneOnlyWriter）— 分离出麦克风音频
   - 内联音频 + 系统音频/麦克风的组合写进 mp4 同一轨道

   这样用户可以在后期编辑中选择使用哪个音频源，而无需依赖 ffmpeg mux 步骤。

3. **暂停/恢复机制**：通过 CMClockGetHostTimeClock 记录暂停持续时间，在恢复后对所有音视频帧的时间戳做偏移修正，保证了暂停不会造成音画不同步。

4. **窗口有效性监控**：录制单个窗口时，每 500ms 轮询 SCShareableContent 检查窗口是否存在，丢失时自动停止录制并保存。这是典型的「录了但窗口关了场景」的防御处理。

5. **权限预检查**：启动录屏前做 CGPreflightScreenCaptureAccess() + AVCaptureDevice.requestAccess 双重权限校验，在不满足时友好退出而非 crash。

#### Windows：Windows Graphics Capture (WGC) + C++ native addon

Windows 端使用 Windows Graphics Capture API（需要 Win10 20H1 Build 19041+），通过 C++ 编写的 Node.js 原生 addon 接入。

路径在 `electron/native/wgc-capture/` 和 `electron/native/windows-capture/`，用 CMake 构建。这套机制比 Electron 自带的 desktopCapturer 更可靠，能够隐藏系统光标。

#### Linux：Electron desktopCapturer（回退方案）

Linux 没有专属原生 helper，直接走 Electron 的桌面捕获 API。局限是：
- 无法隐藏系统光标
- 系统音频需要 PipeWire 支持
- 录制效果取决于桌面环境和窗口管理器

### 架构分层

#### 1. Electron 主进程

入口 `electron/main.ts`，管理窗口生命周期、IPC 路由、Tray、更新逻辑。

**GPU 加速策略**：启动参数中强制启用 `ignore-gpu-blocklist`、`enable-unsafe-webgpu`、`enable-gpu-rasterization`，并根据平台动态配置 ANGLE/GL 后端。此外还有 `getGpuSwitches()` 做平台特定的 GPU 开关适配。

**窗口管理**：
- Launcher 窗口（源选择界面）
- HUD 覆盖层（录制中的浮动状态面板）
- Editor 窗口（视频编辑器，含 PixiJS 渲染）
- Update Toast 窗口（更新提示）

**单实例锁**：通过 `app.requestSingleInstanceLock()` 确保只有一个 Recordly 实例运行，第二个实例激活时接管已有窗口。

#### 2. 媒体服务器

`electron/mediaServer.ts` — 一个轻量的 HTTP 服务器，监听 `127.0.0.1:随机端口`，提供 HLS-like 的字节范围请求（Byte-Range）支持。

这个设计很有意思：视频文件不通过 IPC 传给渲染进程，而是通过本机 HTTP 提供，渲染进程用 `<video>` 元素直接请求特定字节范围做预览。既避免了大型 IPC 传输的性能问题，也天然支持带 CORS 的媒体播放。

安全方面，路径白名单在 `approvedLocalReadPaths` 中管理，只有白名单内的文件可被访问。

#### 3. PixiJS 渲染引擎

**这是 Recordly 技术上最值得关注的设计决策。**

视频编辑器通常用 `ffmpeg` 拼接字幕、缩放、光标，或者走 WebCodecs/MSE 管线。Recordly 选择 PixiJS 8 作为实时渲染引擎：

- 场景合成：用 PixiJS 的 DisplayObject 树来组合视频帧、光标覆盖层、Webcam 气泡、注解层
- 后处理效果：drop-shadow、motion-blur 等滤镜直接用 PixiJS filter
- 光标渲染：不依赖录屏原生光标，而是用 uiohook-napi 捕获鼠标事件，在 PixiJS 画布上重绘风格化光标（支持大小、平滑、点击弹跳、拖尾效果）

优点：**渲染和导出走同一套场景逻辑**，所见即所得。

#### 4. 时间线编辑器

前端使用 `dnd-timeline` 库（React 拖拽时间线）配合自定义 hook，核心类型定义在 `timeline/model/timelineTypes.ts`。项目文件格式 `.recordly` 保存原始媒体路径+完整编辑器状态，支持恢复编辑。

#### 5. 导出管线

导出不是简单的 ffmpeg 拼接。Recordly 把 PixiJS 场景**逐帧渲染为图像序列**，再合成视频。对应路径 `electron/ipc/export/`：

```
渲染场景 → 帧捕获 → 编码 → (MP4 / GIF)
```

GIF 导出用了 `gif.js` 库，MP4 导出则通过 ffmpeg 或原生 GPU 加速路径（NVIDIA CUDA compositor）。

`scripts/benchmark-export-queues.mjs` 表明导出管线有并发队列管理和性能基准测试。

### 扩展体系

Recordly 有一套社区驱动的扩展系统，文档在 `EXTENSIONS.md`（10.8KB），线上 Marketspace 在 `marketplace.recordly.dev/extensions`。

支持的能力：
- 光标点击音效
- 设备边框效果
- 浏览器模拟框
- 壁纸
- 渲染钩子
- 设置面板

构建方式：标准 npm 包格式，通过 Electron IPC 注册到主进程。`electron/extensions/` 下包含扩展相关的 IPC handler，`ExtensionManager.tsx` / `ExtensionIcon.tsx` 是 UI 侧的管理入口。

### 依赖分析

| 依赖 | 用途 | 体积影响 |
|------|------|---------|
| **PixiJS 8** | 核心渲染引擎 | 核心 |
| **React 18** | UI 框架 | 核心 |
| **GSAP** | 动画引擎 | 中 |
| **Motion (framer-motion)** | React 动画 | 中 |
| **Radix UI** | 无障碍 UI 组件 | 核心 |
| **dnd-timeline** | 时间线拖拽 | 核心 |
| **uiohook-napi** | 全局鼠标键盘钩子 | 轻量 |
| **Electron 39** | 桌面框架 | 大 |
| **ffmpeg-static** | 视频编码回退 | 大（含二进制）|
| **capturekit** | 录屏框架 | 核心 |
| **electron-updater** | 自动更新 | 轻量 |
| **Vite 5** | 构建工具 | 开发 |

UI 组件几乎全线走 Radix UI，配合 Tailwind CSS + class-variance-authority + clsx，风格统一性好。

### 项目结构与规模

```
Recordly/
├── electron/         ← 主进程 + native helpers
│   ├── main.ts          (主入口, 28.8KB)
│   ├── ipc/             (IPC handlers)
│   │   ├── export/      (导出管线)
│   │   ├── recording/   (录制控制)
│   │   ├── cursor/      (光标)
│   │   ├── ffmpeg/      (FFmpeg 桥接)
│   │   ├── project/     (项目文件)
│   │   └── captions/    (字幕)
│   ├── native/          (各平台原生代码)
│   │   ├── ScreenCaptureKitRecorder.swift
│   │   ├── wgc-capture/ (Windows WGC C++)
│   │   ├── windows-capture/
│   │   ├── cursor-monitor/
│   │   └── nvidia-cuda-compositor/
│   └── extensions/      (插件系统)
├── src/              ← 渲染进程 (React + PixiJS)
│   ├── components/
│   │   ├── video-editor/  (核心编辑器)
│   │   │   ├── VideoEditor.tsx (204KB!!! 最大组件)
│   │   │   ├── timeline/      (时间线)
│   │   │   └── audio/         (音频处理)
│   │   ├── ui/              (Radix UI 组件)
│   │   └── launch/          (启动界面)
│   └── lib/              (工具库)
├── scripts/          ← 构建脚本
└── packages.json     (440KB lock)
```

**注意**：`VideoEditor.tsx` 达到了 **204KB**——这是一个反模式的信号，单个组件承载了过多逻辑，建议拆分。这是项目早期快速迭代的典型痕迹。

## 核心设计亮点

### 1. 渲染与导出同源

最大的设计决策是用 PixiJS 同时做预览渲染和导出渲染。这意味着编辑器中看到的每一个效果（光标动画、缩放、注释、Webcam 覆盖）在导出时 1:1 复现，无需为导出单独实现一套逻辑。

### 2. macOS 录屏的 CLI 子进程模式

Swift 录屏程序作为独立二进制，通过 stdio JSON 通信而非 Electron IPC。优点：
- 录屏不依赖 Electron 事件 loop，稳定可靠
- 录屏崩溃不影响 UI 进程
- 方便调试和热更新

### 3. 字节范围媒体服务器

用本机 HTTP 服务器做媒体流分发而非直接文件读取，这在 Electron 架构中是个巧妙的"降维打击"。渲染进程只需标准 `<video>` 标签 + `Range` header 的 HTTP 请求，PixiJS 的场景渲染完全不受媒体加载方式影响。

### 4. 三平台同等能力但不同路径

不追求统一的跨平台抽象，而是每平台走各自最优路径：
- macOS → Swift + ScreenCaptureKit
- Windows → C++ + WGC / WASAPI
- Linux → Electron 内建 + PipeWire

这比很多"写一次跑所有平台"的框架更务实。

## 问题与风险点

1. **VideoEditor.tsx 204KB** — 典型的"上帝组件"反模式，可维护性和可测试性有问题
2. **macOS 14.0+ only** — ScreenCaptureKit + 系统音频需要 macOS 14 Sonoma，老系统用户被排除
3. **AGPL 3.0 许可证** — 对商业使用不友好，修改后必须开源
4. **Linux 体验较弱** — 无原生 cursor 隐藏、系统音频依赖 PipeWire、整体功能不如 Mac/Windows
5. **测试覆盖** — 有 `*.test.ts` 文件，但数量相对不足，核心的 PixiJS 合成逻辑测试较少
6. **electron-builder 打包** — `npm run build` 产生 ~200MB+ 的安装包（含 ffmpeg 二进制和 Swift 编译产物）

## 与同类工具对比

| 特性 | **Recordly** | Screen Studio | OBS Studio | Kap |
|------|-------------|---------------|------------|-----|
| **授权** | 开源 AGPL | 商业（$89/年） | 开源 GPL | 开源 MIT |
| **内置编辑** | ✅ PixiJS 引擎 | ✅ 专业级 | ❌ 仅录制 | ❌ 仅录制 |
| **自动缩放** | ✅ 基于活动检测 | ✅ AI 驱动 | ❌ | ❌ |
| **光标美化** | ✅ 风格化渲染 | ✅ 专业 | ❌ | ❌ |
| **Webcam 覆盖** | ✅ 气泡模式 | ✅ | ✅ 传统布局 | ❌ |
| **GIF 导出** | ✅ | ✅ | ❌ 需插件 | ✅ |
| **插件系统** | ✅ 社区扩展 | ❌ | ✅ 全功能 | ❌ |
| **三平台** | ✅ | ❌ 仅 Mac | ✅ | ❌ 仅 Mac |
| **硬件加速** | GPU/CUDA | ✅ Metal | ✅ | ❌ |

Recordly 的直接对标是 **Screen Studio**（Mac 专属、年费 $89），但它比 Screen Studio 多出 Windows/Linux 支持和开源许可。OBS 是直播工具界的王者但编辑能力几乎为零；Kap 是轻量录屏但早已停滞更新。所以 Recordly 在「**录屏开箱即用+内置精美编辑**」这个交叉定位上，目前开源界没有直接竞品。

## 总结

Recordly 不是一个"又一个录屏工具"。它的核心价值在于：

1. **打破了录屏→剪辑的分离工作流**，让一次性产出成为可能
2. **渲染引擎复用艺术**，预览即导出，零差异
3. **三平台务实适配**，不搞统一抽象，走各平台最优解
4. **社区扩展驱动**，以插件机制构建生态护城河

1.3.3 版本已进入成熟期，功能覆盖完整。对于需要录屏做产品 demo、教学视频、技术分享的团队和个人，Recordly 是目前开源界最值得关注的选择。

*创始人在 README 中提到项目是 OpenScreen 的分支，经过超过 80% 的代码重写。*
