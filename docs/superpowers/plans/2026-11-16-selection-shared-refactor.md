# 共用类型与选择模块整理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 默认由主 agent 顺序实施；未经用户另行选择，不派发实现或审阅子任务。

**Goal:** 统一两端共用类型及 HTML 扫描工具，拆分选择模块中的目标识别和重新定位职责，保持现有编辑行为。

**Architecture:** 沿用 shared、client、node 的现有边界；共用数据及纯扫描工具归入 shared。useSelection 组合无状态的目标识别和有生命周期的重选 composable，保持原调用接口。

**Tech Stack:** 现有 TypeScript、Vue 3、Slidev、Vitest；不新增或升级依赖。

**Spec:** [设计与边界](../specs/2026-11-16-selection-shared-refactor-design.md)，用户已确认并完成本轮实施。

## Global Constraints

- 仅实施检查建议 2、3；useTransformGizmo 保持现状。
- 不改变 Markdown、HTML、元数据数据结构及运行时行为。
- 保留 PropMeta.bind?: boolean；仅统一类型，不修改属性写回算法。
- 保留现有重选保护、等待时间、Observer 生命周期及各路径差异。
- 不新增框架、存储、状态机、请求恢复机制或 Pinia 迁移。
- 优先复用已有检查，不因提取文件而新增测试工程或重复行为测试。
- 实施前确认本方案；执行时按 worktree 技能检查并建立隔离工作位置，避免混入其他分支改动。计划文件应随任务带入工作分支。
- 本计划不授权发布、推送、合并、桌面打包或浏览器自动交互。

## Review Focus

- 元数据统一：保留全部字段与现有导出名称；目录数据不包含客户端 load。用类型检查及既有 catalog/deck/md 测试核对。
- HTML 扫描迁移：嵌套、自闭合、多行标签及原始文本范围不变。复用 html-scan、html、multiselect 用例。
- 命中与事件分离：当前页、背景、Monaco、覆盖层及不可见对象规则不变；先核对既有 pointer-interaction/background 覆盖，只有关键缺口才在原文件补用例。
- 异步重选：源码行偏移后仍绑定同一对象，较早重选不能覆盖用户的新选择。复用 pointer-interaction 已有行为用例。
- 生命周期与多选：Observer 释放和多选定位保护随所属代码一起移动；复用既有 effectScope 清理与多选用例，并审查卸载和关闭路径，不新增恢复流程。

## Task 1：统一共用类型和 HTML 扫描

**Files:**
- Create: shared/catalog.ts
- Move: node/html-scan.ts → shared/html-scan.ts
- Modify: client/types.ts、node/metadata.ts、node/catalog.ts、node/markdown-source.ts、client/md/batch.ts、test/html-scan.test.ts
- Existing checks: test/catalog.test.ts、test/deck.test.ts、test/md.test.ts、test/html-scan.test.ts、test/html.test.ts、test/multiselect.test.ts

**Interfaces:**
- shared/catalog.ts 定义唯一的 PropOption、PropControl、PropField、PropMeta、ComponentSource、ComponentEntry、LayoutEntry、Catalog；保留现有字段及注释含义。
- node/metadata.ts、node/catalog.ts 保留原类型导出名称，指向 shared 声明。
- client/types.ts 转导出 Prop*，CatalogComponent extends ComponentEntry、CatalogLayout extends LayoutEntry，分别只扩展既有可选 load。
- shared/html-scan.ts 保留 scanTags(html: string): ScannedTag[] 的完整实现与导出。

- [x] 将 Node 侧完整 PropMeta 及目录数据类型移至 shared/catalog.ts，删除重复声明，更新两端类型依赖；不增加运行时导入。
- [x] 原样迁移 html-scan，实现、使用方及直接测试同步改路径；删除旧实现文件，不保留重复扫描器。
- [x] 运行 pnpm typecheck 和 pnpm exec vitest run test/catalog.test.ts test/deck.test.ts test/md.test.ts test/html-scan.test.ts test/html.test.ts test/multiselect.test.ts。要求全部选定检查通过，已有行为断言不削弱。

## Task 2：提取目标识别

**Files:**
- Create: client/selection-target.ts
- Modify: client/composables/useSelection.ts、client/ui/panels/PanelLayers.vue
- Existing checks: test/pointer-interaction.test.ts、test/background.test.ts、test/layers.test.ts

**Interfaces:**
- describeTarget(el: HTMLElement, no: number, content: string): StudioTarget
- isMultiSelectable(target: StudioTarget, content: string): boolean
- parseHint(raw: string | undefined): SourceRange | null
- sameRange(a: SourceRange | null, b: SourceRange | null): boolean
- isVisible(el: Element): boolean
- isStudioChrome(target: EventTarget | null): target is Element
- createTargetResolver(no: () => number, content: () => string) 返回 targetFrom(node): StudioTarget | null、targetFromPoint(x, y): StudioTarget | null、throughChrome(x, y): StudioTarget | null；node 类型为 EventTarget | null，坐标为 number。
- 该文件不依赖 state/context/actions/useSelection，不注册事件和 watch。

- [x] 移动 describe/textOf/labelFor、范围辅助函数、多选资格和命中查找；内部辅助函数只在确有调用时导出。
- [x] useSelection 调用 createTargetResolver，保留选择写入及全部事件；保留旧 describeTarget/isMultiSelectable 导出的类型和行为，以转导出连接新实现。
- [x] PanelLayers 直接导入 client/selection-target，避免为了描述对象而依赖事件组织模块。
- [x] 对照原实现核对命中规则，运行 pnpm exec vitest run test/pointer-interaction.test.ts test/background.test.ts test/layers.test.ts。关键缺口仅在现有测试文件补充真实可观察行为断言。

## Task 3：提取重新定位并完成整体验证

**Files:**
- Create: client/composables/useSelectionRebind.ts
- Modify: client/composables/useSelection.ts、docs/development.md
- Existing checks: test/pointer-interaction.test.ts、test/multiselect.test.ts、test/object-clipboard.test.ts、test/interaction-inline-editor.test.ts

**Interfaces:**
- useSelectionRebind(no: () => number, content: () => string) 返回下列既有方法，参数及返回类型不变：
  - reselect(hint: SourceRange | null, kind: TargetKind, tag?: string): Promise<void>
  - selectInserted(tag?: string, range?: SourceRange): Promise<boolean>
  - selectInsertedMany(items: { range: SourceRange, tag?: string }[]): Promise<boolean>
  - reselectTargets(targets: StudioTarget[]): Promise<boolean>
- 依赖 selection-target 提供的识别函数及现有 state；拥有 Observer 和 rebinding 局部变量，不引用 useSelection，不添加新的取消或恢复机制。
- useSelection 原参数及返回方法不变，组合并返回以上方法；框选清理保留在 useSelection 的 scope 中。

- [x] 原样移动重选、新插入定位、Observer/watchEffect 及其释放逻辑，保留全部等待和守卫；useSelection 负责组合并保留自身选择事件。
- [x] 核对 useSelection 返回接口与 StudioRoot、剪贴板及文字工具调用匹配，更新开发文档的职责表。
- [x] 先运行受影响用例：pnpm exec vitest run test/pointer-interaction.test.ts test/multiselect.test.ts test/object-clipboard.test.ts test/interaction-inline-editor.test.ts。
- [x] 完整改动集中运行 pnpm test、pnpm typecheck、pnpm exec slidev build playground/slides.md --out /tmp/studio-selection-shared-build、git diff --check。期望测试与类型检查通过、静态构建退出 0；可选 HTTP QA 未启用时保持跳过。
- [x] 检查 git diff 和 client 中所有 node/ 导入、重复 Prop* 定义及文件依赖；确认 shared 无浏览器/Node/Vue 运行时依赖，识别和重选模块不循环引用 useSelection。
- [x] 记录实际修改、验证结果与未验证项。相关检查通过后结束，不追加无关验证或功能；未经另行授权不发布、推送或合并。

## 计划自查

两项任务范围均已映射到具体文件和现有检查；Task 2 导出是 Task 3 的唯一识别依赖。保留原有调用接口及类型转导出，避免无关调用方迁移。所有新文件都承接已存在逻辑；本计划不包含新的交互机制或新增永久测试的配额。


## 实施结果，2026-11-16

- 工作树：`/data/sunyunbo/www/better-ppt/.worktrees/studio-selection-shared`；分支 `codex/studio-selection-shared`，基线 `a81161b`。原生 worktree 工具未识别嵌套仓库，按技能后备方式使用既有同级 `.worktrees` 目录。
- 共用 Prop* 和组件目录数据类型统一至 `shared/catalog.ts`，保留 `bind` 与旧类型导出名称；客户端仍独立扩展 `load`。HTML 扫描器原样移入 `shared/html-scan.ts`。
- 目标识别归入 `client/selection-target.ts`，重新定位及 Observer 归入 `useSelectionRebind.ts`。`useSelection.ts` 从 670 行减为 297 行，外部调用接口保留；PanelLayers 直接使用目标识别模块。
- Task 1：选定 6 文件 128 项测试和类型检查通过；Task 2：选定 3 文件 28 项测试通过。
- Task 3 初次回归发现框选遗漏 `sameRange` 导入，已有框选测试明确失败；补回该导入后，选定 4 文件 30 项测试通过。未修改或削弱原有行为断言。
- 集中验证：`pnpm test` 345 通过，1 项需 `STUDIO_QA_URL` 的可选 HTTP QA 跳过；`pnpm typecheck` 通过；`pnpm exec slidev build playground/slides.md --out /tmp/studio-selection-shared-build` 通过；`git diff --check` 通过。
- 主 agent 完成单独自查：迁移函数体与 Observer 回调对照、扫描器逐字对照、共用类型唯一声明、依赖方向、原调用接口、清理路径均已核对。按已确认计划没有委派独立审阅，也没有新增永久测试。
- 日志：`/tmp/studio-selection-shared-tests.log`、`/tmp/studio-selection-shared-build.log`。未进行浏览器交互、Windows 实机或其他 Slidev 版本验证；用户随后授权提交、推送并合并，集成状态以 Git 记录为准；未发布 npm 或打包桌面版本。
