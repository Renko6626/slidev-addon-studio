# 组件可编辑字段 Implementation Plan

> 本记录对应字段约定阶段。用户随后已确认标准模板字段化及不迁移历史数据；后续结果见[模板实施记录](2026-11-16-question-field-templates.md)，下文当时的后续限制已解除。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 按用户约束优先复用已有检查；本计划默认主 agent 实施，不自动委派。

**Goal:** 作者用 studio YAML 声明可编辑字段，Studio 复用现有三条编辑路径和素材工具，真实图文选项验证字段与答题 action 的组合。

**Architecture:** 元数据、源码字段写回、DOM 字段定位分别承担有限职责；Vue props 是内容唯一来源，runtime 仍只处理业务。不给内部字段创建独立画布对象，不建设通用脚本/事件框架。

**Tech Stack:** 现有 Vue 3、TypeScript、Slidev、Tiptap、Pinia、YAML、Vitest；不增加依赖。

**Spec:** [组件字段设计](../specs/2026-11-16-component-fields-design.md)。用户已确认，本轮实现完成。

## Global Constraints

- 先整合 codex/studio-authored-snippets 和 codex/studio-text-paths 已实现内容至任务分支；不得以 main 当前旧文字编辑器为基线重复建设。
- 只实现字段约定与真实图文选项示例，现有题目整体迁移另行确认。
- 新组件 `propsMode: declared`，现有无声明组件沿用原推断；hidden 仅影响组件库可见性。
- 不执行表达式、不改 .vue 实现文件、不在渲染 DOM 中反推原始字段值。
- 保留原坐标、slot、静态播放、模式隔离、答题判定及重置行为。
- 不新增永久对象 ID、事件总线、状态机、队列或请求恢复流程。
- 本轮不发布、不修改部署，不自动执行浏览器交互。

## Review Focus

- 隐藏组件拥有字段描述，但不出现在组件库；UI 两处读取同一声明。
- 空字符串与默认值不同；HTML 实体/JSON/属性转义顺序正确，未知表达式不会被覆盖。
- 双击字段不能把组件内部节点升级为独立可移动对象，也不能越过嵌套组件边界。
- 字段编辑取消后恢复 DOM，未改不写；富文本切源码保留整个字符串及原组件写回范围。
- 图文选项在编辑/缩略图不作答，运行时点击/键盘使用已有 action，图片替换只改字段。

## Task 1：编辑字段声明与目录

Files: shared/catalog.ts、node/metadata.ts、node/catalog.ts、client/composables/useCatalog.ts、client/ui/panels/PanelComponents.vue；复用 test/catalog.test.ts、test/deck.test.ts。

Interfaces:
- `StudioMeta.propsMode?: 'declared'`。
- `PropControl` 增加 `richtext | image`；`ComponentEntry.hidden?: boolean`，目录仍包含可定位隐藏组件。
- declared 模式输出的可编辑 props 为作者白名单；推断信息可以用于默认 snippet，但不能自动变为可编辑字段。

- [x] 在已有目录测试建立真实 SFC fixture，断言 declared 未列出的内部字段不暴露，显式字段保留标签/control，hidden 组件有元数据但库过滤不可见。
- [x] 实现声明解析与可见性分离，保留作者 snippet/preview，不重复实现前置修复。
- [x] 运行受影响目录用例和类型检查；确认现有无 propsMode 组件行为保持。

## Task 2：源码 string 字段读取和写回

Files: 新增 client/md/component-fields.ts；复用 client/md/tags.ts、literals.ts；扩展 test/md.test.ts 的 props 场景。

Interfaces:
- `readComponentString(content: string, range: SourceRange, prop: PropMeta)` 返回 `{ editable: true, value: string, explicit: boolean }` 或 `{ editable: false, reason: 'dynamic' | 'unknown-default' | 'ambiguous' }`。
- `writeComponentString(content: string, range: SourceRange, prop: PropMeta, value: string): string`：重复检查可编辑性，拒绝时保持原内容，由上层显示原因。
- 新值以字符串字面量绑定保存；只修改目标开标签对应属性，复用 sameAttr 处理命名差异。

- [x] 用真实组件标签覆盖引号/&/实体/换行/中文、空值/默认值及动态表达式；断言独立预期字符串和值，以及邻居、slot、位置未变。
- [x] 实现有限字符串读取及编码；不复用 writeProp 的内容推断，不 eval，不增加通用解析器。
- [x] 运行现有 props/源码用例；仅在此层覆盖编码细节，不在 UI 复制组合。

## Task 3：画布字段定位与三条编辑路径接入

Files: 新增 client/component-fields.ts；修改 client/types.ts、selection-target.ts、composables/useSelection.ts、useTextEditor.ts、ui/InlineEditor.vue、ui/panels/PanelInspect.vue、ui/parts/PropField.vue、state/context 中必要的现有编辑入口；复用 test/pointer-interaction.test.ts、rich-text.test.ts、interaction-inline-editor.test.ts。

Interfaces:
- `ComponentFieldTarget` 含 owner: StudioTarget、prop: PropMeta、element: HTMLElement；owner.range 为组件源码范围，element 为编辑区域。描述是单次编辑目标，不形成新持久对象模型。
- `resolveComponentField(owner, node, component)` 返回目标或 null；仅接受最近 data-studio-component 根所属组件已声明、唯一且形状符合 richtext/image 要求的字段；最近根不能匹配源码时返回 null，不向外猜测。
- useTextEditor 增加接收明确字段来源的入口，DOM 挂载在 field.element、保存通过 writeComponentString(owner.range)。通用 createTextEditor/格式命令/历史复用；不能复制第二份富文本控制器。

- [x] 补充整体选择/字段双击和取消行为用例，明确最近组件边界与字段入口行为。
- [x] 接入 richtext 字段的面板入口和画布入口；组件选区始终属于 owner；F2 有歧义时转字段面板。
- [x] 新字段统一检查静态性；源码编辑展示字段原始字符串并正确写回 prop，整组件源码入口仍展示完整标签。
- [x] 动态值/无法定位/不支持富文本语法时提供明确原因和源码入口，不丢弃输入、不根据渲染结果生成作者源码。
- [x] 用已有真实组件加载辅助工具验证字段单次提交、取消与未改不写；受影响用例通过后不追加无关流程。

## Task 4：图片字段、图文选项与交付

Files: client/composables/useImageInsertion.ts、client/ui/parts/PropField.vue、PanelAssets.vue（必要分发）、i18n/en.ts 与 zh-CN.ts；新增 playground/components/EditableOptionCard.vue、playground/component-fields.md；更新 docs/custom-code/components.md、docs/components.md、docs/development.md。

Interfaces:
- 现有 ImageRequest 增加字段替换目标 `{ range, source, prop }`，沿用既有 no/目标源码检查、文件上传与库选择。
- 图片字段写回 writeComponentString，保留组件尺寸/其他字段，不调用 createImageElement 生成独立图片。
- EditableOptionCard props：question、option、contentHtml、imageSrc、imageAlt；显式暴露后 3 个。通过 runtime 公共入口读取/发送已有题目信号，不访问 client store。

- [x] 复用图片测试夹具，覆盖取消不改写、替换只修改所属组件字段，确认普通图片和背景原路径保持。
- [x] 交付包含普通文本框题干、单选/多选控制器、图文选项及提交/清空的示例；模板与选项均可正常预览，状态不污染主运行时。
- [x] 用真实组件用例验证运行时作答和选中/正确/错误外观，编辑与预览禁用业务动作；键盘激活与可访问名称可观察。
- [x] 更新组件规范：完整声明示例、默认值与动态值限制、DOM 所有权、图片空值与资源路径处理、业务 action 绑定约定。
- [x] 集中运行 `pnpm test`、`pnpm typecheck`、`pnpm exec slidev build playground/component-fields.md --out /tmp/studio-component-fields-build`、`git diff --check`，开发服务编译受改动 SFC；报告未做浏览器/Windows 验证。

## 后续题目迁移决策，不包含在本轮实施

下一阶段再确定标准 StudioButton 是否直接改为字段化组件、题干对象关联标记、反馈文案归属、QuizOption 去 label、旧稿迁移方式及复制重映射。先形成明确的迁移样例和受影响文件清单，再请求确认；不要为未来保留一套未经批准的兼容系统。


## 实施与验证，2026-11-16

工作区：`/data/sunyunbo/www/better-ppt/.worktrees/studio-component-fields`，分支 `codex/studio-component-fields`。以 ec7f26d 为基线，整合 authored-snippets 与 text-paths 工作树的已实现改动；原工作树未修改。实施记录时尚未提交；本阶段随后由用户要求提交、推送并合并至 main。

完成 declared 白名单、隐藏组件元数据保留、静态字符串源码写回、字段归属、富文本/源码字段会话、图片文件与库替换、实际图文选项和单选/多选示例。为识别真正的静态默认值，在 PropMeta 中保留 defaultLiteral 原始默认表达式；已有 default 显示值保持兼容。目录加载器只为可见预览组件生成加载函数。

测试使用现有 fixtures/SFC 加载辅助工具，覆盖作者片段保留、字段声明、字符串层次编码、动态值禁写、取消与源码切换、嵌套字段边界、图片字段替换/取消，以及新选项组件单选/多选、正确/错误外观、编辑/预览隔离。未建立第二套测试环境或脚本执行框架。

- `pnpm test`：362 通过，1 项可选 HTTP QA 跳过。
- `pnpm typecheck`：通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`：通过；工具临时运行，未添加依赖。首次运行指出 InlineEditor 闭包中 target 的空值类型，已修正。
- 最后一次局部检查 `pnpm exec vitest run test/quiz-components.test.ts test/interaction-inline-editor.test.ts`：20 通过，包含上述小修正和加强后的预览/错误外观断言。
- `pnpm exec slidev build playground/component-fields.md --base /studio-fields/ --out /tmp/studio-component-fields-build`：通过。
- 开发服务 HTTP 编译 InlineEditor、PanelInspect、PropField、EditableOptionCard 与 useCatalog 均返回 200；实际 `/@studio/catalog` 输出仅暴露示例的三个声明字段，并保留隐藏题目控件描述。
- `git diff --check`：通过。完成主 agent 自查，没有委派或重复全量复审。

日志在 `/tmp/studio-component-fields-tests.log`、`/tmp/studio-component-fields-build.log`、`/tmp/studio-component-fields-dev.log`。没有浏览器自动点击/输入/拖动、原生文件选择、Windows 或发布验证。

已知范围：新增图文选项的 question/option 由源码绑定；标准题目模板仍沿用当前配置。复制整个题目时，自定义组件绑定尚未纳入题目 ID 重映射，已在组件规范说明，留给已划定的后续题目迁移阶段。
