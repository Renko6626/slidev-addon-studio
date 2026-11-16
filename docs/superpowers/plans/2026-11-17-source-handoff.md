# 源码交接与桌面管理实施计划

**Goal:** 让外部 agent 能准确定位源码，并在文稿编译失败时保留独立管理入口。

**Spec:** ../specs/2026-11-17-source-handoff-design.md（路线已获用户确认）。

**Architecture:** 现有 Vue 侧栏读取 Slidev info/catalog/project API；桌面原生命令调用现有工程打开、日志和目录操作。没有任意文件写入、新依赖、任务队列或自动恢复。

## 执行任务

- [x] 源码交接：`client/source-context.ts` 组织原始页源码及 agent 上下文，`PanelSource.vue` 提供只读查看和复制；Dock/Toolbar 增加入口。使用真实 parser 结果验证导入页位置和原始内容，并验证组件路径、制作约束及脚本列表。
- [x] 独立管理：`desktop/project-management.cjs` 处理原生命令与确认，main 安装菜单/快捷键并复用 openPrepared/showWelcome；使用临时真实日志和文件，验证复制诊断、取消保持原状、确认后可绕过不可用页面保存入口。
- [x] 局部错误：组件预览捕获子组件错误，复用 runtime-context SFC 夹具验证其他对象仍可渲染；正常编辑上下文记录最近 Vite 编译诊断。
- [x] 更新文档，集中运行相关已有测试、TypeScript/Vue 检查、JS 语法、构建及必要截图。进行一次限定范围审阅后记录结果。

## 约束与检查重点

源代码仅查看，不承诺自动找全脚本依赖。项目和依赖组件来源区分清楚。未知定位不猜行号。旧桌面宿主的正常编辑仍可运行。恢复操作必须显式确认，且不得调用损坏的 renderer 保存钩子；取消不关闭或覆盖文件。浏览器不自动点击、填写或运行流程测试。Windows 原生菜单与对话框最终需人工验收。

## 验证记录

- `node_modules/.bin/vitest run test/source-context.test.ts test/desktop-management.test.ts test/runtime-context.test.ts test/desktop-runtime.test.ts test/project-save.test.ts test/i18n.test.ts`：6 文件共 22 项通过。新增核心行为先失败后实现；源码测试的初始行预期纠正为原始第 3 行 frontmatter 分隔符，按字面输入核对。
- `node_modules/.bin/tsc --noEmit` 通过；Vue 检查使用缓存 vue-tsc 3.1.5 并显式调用工程 TypeScript 5.9.3 的 tsc：`require('/data/sunyunbo/.npm/_npx/c84f07d5af870f7e/node_modules/vue-tsc').run(require.resolve('typescript/lib/tsc.js'))`，通过。发现的重复图标键已移除，复用既有 code 图标。
- `node --check desktop/main.cjs`、`node --check desktop/project-management.cjs`、`node --check desktop/preload.cjs` 与 `git diff --check` 通过。
- `node_modules/.bin/slidev build playground/slides.md --base /source-check/ --out /tmp/studio-source-handoff-build` 通过。实际 dev 页另行检查编辑 UI。
- 1280/800px 截图：`/tmp/studio-source-handoff-{desktop,compact}.png`。仅导航和初始化当前页/选中组件/侧栏状态；检查到当前页为 `playground/slides.md:16`、选中定义为 `playground/components/Badge.vue`，两个源码文本框均 readonly。未自动点击、填写或执行剪贴板/恢复流程。无头浏览器仍报告既有 Wake Lock 权限拒绝。
- 新宿主通过可选布尔能力 `nativeProjectManagement` 控制文件页管理提示，旧宿主不显示其不支持的快捷键说明。没有新增任意文件 API、编辑器、依赖或服务。
- 一次限定范围独立只读审阅，无阻塞发现。
- 未验证：Windows 原生菜单、Alt/Ctrl+Shift+M、原生确认框、真实错误工程的宿主恢复、系统剪贴板和外部 agent 启动。本轮不承诺完整 Studio 的错误隔离，也未打包、发布或合并 main。

## 后续文案及复制内容修订

用户指出“源码与 agent”把制作建议写成了产品入口，已确认统一为“源码”。按钮使用“复制本页源码”“复制源码位置”“复制页面信息”；原生菜单使用“复制工程诊断”。页面信息及工程诊断只附带位置、源码、选中对象、错误和日志，不自动附加任务指令、技能路径或制作约束。文件页移除 agent 引导段落，打开目录及独立管理提示保留；外部工具用法留在帮助文档。上文关于 agent 专用复制内容的描述仅记录原实现，当前行为以本节为准。

已有源码与诊断用例改为断言完整的中性复制结果，保留所有位置、错误及原始源码覆盖；先观察旧输出失败，再修改生产逻辑。`node_modules/.bin/vitest run test/source-context.test.ts test/desktop-management.test.ts test/i18n.test.ts`：8 项通过。`node_modules/.bin/tsc --noEmit`、上述 Vue SFC 检查、`node --check desktop/main.cjs`、`node --check desktop/project-management.cjs` 与 `git diff --check` 均通过。未新增永久测试或重复全量检查。

修订后的宽窄屏截图为 `/tmp/studio-source-neutral-{desktop,compact}.png`，入口显示“源码”，复制按钮正常排列。仅导航及初始化状态，没有自动点击、填写、剪贴板或 Windows 原生流程测试；系统剪贴板和 Windows 菜单仍待人工验收。
