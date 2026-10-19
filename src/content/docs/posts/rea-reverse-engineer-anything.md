---
title: REA 深度解析：让 Agent 做逆向工程，靠什么不胡说
description: 34 万行 TypeScript、47 万行测试，REA 把 Ghidra、Hopper、IDA 等二十多种逆向工具统一到一个 MCP 接口后面。它真正的技术内核不是能分析多少格式，而是一套让模型无法把猜测伪装成事实的证据模型。
date: 2026-10-19
tags: [ai, agent, mcp, code-analysis, devtools]
---

## 一、项目速览

REA 是一个本地运行的逆向工程工具层，对外只暴露一个 MCP 服务。你把它接到 Claude Code、Codex、Cursor 或任何支持本地 MCP 的 agent 上，然后对它说：这个应用里的搜索功能是怎么实现的，给我看证据，再帮我在我的项目里做一个类似的。

它会去读二进制、读 JS 和 Electron 包、读 .NET 程序集、读 APK、读固件、读 pcap，把结论连同一手证据一起交回来。

| 维度 | 数据 |
|---|---|
| 仓库 | morluto/rea |
| 语言 | TypeScript（3,328 个 .ts 文件），另有 Python 与 Java 桥接 |
| 源码规模 | 约 34.5 万行（不含测试） |
| 测试规模 | 约 47.5 万行，**超过源码本身** |
| 许可证 | MIT |
| 当前版本 | 6.7.0（2026-10-18） |
| 创建时间 | 2026-04-14 |
| npm 周下载 | 约 30.7 万（rea-agents，2026-10-10 至 10-16） |
| 支持的深层分析引擎 | Ghidra、Hopper、IDA、JEB、Kuna、objdump、Rizin |

**一句话结论：值得投入时间读，但不是因为它支持的格式多。**

> **信息来源：** GitHub API 仓库元数据、npm registry 下载统计、`package.json`、`CHANGELOG.md`

### 1.1 先说一个不干净的数字

仓库的 star 数是 32.9 万，fork 数是 8.3 万。

这个比例不正常。正常项目的 fork 与 star 之比通常在 1:10 到 1:50 之间，这里是 1:4。再加上项目创建才半年，这个数字几乎可以确定存在刷量或引流行为。

我在后面的推荐里不会拿它当质量证据。但代码本身给出的信号是另一个方向的：34 万行源码对 47 万行测试，二十多个 provider 适配层，这种结构不是刷出来的。

---

## 二、为什么需要它

逆向工程工具并不缺。Ghidra 免费且强大，IDA 是行业标准，Hopper 在 macOS 上体验极好。问题是：**这些工具是给人设计的，不是给语言模型设计的。**

给 LLM 接 Ghidra，会撞上四堵墙。

| 痛点 | 具体表现 |
|---|---|
| 输出太大 | 一个函数的反编译结果动辄几千行，加上 xref 列表，一次就能把上下文塞满 |
| 没有溯源 | 模型拿到的是一段文本，它无法区分「这是 Ghidra 实际反编译出来的」和「这是它自己补全的」 |
| 幻觉无法验证 | 模型说「这个函数会把角度归一化到 0 到 90 度」，你无从核对 |
| 工具生命周期失控 | 逆向引擎是常驻进程，崩溃、超时、子进程泄漏都会污染后续分析 |

前三堵墙指向同一个根子：**逆向工程的核心产物是证据，不是结论。** 而普通工具调用只有结论。

REA 的核心洞察就在这里：它把「证据」做成了数据结构里的一等公民，而不是放在提示词里的一句叮嘱。

---

## 三、架构与设计

### 3.1 整体分层

依赖只能向内流动，这条规则写在仓库的 `AGENTS.md` 里，也在目录结构上强制执行：

```text
src/cli.ts + src/main.ts        入口层：CLI 一次性命令 / MCP stdio 服务
        │
        ▼
src/composition/                组装层：按需构造 provider 与会话
        │
        ▼
src/server/ + src/cli/          适配层：MCP 请求翻译、工具注册
        │
        ▼
src/application/ (355 文件)     应用层：CLI 与 MCP 共用的工作流
        │
        ▼
src/providers/ + 各引擎目录      provider 层：Ghidra / Hopper / IDA / JEB ...
        │
        ▼
src/process/                    进程基础层：所有权、超时、清理
        │
        ▼
src/domain/ (663 文件)          领域层：语义与契约，不依赖任何引擎
```

这套分层的硬约束是：**引擎协议和 provider 专属代码不能出现在领域层和应用层。** 换句话说，`src/domain/` 里没有一行 Ghidra API 调用。

这么做的收益很直接：新增一个引擎只需要实现 provider 适配，领域层的证据模型、错误代数、会话语义全部复用。Kuna 是 6.6.0 才加入的第六个深层分析引擎，看提交记录，它的接入没有改动领域层。

> **信息来源：** `docs/architecture.mermaid`、`AGENTS.md`「Architecture and Cleanup」、`CHANGELOG.md` 6.6.0

### 3.2 核心模块一：Evidence 模型

这是整个项目最值得读的部分。`src/domain/evidence.ts` 里定义了每一条证据的权威性等级：

```ts
const evidenceAuthoritySchema = z.enum([
  "shipped-artifact",
  "controlled-replay",
  "historical-reference",
  "external-service",
  "analyst-inference",
]);
```

这五级不是装饰。它对应五种完全不同的可信度：

- `shipped-artifact`：来自用户手上那份真实的产物，最硬
- `controlled-replay`：在受控条件下复现出来的行为
- `historical-reference`：历史资料、旧版本、公开文档
- `external-service`：外部服务返回的结果
- `analyst-inference`：分析者的推断，**最软**

关键在于最后一级。`analyst-inference` 是一个**合法但明确标记为推断**的等级。模型可以基于反编译结果做推断，但它必须把这条证据标记成推断，下游无法把它当成观察事实使用。

这就是第一道防幻觉机制：**不是禁止模型猜，而是让猜测必须自报家门。**

### 3.3 代码细节：证据 ID 是算出来的，不是编的

每条证据带一个 `evidence_id`，格式是 `ev_` 加 64 位 SHA-256：

```ts
const computeEvidenceId = (evidence: EvidenceWithoutId): string =>
  `ev_${digestCanonicalValue(semanticProjection(evidence), "Evidence")}`;
```

这个 ID 不是随机生成的 UUID，而是**对证据的语义投影做规范化哈希**。语义投影只取影响结论的字段：

```ts
const semanticProjection = (evidence: EvidenceWithoutId): JsonValue => ({
  subject:
    evidence.subject === null
      ? null
      : {
          digest: evidence.subject.digest,
          format: evidence.subject.format,
          architecture: evidence.subject.architecture,
        },
  provider: evidence.provider,
  analysis_profile: evidence.analysis_profile,
  predicate_type: evidence.predicate_type,
  operation: evidence.operation,
  parameters: evidence.parameters,
  raw_result: evidence.raw_result,
  normalized_result: evidence.normalized_result,
  // ...
});
```

注意 `subject.digest`：被分析文件的 SHA-256 也在里面。也就是说，**同样的操作跑在文件的另一个版本上，证据 ID 必然不同**。引用旧证据去支撑新结论，在结构上就不可能发生。

解析证据时会重新计算并比对：

```ts
if (computeEvidenceId(withoutId) !== evidenceId)
  context.addIssue({
    code: "custom",
    path: ["evidence_id"],
    message: "Evidence semantic identifier does not match its record",
  });
```

改动任何一个语义字段，ID 立刻对不上，解析直接失败。

### 3.4 规范化哈希：为什么不能直接用 JSON.stringify

这是我觉得最见功力的地方。`src/domain/canonicalDigest.ts` 实现的是 RFC 8785（JSON Canonicalization Scheme）：

```ts
for (const key of Object.keys(value).sort()) {
  // ...
  emit(JSON.stringify(key));
  emit(":");
  if (!emitCanonical(item, emit, ancestors)) emit("undefined");
}
```

对象键按字典序排序、稀疏数组保留空洞语义、`NaN` 和 `Infinity` 直接抛错、循环引用检测。理由是：JS 对象的键顺序不保证稳定，两个语义完全相同的对象，`JSON.stringify` 出来的字符串可能不同，哈希自然也不同。一份证据在序列化往返一次之后 ID 就失效了，整个机制会崩掉。

顺带一个性能细节，`hash.update` 的调用被攒到 8192 字符一批再提交，注释写着「Flush cuts only at part boundaries, so the hashed byte stream is unchanged」——批处理不改变哈希结果，只是减少跨语言边界的调用次数。

### 3.5 核心模块二：Residual Unknown

幻觉的另一面是「假装没有问题」。REA 用 `ResidualUnknown` 这个类型把「还不知道的事」也变成一等公民：

```ts
const residualUnknownObjectSchema = z.strictObject({
  unknown_id: unknownIdSchema,
  revision: z.number().int().min(1),
  previous_revision_digest: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  question: text,
  status: z.enum([
    "open", "investigating", "blocked", "contradicted", "resolved",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  supporting_evidence_ids: z.array(evidenceIdSchema),
  contradicting_evidence_ids: z.array(evidenceIdSchema),
  required_authority: z.enum([/* 同上五级 */]).nullable(),
  required_confidence: z.enum(["observed", "derived", "inferred"]),
  // ...
});
```

几个设计点值得注意：

1. **未知有修订链**。`revision` 加 `previous_revision_digest`，和一条未知相关的一切改动都留痕，不能悄悄改口。
2. **支持和反对的证据都挂上去**。`supporting_evidence_ids` 和 `contradicting_evidence_ids` 分开存，矛盾不会被抹平。
3. **未知声明自己需要什么级别的权威才能解开**。`required_authority` 说明「要解决这个问题，至少得拿到 shipped-artifact 级别的证据」，也就是告诉 agent 下一步该去做什么，而不是笼统地说「信息不足」。

这就把「我不知道」从一句免责声明，变成了一个可追踪、可收敛的工作项。

### 3.6 核心模块三：进程所有权

逆向引擎（Ghidra、IDA、Hopper）都是长期运行的重量级进程，启动动辄几十秒。管理它们最难的不是启动，是**清理**。

仓库 `AGENTS.md` 里有一句我反复读了两遍的话：

> A PID and executable path alone do not establish ownership after exit or reuse.

翻译过来：进程退出后 PID 会被系统复用，光凭「PID 是 12345、命令是 ghidra」不能证明这个进程是你启动的那个。

REA 的解法是注入运行令牌。启动子进程时打包一个 `REA_PROCESS_RUN_ID` 环境变量：

```ts
const environment = {
  ...hostEnvironment,
  ...options.env,
  REA_PROCESS_RUN_ID: options.runId,
};
```

清理时不是按 PID 杀，而是**扫全部活动进程，逐个读环境变量，只对令牌匹配的进程组发信号**：

```ts
export interface OwnedProcessGroup {
  readonly runId: string;
  readonly leaderPid: number;
  readonly processGroupId: number;
  /** Scan all live processes for this run token during cleanup. */
  readonly sweepTokenOwnedProcesses?: boolean;
  /** Groups observed in capture samples. Observation adds cleanup candidates but
   *  does not authorize signaling; every live member still needs token proof. */
  readonly sampledProcessGroupIds?: readonly number[];
}
```

最后那段注释是关键：**观察到某个进程属于这个组，只能让它成为清理候选，不能据此授权发信号。** 每个活着的成员仍然需要令牌证明。这是把「候选」和「授权」两件事分开了。

而且 `REA_PROCESS_RUN_ID` 是保留变量名，用户传入的环境变量里不许带这个键，否则就等于允许调用方伪造所有权证据。

### 3.7 provider 适配：两个桥接层的不同设计

同一个项目里，Ghidra 和 Hopper 的桥接用了完全不同的通信方式，这是被引擎本身逼出来的。

Ghidra 走的是 Java 侧的 `HeadlessScript`，通过 Unix domain socket 通信：

```text
import java.net.UnixDomainSocketAddress;
import java.nio.channels.Channels;
```

Hopper 走的是 Python，因为 Hopper 的脚本接口就是 Python：

```python
"""Authenticated REA adapter executed on Hopper's dedicated Python thread.

The bootstrap injects ``REA_SOCKET`` and a random ``REA_TOKEN`` before executing
this file with Hopper's supported ``--python`` launcher option. Keep all Hopper
API access on this thread: moving dispatch to a worker can deadlock Hopper.
"""
```

两个细节：

- **注入随机令牌 + HMAC 常量时间比较**。本地 socket 也不是随便谁都能连。
- **所有 API 调用必须在 Hopper 的专用线程上**，挪到 worker 线程会死锁。这类限制只有真正跑过才能知道，写进注释里说明作者踩过。

### 3.8 工具面：136 个工具，但契约写得很克制

MCP 工具总数 136 个，命名以动词开头：`inspect_` 35 个、`list_` 13 个、`compare_` 7 个、`trace_` 6 个。

契约描述值得单独看。比如 `compare_artifacts` 的说明：

> Compare complete artifact inventories by logical occurrence path, content identity, metadata, and graph relations. ... Summary facts are not treated as a complete inventory; comparison resolves the exact retained parent. Every delta cites both complete inputs, and **gaps yield truncated or unknown, never equivalence**.

最后半句是重点：**数据不全时返回「截断」或「未知」，永远不返回「相同」。** 差异比较最危险的失败模式就是把「我没看见差异」说成「没有差异」，REA 在契约层面堵死了这条路。

`compare_process_captures` 也有类似的一条：并发关系永不从时间戳推断。时间戳接近不等于有因果关系。

> **信息来源：** `src/contracts/sessionToolContracts.ts`

---

## 四、快速上手

安装需要 Node.js 22.19 以上。setup 会修改 agent 配置，所以要求逐项确认：

```bash
npx rea-agents setup
```

选择你的 agent，审阅它提议的改动，批准，然后重启 agent。已有配置会先备份。

纯静态分析不需要任何逆向引擎。要分析原生二进制，得先有 Ghidra、Hopper 或 IDA 之一（Ghidra 和 IDA 需要自己装，Hopper 可以在批准后由 setup 安装）。

纯 CLI 用法的例子，分析一个解包出来的 Electron 应用目录：

```bash
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json
```

返回结果里包含模块、导入关系、Electron 边界，以及每一条的证据。

给 agent 的自然语言指令大概长这样：

```text
Understand how search works in the Notes app, show me the evidence, and build a
similar feature for my project.
```

> **信息来源：** `README.md`「Quick start」「How REA works」

---

## 五、横向对比

把它和直连逆向引擎、以及现有的 MCP 逆向方案放在一起看：

| 维度 | REA | 直连 Ghidra/IDA MCP | 纯提示词方案 |
|---|---|---|---|
| 定位 | 面向 agent 的逆向工作流层 | 单引擎的 API 转发 | 让模型自己想办法 |
| 证据溯源 | 每条结论绑定证据 ID 与权威等级 | 通常只有文本输出 | 无 |
| 幻觉防护 | 结构性（推断必须标记） | 依赖提示词 | 依赖提示词 |
| 多引擎 | 六个深层引擎统一接口 | 单引擎 | 无 |
| 未知管理 | 一等公民，可追踪可收敛 | 无 | 无 |
| 进程清理 | 令牌验证的所有权 | 常见泄漏 | 不适用 |
| 学习曲线 | 中（要理解 Evidence 模型） | 中 | 低 |
| 维护活跃度 | 高（每日多次提交） | 参差 | 不适用 |
| 适用场景 | 复杂目标、多轮调查 | 单点查询 | 演示 |

第三列不是虚构的靶子。把 Ghidra 输出塞进上下文让模型“自己判断”，是目前最常见的做法，问题在于：**你无法验证它哪一句是看到的、哪一句是补出来的。**

> **信息来源：** 基于仓库源码结构与文档的对比分析

---

## 六、使用建议与风险评估

### 6.1 推荐场景

- 想复刻某个应用里的具体功能，但拿不到源码
- 需要向团队交代「这个结论是怎么来的」，证据链是硬需求
- 目标类型杂，今天看 Electron 应用、明天看 Android APK
- 已经在用 Claude Code 或 Codex，想给它加逆向能力

### 6.2 不推荐场景

- 只是想快速看一个函数的伪代码，直连 IDA 或 Ghidra 更快
- 目标是小程序或高度混淆的代码，这类场景证据模型也救不了信息量不足
- 需要云端协作分析，REA 是本地的，设计上就不上传目标

### 6.3 已知问题与风险

**平台支持不均。** Windows 上的 Ghidra 支持被标记为实验性的 P0；Linux 上部分功能需要 procps 兼容的 `ps` 才能做进程所有权检查；Kuna provider 明确不支持 Windows、PE 和 universal Mach-O。

**依赖外部引擎。** Ghidra、IDA 的安装和许可都由用户自己负责，REA 不代为安装或升级。这既是原则（安装器不该动无关软件），也意味着首次配置有门槛。

**开放 issue 里能看到真实边界。** 截止分析时 1,237 个开放 issue，抽样看最近的几条：

```text
[Bug] Rizin recent-output retains up to 3x its UTF-8 byte budget for CJK frames
[Bug] Native ownership verification trusts stale process-table UID across generations
[Windows native] Private DACL contains unexpected trustees (Win32 5) blocks Android...
```

第一条是 CJK 字符让输出预算超了三倍，第二条是进程所有权在 UID 复用时有漏洞。这些不是边角料问题，说明**所有权模型和预算模型仍在持续被现实打磨**。

**star 数不可信。** 前面说过，这个数字不要写进决策依据。

### 6.4 未来展望

从 `CHANGELOG` 的节奏看，方向很明确：持续加 provider（6.6.0 加了 Kuna）、持续补平台（Windows ARM PE、Ghidra DOS/MIPS/RISC-V/PSP）。真正值得观察的是，这套证据模型会不会被其他 MCP 工具借鉴——如果会，它的影响就远不止一个逆向工具。

---

## 七、总结

**三个 takeaway：**

1. 面对 LLM 做逆向的最大风险不是能力不足，而是**无法区分事实与推断**。REA 的答案是把它做成类型系统的问题，而不是提示词的效率问题。

2. 证据 ID 用规范化哈希算出来、绑定被分析文件的摘要、解析时重新校验——这三步让「引用旧证据支撑新结论」在结构上无法发生。

3. `AGENTS.md` 里那句「通过回归测试不能证明脆弱性已经解决」，比任何架构文档都更能说明这个项目的取舍。

**一句话推荐：** 给已经在用 AI agent 做代码调查、并且需要向上级或团队交代结论出处的人。

---

> **信息来源：** 本文基于 morluto/rea 仓库 main 分支（提交 a0edd14，版本 6.7.0）的源码、文档与 GitHub/npm 公开数据。仓库地址：https://github.com/morluto/rea
