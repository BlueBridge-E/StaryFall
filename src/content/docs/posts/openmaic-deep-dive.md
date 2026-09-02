---
title: OpenMAIC 源码级解析：清华 20k star 多智能体课堂，怎么用一个 prompt 生成一场 AI 授课？
description: 从 director-graph 编排引擎、流式结构化输出解析器，到 action engine 与播放状态机，逐层拆解 OpenMAIC 如何把「请你教我量子物理」变成一场可交互的沉浸式课堂。
date: 2026-09-02
tags: [多智能体, 教育AI, LangGraph, AI Agent, OpenMAIC, Next.js]
---

# OpenMAIC 源码级解析：一句 prompt 生成一场 AI 授课，是怎么做到的？

> **信息来源：** 本文基于 THU-MAIC/OpenMAIC `main` 分支（v1.0.0，2026-08-27）源码实读 + 官方 README / CHANGELOG。涉及文件：`lib/orchestration/director-graph.ts`、`lib/orchestration/stateless-generate.ts`、`lib/orchestration/ai-sdk-adapter.ts`、`lib/playback/engine.ts`、`package.json`。文中标注「源码」指直接引自主仓库文件。

---

## 1. 项目速览（TL;DR）

**一句话定义：** OpenMAIC（Open Multi-Agent Interactive Classroom）是一个开源 AI 教学平台——把一个主题或一份文档，通过多智能体编排，变成含幻灯片、测验、交互模拟和项目式学习的「沉浸式课堂」，由会说话、会画白板的 AI 老师和 AI 同学实时授课。

| 维度 | 数值 |
|------|------|
| Sponsor | 清华大学（THU-MAIC，Maosong Sun 团队） |
| Stars / Forks | 21.2k / 4.2k |
| License | MIT（`mathml2omml` 为 LGPL-3.0，`pptxgenjs` 为第三方 MIT） |
| 主要语言 | TypeScript（Next.js 16 App Router） |
| 最近版本 | v1.0.0（2026-08-27），480 commits |
| 学术支撑 | JCST 论文：《From MOOC to MAIC: Reimagine Online Teaching and Learning through LLM-driven Agents》 |

**一句话 verdict：** ⭐ 值得投入——它把「教育 × 多智能体」这件事做实了：既是可直接商用/二次开发的产品（MIT），也是一份工程质量相当高、值得抄作业的 LangGraph + AI SDK 编排参考实现。

---

## 2. 为什么存在？（Why）

### 它要解决什么具体问题？

传统 MOOC/录播课最大的痛点是「单向灌输」：学生看视频、被动吸收，没有能动性。AI 时代想把它变成「互动课堂」，业界普遍有两大困惑：

1. **LLM 生成的不是课堂，是一段段文字**——要让 AI「像老师一样」讲课，需要它边说边切换幻灯片、在白板上写公式、高亮重点、出题、追问……这些不是聊天，是**编排动作**。
2. **多智能体课堂听起来很炫，但没人跑通**——几个 AI 角色怎么轮流发言？谁控制节奏？讨论状态怎么保存？别把状态搞成一团乱麻。

### 现有方案的痛点（before）

| 维度 | 传统录播课 / 简单 AI 课件 | OpenMAIC |
|------|------|------|
| 交互性 | 无，单向看视频 | AI 老师实时授课 + 提问打断 + 白板 |
| 沉浸感 | 文本/静态 PPT | 语音 TTS、激光笔、聚光灯、3D/仿真 |
| 多智能体 | 罕见，多数是单 agent 对话框 | 导演编排多位 AI 同伴讨论/辩论 |
| 可编辑性 | 生成啥是啥 | 逐页编辑、Agent 工作台重建 |
| 导出去向 | 难带走 | 可编辑 .pptx / 自包含 .html（离线可用） |

### 核心洞察

**把「LLM token 流」翻译成「课堂动作流」**，中间加一层**结构化的流式协议**：让 AI 输出一个 JSON 数组，数组里自由混排「说话(text)」和「动作(action)」，系统实时解析并驱动一个**播放状态机**。多个 AI 角色则交给一个 **director（导演）智能体**调度——你不需要设计复杂的自循环，拓扑结构本身就是节奏的边界。

> **信息来源：** 源码 `lib/orchestration/stateless-generate.ts` 顶部注释「Single-pass generation with structured JSON Array output format」「Multi-agent orchestration」；README「Overview」段落。

---

## 3. 架构与设计（How）

### 3.0 整体架构

```
用户输入 / 文档
      │
      ▼
┌─────────────────────────────────────────────┐
│ 两阶段课程生成管线 (Outline → Scenes)         │
│   Outline: AI 分析输入 → 结构化课程大纲        │
│   Scenes:  每一课 变成 Scene（slides/quiz/…） │
└───────┬─────────────────────────────────────┘
        │ 生成课件 DSL
        ▼
┌─────────────────────────────────────────────┐
│  课堂播放 / 多智能体授课（运行时）             │
│                                             │
│  Chat 请求 ──► DirectorGraph(LangGraph)     │
│                  ├ director 节点（选谁发言）  │
│                  └ agent_generate（AI授课，  │
│                      流式输出 text+action）  │
│  SSE 事件流 ──► PlaybackEngine(状态机)      │
│                  └ ActionEngine(执行 28+动作)│
└─────────────────────────────────────────────┘
```

技术底座（来自 `package.json`）：Next.js 16.1、React 19.2、LangGraph 1.1、Vercel AI SDK 6、Zustand、ProseMirror、KaTeX、@openmaic/* 六个 workspace 包（dsl/renderer/editor/importer/generation/storage）。

> **信息来源：** 源码 `package.json`；README「Key Architecture」「Project Structure」。

### 3.1 核心模块一：Director Graph（多智能体编排）——源码级

文件：`lib/orchestration/director-graph.ts`。这是整套系统的「大脑」，用 LangGraph StateGraph 搭了一个极简拓扑：

```
START → director ──(end)──→ END
           │
           └─(next)→ agent_generate ──→ END
```

**这不是一个会自己无限循环的图**——设计上刻意做成**单轮**：`agent_generate` 直接连回 END，不 loop。多轮讨论由**客户端把多次请求串起来**（每次请求带上累积的 `directorState`）。作者注释讲得很直白：

> *"Single-round contract: each request runs at most one director→agent cycle. Multi-agent discussions arise from the client serializing requests; the server graph does not loop. There is no `maxTurns` — the topology itself is the bound."*

**为什么这么设计？** 在服务端做一个无限自循环的图，意味着状态要在服务端长期驻留、要处理中断续跑和超时，极其难做对。把「一轮一请求」做成无状态，服务端只管当前这一轮谁说话、说什么，节奏由前端掌控——**用拓扑换状态，用序列换循环**。这是一个很优雅、工程上非常聪明的取舍。

#### director 节点：按 agent 数量分派策略

```ts
async function directorNode(state, config) {
  const isSingleAgent = state.availableAgentIds.length <= 1;
  // 单 agent：纯代码，零 LLM 调用
  if (isSingleAgent) {
    const agentId = state.availableAgentIds[0] || 'default-1';
    if (state.turnCount === 0) {
      // 第一轮直接派这个 agent 开讲
      return { currentAgentId: agentId, shouldEnd: false };
    }
    // 之后 cue 用户接话，保持会话活跃
    return { shouldEnd: true }; // → 写 cue_user 事件
  }
  // 多 agent 第一轮 + 有trigger：免 LLM，直接派触发者
  if (state.turnCount === 0 && state.triggerAgentId) { ... }

  // 多 agent 常规：LLM 决定下一个说话者 / USER / END
  const prompt = buildDirectorPrompt(agents, conversationSummary, ...);
  const result = await adapter._generate([SystemMessage(prompt), ...]);
  const decision = parseDirectorDecision(result.generations[0]?.text || '');
  ...
  return { currentAgentId: decision.nextAgentId, shouldEnd: decision.shouldEnd };
}
```

**值得抄的设计细节：**
- **能省一次 LLM 调用就省**：单 agent 完全不调 LLM（纯逻辑）；多 agent 第一轮由 `triggerAgentId` 命中时也不调 LLM，直接放行。只有真正需要「从几个候选里挑一个谁先开口」时才花钱让导演判断。
- **decide 的结果也要求结构化**：`parseDirectorDecision` 把 director 的「谁下一个发言」输出解析成 `{nextAgentId, shouldEnd}`，`nextAgentId === 'USER'` 表示 cue 用户。
- **防御性校验**：解析到的 agent 若不在 `availableAgentIds` 里，直接 warn 并 END，不硬跑。

#### agent_generate 节点：流式执行一个 agent

`runAgentGeneration` 做的事：装载 agent 配置 → 算**有效动作集**（按场景类型过滤，见下）→ 拼系统提示词 → 流式调 LLM → 边收边解析「text 和 action 混排的 JSON 数组」→ 逐个 write 成 `agent_start / text_delta / action / agent_end` SSE 事件。

**白板账本（whiteboardLedger）**是状态里很有心的一笔：每个 `wb_*` 动作都被记进账本，连同 agent 谁画的、参数一起广播，让后续发言的 agent 知道「白板上已经画了什么」，免得重复或互相覆盖。状态注解用 LangGraph 的 `reducer` 做追加式的 `agentResponses` / `whiteboardLedger` 合并，天然支持累加。

> **信息来源：** 源码 `lib/orchestration/director-graph.ts`（directorNode / runAgentGeneration / 状态 Annotation）。

### 3.2 核心模块二：流式结构化输出解析器——工程上最漂亮的一段

文件：`lib/orchestration/stateless-generate.ts` 里的 `parseStructuredChunk`。

让 LLM「既要自然说话、又要执行动作」的常见做法是 function calling / tool calling。OpenMAIC 选了一条更野但更稳的路：**让模型输出一个顶层 JSON 数组**，text 和 action 自由混排：

```jsonc
[
  { "type": "action", "name": "spotlight",   "params": { "elementId": "img_1" } },
  { "type": "text",   "content": "同学们，大家好……" },
  { "type": "action", "name": "wb_text",     "params": { "x": 100, "y": 200, "text": "E=mc²" } }
]
```

难点在于**它是流式的**——token 是一个个来的，你不能等模型完全输出完（太慢），要在不完整的 JSON 上边收边解析、把已完成的事件先发出去。作者写了 7 步状态的增量解析器：

1. 找开头的 `[`（跳过 ` ```json` 之类前缀）
2. 判数组是否闭合（末尾 `]`）
3. **先 `jsonrepair` 再 `partial-json` 兜底**——两步容错
4. 数「已完整」的元素个数（流式中最后一个元素可能残缺）
5. 发新完整的元素（text→文本、action→动作）
6. 对「尾部正在长的不完整 text」做**部分增量流式**（先把已到的话说出去）
7. 收尾标记 done

`finalizeParser` 还处理了最棘手的场景：**模型从头到尾没给合法 JSON**。它用 `looksLikeStructuredFragment` 识别「残余的结构化 JSON 碎片」（形如 `{"type":"text",...`），宁可把它们吞掉也**绝不把裸 JSON 漏进聊天气泡当人话显示**——这是很多生成式产品翻车的 dirty detail，处理得很严谨。

**值得学习的代码细节（逐字）：**

```ts
const repaired = jsonrepair(state.buffer);
parsed = JSON.parse(repaired);
} catch {
  parsed = parsePartialJson(state.buffer, Allow.ARR | Allow.OBJ | Allow.STR | Allow.NUM | Allow.BOOL);
}
```

先尝试「修复 + 严格解析」（拿完整可浏览的结果），修不动再退到 partial-json 增量解析——**对同一个 buffer 做两层解析，鲁棒性和完整性都要**。

> **信息来源：** 源码 `lib/orchestration/stateless-generate.ts`。

### 3.3 编排与 provider 解耦：AISdkLangGraphAdapter

文件：`lib/orchestration/ai-sdk-adapter.ts`。LangGraph 生态默认用 LangChain 的 chat model。但 OpenMAIC 想用 **Vercel AI SDK** 来统一接 20+ 家 provider（OpenAI/Anthropic/Google/DeepSeek/Qwen/Kimi/MiniMax/Groq/GLM/Bedrock/Ollama/Lemonade…）。

于是他们写了个**适配器桥**：让 `AISdkLangGraphAdapter extends BaseChatModel`（LangChain 基类）把 LangChain 的 `_generate` / `streamGenerate` 内部转发到 AI SDK 的 `callLLM` / `streamLLM`，在两端之间做 message 格式互转。

```ts
export class AISdkLangGraphAdapter extends BaseChatModel {
  private languageModel: LanguageModel; // AI SDK 的模型句柄
  async _generate(messages, ...): Promise<ChatResult> {
    const result = await callLLM({ model: this.languageModel, messages: aiMessages }, 'chat-adapter', ...);
    return { generations: [{ text: result.text, message: new AIMessage({ content: result.text }) }] };
  }
}
```

**架构意义**：编排逻辑（director-graph）只认一个抽象的 `LanguageModel`，具体接哪家、要不要 thinking、key 放哪，全部由下层 AI SDK provider 层处理，**凭据永远不下发浏览器**。这让「换一家模型商」变成改一行配置，而不是重写编排。

> **信息来源：** 源码 `lib/orchestration/ai-sdk-adapter.ts`；README「Server routes resolve LLM…credentials never reach the browser」。

### 3.4 动作执行与播放状态机

文件：`lib/playback/engine.ts` + `lib/action/engine.ts`。

`PlaybackEngine` 是一个教态状态机：

```
idle ──start()──► playing ──pause()──► paused
  ▲                 ▲                    │
  └──(讨论结束)      └────resume()───────┘
              （confirmDiscussion / handleUserInterrupt）
              ▼
            live ◄──user msg/resume──► paused
```

**核心洞察**：`PlaybackEngine` 直接消费 `Scene.actions[]`（生成时固化进课件 DSL 的动作序列），没有中间编译步骤——`ActionEngine` 逐条执行。状态机区分「讲课中(playing)」和「实时讨论(live)」两种模式，讨论时可被打断、切换。

再配合 `lib/choreography`：
- `estimateSpeechDurationMs`——估算这段 TTS 语音要多长，用于对齐动作时序；
- `CJK_LANG_THRESHOLD = 0.3`——**如果字符 >30% 是 CJK 就当中文处理**（中英混排常见，阈值故意放低，因为中文常夹杂标点/数字/短拉丁词）。这个启发式决定用哪种 TTS 语音 / 语速，很接地气。

Action Engine 支持 **28+ 动作类型**（speech、spotlight、laser、wb_text/wb_shape/wb_chart…），并且生成时按场景类型做**防御性过滤**（`getEffectiveActions`）——例如非幻灯片场景会自动剥掉 spotlight/laser，即使模型想用也不放行（director-graph 里对应那段 `if (!effectiveActions.includes(ac.actionName)) skip`）。

> **信息来源：** 源码 `lib/playback/engine.ts`、`lib/orchestration/director-graph.ts` 的 `getEffectiveActions` 调用。

---

## 4. 快速上手

### 一键体验（零部署）

- **线上 Demo：** https://open.maic.chat/ —— 直接描述主题即可生成课堂。
- **OpenClaw 通道：** `clawhub install openmaic` 后，在飞书/Slack/QQ 等聊天 App 直接说「教我一段量子物理」。

### 自托管

```bash
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
cp .env.example .env.local
# 填至少一家 LLM 的 key，例如
# OPENAI_API_KEY=sk-...
# DEFAULT_MODEL=openai:gpt-5.5
pnpm install
pnpm dev
# 打开 http://localhost:3000
```

推荐模型（README 建议）：**Gemini 3 Flash** 性价比最佳；要最高质量可上 Gemini 3.1 Pro。国内可用 GLM / DeepSeek / Qwen / Kimi，也能配 Ollama / Lemonade 本地跑。

### 常配项（`.env.local`）

| 配置 | 作用 |
|------|------|
| `ACCESS_CODE` | 站点级访问口令，保护共享部署 |
| `DEFAULT_MODEL` | 默认模型（`google:gemini-3-flash` 等） |
| `DATABASE_URL` | 开启 PostgreSQL 服务端持久化 |
| `TTS_*_BASE_URL` | 换 TTS（含 VoxCPM2 本地音色克隆） |
| `ASR_FUNASR_BASE_URL` | 本地语音识别（FunASR/SenseVoice） |

> **信息来源：** 源码 `package.json` scripts、`.env.example`；README「Quick Start」。

---

## 5. 横向对比

| 维度 | OpenMAIC | MAIC-UI（同团队） | LlamaTutor / 通用 educational agents |
|------|----------|------|------|
| 定位 | 可自定义的全栈开源课堂平台 | 专业教学 UI 生成增强 | 一般偏对话式/单科辅导 |
| 多智能体 | ✅ director 编排 + AI 同学讨论/辩论 | 偏 UI 表达层 | 偏单 agent 个性化 |
| 输出丰富度 | 幻灯片/测验/仿真/PBL/3D/游戏/白板 | 更精专的高质量教学 UI | 以文字交互为主 |
| 可编辑性 | 逐页编辑 + Agent 工作台重建 | — | 一般 |
| 便于集成 | SDK 六件套 + OpenClaw 集成 | 插件式 | 平台锁定多 |
| 授权 | MIT（含少量 LGPL 包） | — | 多样 |

**关键差异：** OpenMAIC 的护城河不是某一个算法，而是**把「生成 → 编排 → 播放 → 导出 → 二次开发」整条教育链路工程化闭环**，且用 AI SDK 抽象了 provider，用 LangGraph 抽象了编排，用 @openmaic/* packages 抽象了 DSL 与存储——分层清晰，便于按需取用或整体二次开发。

---

## 6. 使用建议与风险评估

### ✅ 推荐场景
- 想快速把任意主题/教材变成可交互课件的人（教师、知识创作者）
- 做「教育 × 多智能体」产品，需要一份**可商用的 MIT 基础 + 成熟编排参考**
- 想搭在聊天 App 上的智能学习助手（走 OpenClaw 集成）

### ❌ 不推荐场景
- 只想要「生成几页 PPT」→ 有更轻的方案，OpenMAIC 偏重（教育平台定位）
- 对性能/单页加载极敏感、想要轻量 SPA → 它是个全家桶
- 想完全离线不碰任何云 → 仍需本地 LLM/TTS 自建（可行但门槛高）

### ⚠️ 已知问题 / 风险（看 Recent Issues 小结）
- **视频导出（render-service）仍在打磨**：近期 open issue 集中在分块视频导出个别 worker 配额、chunked 导出偶发丢音频、渲染队列满时编译浪费、以及 UI 未展示真正拒因（#1353/#1352/#1350/#1349）。
- 服务端持久化默认不开（无 DB 用浏览器 localStorage/IndexedDB）；而若只开 `NEXT_PUBLIC_PERSISTENCE=1` 但没配好 `DATABASE_URL`/token，前后端不一致会看到 persistence 报错 toast，需按 README 严格对齐 build-time/run-time 变量。
- **凭据与「隔离」边界**：README 反复强调默认 `PERSISTENCE_DEV_TOKEN` 不是真 secret，仅适合本地/可信网络单用户；上生产前必须替换 `lib/persistence/server-auth.ts` 为真正的会话校验。单机部署请用官方 Docker `server-persistence` profile。

> **信息来源：** GitHub Recent Issues（#1346–#1356，2026-09-02）；README「Server-backed persistence」一节的多次安全提示。

### 🔮 未来展望
教育 Agent 正从「生成内容」走向「生成体验」。OpenMAIC 的 agent 工作台 + 持久化 session 已朝「课程构建代理」演进；下一步大概率是**静默工具调用（真正的 tool-calling 而非文本协议）**与**更深的诊断式个性化**的融合。同团队的 MAIC-UI 补 UI 表达层，二者构成一个较完整的生态版图。

---

## 7. 总结

三个核心 takeaway：

1. **用单轮拓扑做多智能体编排**：服务端不搞无限自循环，用「一轮一请求 + 客户端串状态」换取无状态和可控——这是工程取舍的教科书案例。
2. **LLM→课堂的桥是「流式结构化协议」**：text 与 action 自由混排的 JSON 数组 + jsonrepair/partial-json 双层容错解析 + 绝不泄漏裸 JSON 到界面的兜底，比单纯 function calling 更贴合「边说边演」的授课场景。
3. **工程含量高于单点创新**：与 Headroom 等的判断一致——它赢在「生成→编排→播放→导出→SDK→OpenClaw 集成」的完整闭环和清晰分层（AI SDK 接 provider / LangGraph 接编排 / @openmaic 包接 DSL 存储），而非某一个小魔法。

**一句话推荐给：** 做教育 AI 产品、或想研究「多智能体系统如何优雅落地成真实交互体验」的开发者——这是个能当课上、能拆着学的宝藏仓库。

---

*版本依据：THU-MAIC/OpenMAIC main 分支 @ v1.0.0（2026-08-27），480 commits；源码取自 director-graph.ts / stateless-generate.ts / ai-sdk-adapter.ts / playback engine.ts / package.json。*
