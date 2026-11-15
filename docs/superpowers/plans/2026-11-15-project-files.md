# Studio Project Files Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User explicitly requested planning followed by execution in this session.

**Goal:** 为当前 Studio 增加项目“文件”页、可靠的显式保存入口和工程 ZIP 下载。

**Architecture:** 延续 addon 的 Node Vite middleware 与 Vue 客户端分工。工程读取/归档放在 `node/project.ts`，保存状态沿用当前写回链路，文件页只调用当前工程 API。宿主项目管理维持既定边界。

**Tech Stack:** Vue 3、TypeScript、现有 Slidev/Vite API、JSZip 3.10.1（依赖树已有）。

**Spec:** `docs/superpowers/specs/2026-11-15-project-files-design.md`

## Global Constraints

- 标准目录工程，自动写回，不改变现有正文格式。
- 不要求 Git、账号或 project.yaml；不改网站和桌面运行架构。
- 不新增任务队列、恢复机制、通用文件编辑器或额外导出格式。
- 保留中英翻译与 Vite base 路径支持；生产构建不得暴露文件 API。
- 用户授权直接执行计划；不重复请求实施确认。
- 永久测试只覆盖关键行为，UI 不自动点击/输入，最终集中验证。

## Review Focus

- 嵌套入口取最近 package.json，而非 monorepo 全部内容。
- 新增、未提交及中文/二进制文件能从真实 ZIP 中还原；凭据和缓存不被打包。
- 链接或工程外幻灯片不静默缺失，错误包含可处理的路径。
- Ctrl+S、文件页与备注的未应用内容进入现有写入链路；失败不能显示已保存或启动下载。
- base 路径的 API/下载保持工作，静态构建不带文件接口。

### Task 1: 工程信息与 ZIP

**Files:** Create `shared/project.ts`, `node/project.ts`, `test/project.test.ts`; modify `node/plugin.ts`, `shared/errors.ts`, `client/i18n/errors.ts`, `package.json`, `pnpm-lock.yaml`。

**Interfaces:** `ProjectInfo` 包含 `name/root/entry/files`；`readProject(options): Promise<ProjectInfo>`；`exportProject(options): Promise<{ filename: string, data: Buffer }>`。`GET @studio/project` 返回信息，`GET @studio/project.zip` 返回下载。

- [x] 用真实临时工程写根目录识别、归档内容/排除、链接及外部源码行为测试；先运行观察缺失实现。
- [x] 实现工程遍历及 ZIP，安装已有版本的直接 JSZip 依赖。
- [x] 接入 dev-only middleware，下载带正确 MIME、文件名和 no-store；复用现有错误响应。
- [x] 运行工程测试。

### Task 2: 保存入口与状态

**Files:** Create `client/project-save.ts`, `test/project-save.test.ts`; modify `client/composables/useSlideSource.ts`, `client/composables/useDeckApi.ts`, `client/ui/InlineEditor.vue`, `client/ui/StudioNotes.vue`, `client/ui/StudioRoot.vue`。

**Interfaces:** 简单共享保存状态（成功时间、写入错误、当前写入）与 `saveProject(): Promise<boolean>`。活动文字编辑/备注通过现有组件暴露提交函数；不新增请求队列或重试机制。

- [x] 添加实际保存逻辑的关键行为测试：等待实际写入、应用草稿、失败不成功。
- [x] 使 Slidev 写回检查真实响应错误，记录状态，并供显式保存等待当前写入。
- [x] 接入文字/备注提交和 Ctrl/Cmd+S。后台请求失败保留可见状态。
- [x] 运行保存测试及受影响的已有编辑测试。

### Task 3: “文件”页与工程下载

**Files:** Create `client/composables/useProject.ts`, `client/ui/StudioFile.vue`, `client/ui/parts/ProjectTree.vue`; modify `client/state.ts`, `client/ui/StudioToolbar.vue`, `client/ui/StudioRoot.vue`, `client/ui/parts/StudioIcon.vue`, `styles/studio.css`, `client/i18n/en.ts`, `client/i18n/zh-CN.ts`。

**Interfaces:** 文件页用 `readProject` API 获取当前工程、用 `saveProject` 应用编辑，再获取 ZIP blob 下载；所有路径基于 `import.meta.env.BASE_URL`。

- [x] 实现项目概览、目录树、保存/下载和宿主边界说明；“文件”放在工具栏最前。
- [x] 文件页显示时遮蔽画布并拦截画布快捷键；返回保留当前页。
- [x] 文件页及状态栏显示真实保存状态，下载失败不生成空 ZIP。
- [x] 补齐中英文自然文案、图标、窄窗口样式。

### Task 4: 验证和说明

**Files:** Modify `README.md`, `docs/development.md`, `docs/usage.zh-CN.md`, `docs/status.md`, `docs/limitations.md` as relevant。

- [x] 集中运行 `pnpm test`、`pnpm typecheck` 和 `pnpm exec slidev build playground/slides.md --out <temporary-dir>`。
- [x] 临时工程验证根路径和挂载路径的信息/ZIP 下载；读取 ZIP 确认最新磁盘正文；不修改用户稿件。
- [x] 自查 diff；必要时仅委派一次只读审阅，按真实影响处理核心问题。
- [x] 更新文档与计划勾选，报告命令结果及没有验证的原生交互/Windows 打包。

## 执行记录

已按用户授权在当前功能分支实施，无额外项目架构变更。JSZip 使用依赖树已有版本，锁文件只增加直接依赖声明。全量测试 225 通过/1 既有跳过，审阅后的相关测试 24 通过；TS、Vue SFC、静态构建和根/挂载路径真实 HTTP ZIP 探针通过。一次只读审阅的两项核心问题已修正；最终细节与未验证项见 `docs/status.md` 的工程与文件页记录。未进行浏览器自动交互、Windows 打包、Git 提交/推送或 npm 发布。
