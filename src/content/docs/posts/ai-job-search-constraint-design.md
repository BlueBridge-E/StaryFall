---
title: AI 求职框架把「别编造」写进了代码，但它的漏洞在你自己手里
description: 6.2 万 star 的 ai-job-search 用源码里的确定性检查约束 Claude Code 的幻觉，我把它的强制约束逐层拆开看了一遍，发现最薄弱的一环不是技术。
date: 2026-10-21
tags: [ai, agent, claude-code, open-source, code-analysis]
---

这个项目真正值钱的是它把「不许编造」从提示词里的请求变成了源码里的断言，而不是那 15 个斜杠命令。

之所以现在看它：7 个月涨到 6 万 star（GitHub API，2026-10-21），作者的叙述容易被读成一个能照搬的成果模板。

本文基于 commit `e16acee`（2026-10-21）。**只读核查，未运行任何项目命令**，运行时行为全部标为未验证。

## 它把「不许编造」变成了三层确定性约束

这套框架最容易被误读成「让 Claude 帮你写简历」。它的实际形态是：把一份求职的全部状态（档案、岗位库、投递记录、面试准备）落在仓库文件里，再用 12 个斜杠命令去驱动这些文件的读写，模型只负责判断，不负责记住。

三层约束的分工是这样的：

```text
         ┌─────────────────────────────────────────┐
         │  第 3 层  CI 守卫（63 个测试文件 + 7 个 job）│
         │  security_guards.py / lint_skills.py      │
         └───────────────▲─────────────────────────┘
                         │ 每次 PR
         ┌───────────────┴─────────────────────────┐
         │  第 2 层  权限围栏（settings.json）        │
         │  allow 26 条 / ask 9 条 / deny 18 条      │
         └───────────────▲─────────────────────────┘
                         │ 每次会话
         ┌───────────────┴─────────────────────────┐
         │  第 1 层  提示词协议（commands + skills）  │
         │  2,820 行命令 + 2,109 行技能              │
         └───────────────────────────────────────────┘
```

三层里只有第 2、3 层是模型绕不过去的。第 1 层仍然是「请求」：`apply.md` 里写着「所有事实必须对照三份来源」，但模型可以选择不遵守，或者走神。作者自己清楚这一点，`SECURITY.md` 里有一句判断很直接：*"Instruction-level defenses raise the bar; permission-level defenses bound the damage. Neither is a guarantee."*

上面那张图里还藏着一条不那么显眼的设计：真正做判断的是模型，真正做记忆的是文件。`posting_guard.py`、`verify_pdf.py --pages`、`verify_layout.py` 这三处逻辑都是纯 Python，没有一行依赖模型的理解。作者把「必须成立的事实」交给了代码，把「需要判断的事实」留给了模型。这条分界线画在哪里，决定了整个项目的可靠性上限。

### 决策一：把状态搬进文件，让每一轮都能被审计

放弃的是「用一个数据库或一个常驻服务管理求职进度」，换来的是「所有状态都是 git diff 可见的纯文本」。

具体表现：岗位库是 `job_scraper/seen_jobs.json`，投递记录是 `job_search_tracker.csv`，档案是 `01-candidate-profile.md`，投递归档是 `documents/applications/<company>_<role>/`。没有一个状态藏在进程内存里，也没有一个状态在会话之间靠「模型记得」来维持。

这个选择的代价很硬，而且作者是明知故犯：`/apply` 的 Step 0 里有一条醒目的规则，大意是——用户在这一轮补充的任何事实，必须在同一轮写进 `01-candidate-profile.md`，否则下一轮的事实核查会把它当成编造删掉。

**这条规则的由来是一个真实缺陷。** 事实核查（Step 3 的 Factual Grounding Audit）设计得极度严格：任何三份来源都不支持的声明一律删除。它分不清「用户上周亲口说过的事实」和「模型编出来的东西」，两者都表现为「来源里没有」。所以系统必须要求用户在对话里说出的每个细节当场落盘，否则下一次投递时，那段真实的业绩会静默消失。

用文件做状态的第二个副作用是隐私边界被交给了 git。`/setup` 会把姓名、电话、邮箱、每段工作履历、薪资期望写进受版本控制的文件；而 README 自己写明了 GitHub 不支持公开仓库的私有 fork。这条我在「边界与风险」里单独讲。

### 决策二：用第二个 agent 对抗检查，但不给它写权限

`/apply` 的核心是一个起草与审查分离的双 agent 结构：Step 2 由主 agent 写 CV 和求职信，Step 3 派一个全新上下文的 `application-reviewer` 来批改，Step 4 由主 agent 应用修改。

关键在于审查者的权限定义。`.claude/agents/application-reviewer.md` 第 4 行是：

```text
tools: Read, Glob, Grep, WebFetch, WebSearch, Bash
```

**没有 Edit，没有 Write，没有 Agent。** 这意味着审查者哪怕被岗位描述里的隐藏指令策反，也没法直接改文件、没法再派一个子 agent。它只能返回文本，由主 agent 决定要不要采纳。同一份设计用在 `/rank` 的 `posting-scorer` 上，理由写得更直白：这些 agent 手里握着未受信任的岗位文本。

放弃的是「审查者可以自己动手修」带来的效率，换来的是「未受信任内容永远碰不到写操作」。

但这里有一个我认为是真实的功能缺陷：作者在 `apply.md` Step 4 里明确要求，主 agent 不要把审查者研究得出的公司信息照单全收，必须自己再核实一遍（*"Verify every company claim via WebFetch/WebSearch before including it"*）。也就是说，主 agent 手里同时握着「未受信任的岗位文本」和写权限，隔离只在审查者那一侧成立。`SECURITY.md` 里对 `/rank` 的同类问题有一句坦白：评分 agent 的上下文里同时有评分标准和未受信任的岗位文本，而它也有 WebFetch。

## 换掉了什么，又欠下了什么

这套框架最贵的部分不是代码，是文档。`apply.md` 一个文件 42 KB、422 行，`setup.md` 441 行，12 个命令合计 2,820 行 Markdown，加上 2,109 行技能文件。`CHANGELOG.md` 有 209 KB，最新一次 release 的标题是「保留最小权限、岗位先检查后使用，以及 58 项修复」。

这种体量的工程债在两个地方最明显。

**一是页面数靠自述合规。** 我原本以为 `verify_pdf.py --pages` 会检查「CV 恰好 2 页」，读了源码才发现它的实现就是比对页数（`apply.md` Step 5b 写着 exit 1 otherwise）。至于「2 页是不是排得好看」，靠的是主 agent 用 Read 工具把 PDF 当图片看一遍，然后自己判断有没有孤立的 `\cventry` 标题。

作者显然知道纯视觉判断不可靠，所以在 Step 5b 加了一道测量：`tools/verify_layout.py` 用 pdftotext 的 `-bbox` 逐行取坐标，连续两行间距超过 100pt 就报「洞」（约 7 个空行），末页空出超过 35% 报「太薄」，正文压到页脚 90pt 带内也报。阈值全写在源码里，不是模型随机发挥。

但它的 docstring 有一句很诚实的话：这些阈值为 moderncv 和 `cover.cls` 的版式校准过，通过 `/add-template` 换掉模板之后，可能出现「幽灵洞」。**测量本身是确定性的，测量对象是变化的。**

**二是相关度加权裁剪没有权重表。** 架构文档里的说法是「CV 超页不是机械地砍最老的段落，而是给每行打分：相关性、唯一性、叙事负载，然后砍总分最低的」。我按这句话去源码里找系数，`05-cv-templates.md` 第 335 行起的原话是「给这三件事打分，砍总分最低的那一行」——**只有三个维度，没有权重，没有量化公式**。

换句话说，这不是一个算法，是一个思考清单。模型可以理解并执行，也可能理解偏。把它当成「有确定性保障」来读，会高估这套流程。

## 安全闸门查的是什么，不查什么

`tools/posting_guard.py` 是这套框架里我个人认为最值得单独拿出来看的部分，因为它处理的是一类普遍问题：把第三方网页喂给一个手里有个人数据的 agent。

它的判定逻辑写在源码常量 `INSTRUCTION_PATTERNS` 里，一共 15 条正则，覆盖的类别是：

| 类别 | 例子（来自源码正则） |
|---|---|
| 覆盖指令 | `ignore (all\|the\|previous\|prior\|above\|earlier)` |
| 否定式覆盖 | `(disregard\|forget) ... (instructions\|prompts)` |
| 冒充身份 | `you are (an\|the) (assistant\|llm\|language model)` |
| 隐藏要求 | `do not (tell\|inform) the user`、`never (mention\|reveal) this ... to the user` |
| 命令注入 | `(run\|execute) the following (command\|script\|code)` |
| 角色标记 | `^\s*(assistant\|system\|user)\s*:`、`<\|`、`\[INST\]` |
| 工具侦察 | `\.env`、`settings\.json`、`allowed-tools`、`tool_use`、`function_call` |

除了文本模式，它还处理三类不可见内容：零宽字符（词中间的会被标记为「篡改」）、Unicode tag 字符（U+E0000 到 U+E007F，一个原样渲染为空白但模型能读成 ASCII 的完整字母表），以及拉丁字母混西里尔或希腊字母的同形字攻击。

**它最值得学的一点是：移除是防线，告警不是。** 隐藏内容会被从清理后的文本里删掉，而不是只报告一下继续往下传。告警（⚠）只对「表明被针对性攻击」的信号触发——指令形状的行、篡改字符、混写字母；隐藏块和隐藏链接只作为上下文记录，因为真实网页几乎都有导航栏之类的隐藏元素。

还有一处调校很有意思：`\b(curl|wget|ssh|scp)\b` 这条会命中「SSH」，所以一个招聘 SSH 管理员的正经岗位也会被标记。作者的处理不是把它从规则里删掉，而是在 `apply.md` Step 1 写明，这条误报会用引文展示给用户，让用户一秒内判断并放行。**它从不说「拒绝」，只说「你看一眼」。**

至于它不查什么，`SECURITY.md` 里说得干脆：它是确定性的，但不是预言机。*"A manipulation written to read naturally to a human and an agent alike leaves none."* 写得像人话的操纵，一个特征都留不下。

## 上手方式

> **验证状态：未验证（仅读源码与文档，未安装、未运行任何项目命令）**

按 README 的路径，完整上手是四步：`gh repo fork --clone`、`python3 tools/install_portal_clis.py`、`claude`、`/setup`。**这四步我一条都没跑**，所以下面写的是「跑之前要知道的」，不是操作指南。

**第一步就有坑，而且作者自己标了红。** README 的 Important 块原文：公开仓库不能有私有 fork，而 `/setup` 会把你的个人信息写进受版本控制的文件。所以「fork 然后填资料」这个最顺手的动作，等于把简历发布到一个公开仓库。作者给的替代方案是不 fork，把上游当作 remote 建一个私有仓库，步骤在 `SETUP.md` 第 8 节。

**它会往你的机器上写什么。** 这一点可以纯靠读源码回答，不需要跑：

- **读哪些本地路径**：`documents/` 目录下的 PDF、LinkedIn 导出、简历（Path A 的输入）；`.env` 和 `~/.ssh`、`~/.aws`、`~/.gnupg` 在 `settings.json` 的 deny 列表里被显式禁止读取。
- **写哪些本地路径**：`CLAUDE.md`、`.claude/skills/job-application-assistant/` 下六个技能文件、`cv/`、`cover_letters/`、`job_search_tracker.csv`、`job_scraper/seen_jobs.json`、`documents/applications/`。全部在仓库目录内。
- **连哪些域名**：仓库里出现的业务域名是四个丹麦招聘站（`jobindex.dk`、`jobnet.dk`、`jobbank.dk`、`jobdanmark.dk`）、`linkedin.com`、`freehire.me`、`data.star.dk`（薪资数据），以及 `greenhouse.io`、`lever.co` 等 ATS 域名和 `github.com`。我没有找到遥测或上报端点。
- **开什么服务**：没有。没有 `listen()`，没有守护进程，没有开机自启。
- **需要什么凭据**：核心流程不需要 API key，但需要 Claude Code 的付费订阅（没有免费额度）。可选项是 Notion 的 OAuth 和 Gmail 连接器。
- **安装钩子**：`.agents/skills/*/package.json` 被 `security_guards.py` 强制禁止 `postinstall` 之类生命周期脚本，`install_portal_clis.py` 遇到声明的钩子会跳过并报告，而不是执行。

**门槛在于 LaTeX。** CV 用 lualatex 编译，求职信用 xelatex（`cover.cls` 需要 fontspec），README 明确说现代 MiKTeX 上 pdflatex 会因为 fontawesome5 报错。这意味着一个完整的 TeX 发行版（TeX Live 约 5 GB 量级，这个数字我没有实测，仅凭发行版常识判断）。

**如果真要跑，我建议的隔离条件是**：一次性容器、断网或只放行上面那几个域名、不挂载 `$HOME`、给假凭据、用一个假的求职档案而不是真实简历。这套条件来自我给博客定的执行边界规则，不是这个项目的文档要求。

## 横向对比

| 维度 | 本项目 | 直接让 Claude 写 CV | 传统 ATS 优化服务 |
|---|---|---|---|
| 事实核查 | 三源对照 + 审查者二次核查（源码可查） | 无，靠提示词 | 无，人工 |
| 岗位搜索 | 6 个 portal CLI，统一 JSON 契约 | 无，要自己粘贴 | 无 |
| 页面数校验 | 确定性（`--pages` 精确比对） | 无 | 不适用（人工） |
| 版式校验 | 确定性（`--bbox` 测洞、末页占比） | 无 | 人工 |
| 相关度裁剪 | 三个维度的思考清单，**无权重无公式** | 无 | 与人工顾问水平相关 |
| 防投毒 | 15 条正则 + 不可见字符移除（确定性） | 无 | 不适用 |
| 成本 | Claude 订阅 + 约 5 GB TeX 环境 | Claude 订阅 | 按次付费，价格未测 |

替代品一栏的「传统 ATS 优化服务」我没有用过，**未测**；这一行只是为了说明这类需求在市场上有哪些形态，不构成效果比较。

值得单独说一句的是 portal 覆盖面：6 个技能里 4 个是丹麦本土招聘站（Jobindex、Jobnet、Jobbank、Jobdanmark），另外两个是 LinkedIn 的未认证 jobs-guest 接口和 freehire.me 的公开 REST API，后者偏技术岗。**对中国大陆的求职市场，这 6 个基本都用不上**，得靠 `/add-portal` 自己生成——那个命令会调研目标站的搜索 URL 结构、robots.txt 和结果页结构，然后脚手架出一个同契约的 CLI，并在注册前实跑一次查询。

## 边界与风险

**一、公共仓库泄密，触发条件很具体：** 你按 README 的第一步 `gh repo fork` 建了公开 fork，然后跑 `/setup`。此时姓名、邮箱、电话、每段工作经历、薪资期望进入 `CLAUDE.md` 和 `01-candidate-profile.md`。`/reset profile` 能清空这些文件的内容，但**清不掉 git 历史**。这个风险不是理论上的——公开 fork 是 GitHub 的默认行为。

**二、未受信任内容与写权限同处一个上下文。** 触发条件：你 `/apply` 一个来自不熟悉招聘站的 URL，而那个页面上有精心构造的隐藏文本。`posting_guard.py` 会移除隐藏块，但如作者所述，写得像正常文字的操纵一个特征都不会留下。此时主 agent 手里有 Edit/Write，理论上可以被引导着改动 CV 或档案文件。真正能挡住这种情况的是读权限——`deny` 列表阻止了它读 `.env` 和 `~/.ssh`，所以最坏情况是污染求职数据，不是泄出系统凭据。这个判断是我的推断，依据是 `settings.json` 的 deny 规则与 `SECURITY.md` 的权限表，实际行为未验证。

**三、`fetch_page.py` 的 `robots.txt` 检查是按重定向逐个目标的。** 源码里写明「每次重定向目标前检查，无绕过开关」，并且拒绝把输出写到仓库目录内。但这个工具的输出会被 `posting_guard.py` 当成 HTML 解析，也就是说它是「浏览器头伪装抓取」，这在部分站点的服务条款里是禁止的。这是合规风险，不是技术风险。

**四、LinkedIn 的访问方式明确违反其服务条款。** `.agents/skills/linkedin-search/SKILL.md` 自己写了：基于未认证的 jobs-guest 端点，自动化访问违反 LinkedIn ToS，只能个人使用、低频率。如果你打算认真用这个技能，这是你必须自己承担的决定。

**五、作者自述的效果数字是单一样本，不能当证据。** 「69 份投递、20 场初面、1 份签下的合同」，这是一个人的一次求职经历，没有对照组，也没有说明同期投递了多少份未使用该框架的申请。它证明的是「这个人用它找到了工作」，不是「用它更容易找到工作」。

**六、`/gmail-sync` 会读你的邮箱。** 设计上它只提议、不写入，每处改动引用来源邮件，且对 hired/offer_declined 这类终态不替你决定。但这只是文档描述，**我没有验证实现的边界**。

## 结论

**该用**：你打算长期做求职、愿意维护一个 git 仓库当档案、并且主要在看丹麦或技术岗市场——这套流程的强项是「多轮投递之间不丢事实」，以及把投递历史变成可审计的记录。它也适合被拆开借鉴：`posting_guard.py` 和 `verify_layout.py` 是独立于求职场景的通用件。

**别用**：你在国内求职（4 个丹麦 portal 加 LinkedIn 和 freehire，覆盖不到你），或者你不打算装约 5 GB 的 TeX 环境（CV 和求职信都编不出来），或者你只有 Claude 免费额度（这个项目没有免费路径）。另外，如果你只是想给一份简历排版，直接找一个 LaTeX 模板就够了。

**我还不确定的是**：`/apply` 全流程在一个真实岗位上的 token 消耗到底是多少。`apply.md` 里有专门的 token 效率规则——不要重复读文件、把草稿内联进 reviewer 的 prompt、核查清单只跑一次——但作者同时承认，Step 5 的编译与版式迭代会吃掉这些节省。这个数字只有跑过才知道，我没跑。

---

**版本与来源说明：** 本文基于 `MadsLorentzen/ai-job-search` 的 `master` 分支 commit `e16acee`（2026-10-21）与 v1.7.3（2026-10-19）。Star 与 fork 数取自 GitHub API，查询日期 2026-10-21。

**证据边界：** 全程 L0 只读。仓库已克隆到本地并逐文件阅读，**未执行任何一条项目命令**（没有安装依赖、没有运行 portal CLI、没有编译 LaTeX、没有启动 Claude Code）。凡涉及运行时行为的陈述，均来自源码阅读与作者文档，未经实测；文中标注「未验证」的部分即为推断而非观察。文章所有数字（命令行数、测试文件数、正则条数、权限条目数）均可在上述 commit 中按文件路径复核。

**参考来源：** [项目仓库](https://github.com/MadsLorentzen/ai-job-search)、[v1.7.3 release](https://github.com/MadsLorentzen/ai-job-search/releases/tag/v1.7.3)、[SECURITY.md](https://github.com/MadsLorentzen/ai-job-search/blob/master/SECURITY.md)、[AGENTS.md](https://github.com/MadsLorentzen/ai-job-search/blob/master/AGENTS.md)。
