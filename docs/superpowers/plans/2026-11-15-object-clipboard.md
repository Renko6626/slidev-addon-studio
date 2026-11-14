# 对象复制粘贴实施计划

> **For agentic workers:** Use superpowers:executing-plans. 用户已确认以下功能并要求阶段性提交之后直接实施。

**Goal:** 当前文稿中的完整对象可以通过 Ctrl/Cmd+C、V 跨页复制粘贴；直接创建副本会错位并选中新对象。

**Architecture:** 在现有编辑器中监听原生 copy/paste 事件。剪贴板同时携带普通 Markdown 文本和 Studio 专用数据（版本、文稿入口、源页、源码、相对选择范围及原标签），无需异步剪贴板权限或后端。复制内容在系统剪贴板中，因此新建页面触发刷新后仍能读取；不建立持久剪贴板数据库或操作恢复队列。

**Tech Stack:** 现有 Vue/TypeScript、ClipboardEvent、Markdown 写回和 Vitest，不新增依赖。

## 范围与约束

- 阶段性提交已完成：`ad6b5f1`，保存用户试用中的 playground 修改；不回退这些改动。
- 支持完整文本框、图片、组件和顶层 Markdown 块，保持源码格式、素材路径与动画标记。暂不单独复制嵌套子节点、frontmatter 文字或剪切对象。
- 使用当前 origin 和 Vite base 标识文稿入口；只接收同入口的 Studio 剪贴板数据，普通外部文本不会被当作对象插入。
- 本次不新增异步剪贴板按钮：Ctrl/Cmd+C、V 使用原生事件，现有立即复制按钮改为“创建副本”，快捷键仍为 Ctrl/Cmd+D。
- 同页粘贴与创建副本在自由定位坐标上偏移 20 单位；跨页第一次粘贴保留原坐标，连续粘贴继续错开。普通文档流块保留文档流。
- 输入框、下拉框和 contenteditable，以及文字编辑状态，保留原生文本剪贴板行为；关闭 Studio 后不拦截。
- 写回后按准确源码范围选中新对象；包含 v-drag 包装器时复制完整包装器，选择其内部可映射的对象。图片文件继续共享现有引用。
- 验证限于相关单元检查、类型检查和必要编译。不做自动浏览器键盘、点击或粘贴验收。

## Tasks

- [x] `client/md/clipboard.ts`：源码快照、格式编解码、错位插入及选择范围；把已需共用的 `positionedUnit` 放到 `md/drag.ts`。测试图片属性保留、包装器完整、跨页坐标、重复偏移和普通文档流插入。
- [x] `client/composables/useObjectClipboard.ts`：挂接原生事件，限定文稿与输入焦点，复用现有 commit/history/selectInserted；`StudioRoot.vue` 初始化。
- [x] `actions.ts`：直接创建副本复用相同插入逻辑并选中新对象；保留现有列表项复制语义，键盘入口遵守已有可复制边界。
- [x] 中英文文案和 README：清楚区分“复制到剪贴板”和“创建副本”，注明快捷键、源文件引用和首版边界。
- [x] 集中运行 `pnpm test`、`pnpm typecheck`、Vue SFC 类型检查及必要构建，一次只读审阅后交付独立功能提交。

## Review focus

完整对象的源码边界、包装器的相对选择范围、粘贴时不要求当前已选中对象、输入态不被拦截、重复粘贴坐标、当前入口与外部剪贴板区分。

## 来源

浏览器原生事件读写采用 [MDN copy event](https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event) 和 [paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) 的 ClipboardEvent 数据传递方式。单元测试只能验证处理逻辑，不能代替真实系统剪贴板试用。


## 完成记录

- 阶段性提交：`ad6b5f1`，保存当时全部待提交的 playground 试用修改。
- 功能在其后的独立提交交付，沿用 `codex/studio-workspace`，未发布或合并。
- `pnpm test`：197 通过，1 个依赖 `STUDIO_QA_URL` 的真实服务 QA 跳过。
- `pnpm typecheck`：通过。
- Vue SFC 检查通过：沿用临时 vue-tsc 与项目 TypeScript 5.9.3，命令为 `node -e "require('/data/sunyunbo/.npm/_npx/d98b0549d8187273/node_modules/vue-tsc').run(require.resolve('typescript/lib/tsc'))" -- --noEmit`。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-clipboard-build`：通过。
- 事件测试调用生产处理器，验证跨页无选区粘贴、连续偏移、输入态保留和未读取完成的目标页保护。它们不代表真实系统剪贴板验收，未做自动浏览器交互。
- 一次只读审阅发现嵌套 Markdown 子列表未被原有 nested 标记覆盖；回归测试复现后，按顶层对象范围排除。相同修正轮验证并保留原始缩进，以及 Studio 的单对象 v-click/v-clicks 与 v-drag 包装器，已有动画写回规则不变。
- `sourceReady` 只读取既有懒加载状态，未就绪时提示稍后重试，不引入请求队列。单独列表项仍可按原方式创建副本，但不作为跨页剪贴板对象。
- 阶段性提交之后新增的用户 playground 修改保留未提交，不混入剪贴板功能提交。
