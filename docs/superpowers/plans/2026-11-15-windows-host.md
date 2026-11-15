# Windows Desktop Host Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. 用户已选择 Windows Electron 路线并要求计划后继续实施。

**Goal:** 交付 Windows x64 桌面 ZIP，提供本地工程新建、打开、另存、关闭，并复用 Studio。

**Architecture:** 独立 desktop 包，项目文件操作、运行器和 Electron 主进程分别维护；插件通过有限宿主桥调用原生操作，保存仍走已有 Studio 路径。

**Tech Stack:** Electron 45.3.2、Electron Forge 8.0.1 ZIP maker、内置 Node、pnpm JS 10.33.0、既有 JSZip 3.10.1。普通 CJS/HTML/CSS，不新增打包器。

**Spec:** `docs/superpowers/specs/2026-11-15-windows-host-design.md`

## Global Constraints

- 仅 Windows x64 ZIP；不带第二份 Node，不接入网站、自动更新或发布系统。
- 标准目录工程；保留现有依赖版本，启用/升级 addon 或转换依赖准备方式须在 App 中明确提示。
- 单个当前工程，人工重试；不新增队列、数据库或恢复系统。
- 保留上一阶段未提交改动和用户文稿；不自动提交/推送/发布。
- UI 验证只导航/截图，不自动点击、输入或交互流程。

## Review Focus

- 随附 addon 来自当前源码，版本相同也不能误把旧 npm 包当作当前能力。
- 另存从实际工程 ZIP 复用既有排除规则，保留文件字节，不能覆盖源工程。
- 所有切换、菜单动作及窗口关闭先保存，失败不退出。
- Windows node 命令桥指向本 App，不依赖系统 Node；安装环境变量不污染普通窗口启动。
- Windows ZIP 包含可执行文件、pnpm JS 和 addon/template，无独立 node.exe；Linux 探针不冒称 Windows 验收。

### Task 1: 桌面工程与运行器

**Files:** `desktop/projects.cjs`, `desktop/runtime.cjs`, `desktop/template/*`, `test/desktop-projects.test.ts`, `test/desktop-runtime.test.ts`。

**Interfaces:** `inspectProject(entry)`, `createProject(directory, resources)`, `enableStudio(project, resources)`, `saveProjectCopy(archive, destination, sourceRoot)`；`createRuntime({ executable, pnpm, userData, onStatus })` 返回 `install/start/stop`。

- [x] 添加真实文件测试：标准模板、启用 addon 保留字段、ZIP 副本非覆盖及路径校验、Node 桥。
- [x] 实现最小项目操作；复用工程 ZIP 进行另存。
- [x] 实现内置 Node 环境、依赖安装日志与单个 Slidev 进程启停，绑定 loopback。
- [x] 运行新增测试及真实运行器探针。

### Task 2: 桌面壳与插件接入

**Files:** `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/welcome.html`, `desktop/welcome.css`, `desktop/welcome.js`, `client/project-host.ts`, `client/ui/StudioFile.vue`, `client/ui/StudioRoot.vue`, `client/i18n/*`。

**Interfaces:** 只暴露 `window.studioDesktop.perform(action)` 固定动作和欢迎页状态消息；Studio 提供 `window.__studioProject.save()`，由主进程在离开前调用。

- [x] 实现原生对话框、菜单、准备进度/日志、保存后切换/关闭。
- [x] 复用现有深色工作台样式制作最小欢迎页；按 frontend-design 技能处理层次和文案，不重设计编辑器。
- [x] 插件在有宿主时显示新建、打开、另存、关闭；保存失败不调用后续动作。
- [x] 普通网页模式不暴露失效桌面按钮。

### Task 3: Windows ZIP 打包

**Files:** `desktop/package.json`, `desktop/pnpm-lock.yaml`, `desktop/pnpm-workspace.yaml`, `desktop/forge.config.cjs`, `desktop/scripts/prepare.cjs`, 根 package scripts/ignore。

- [x] 独立安装桌面工具，hoisted 配置仅作用于 desktop 包。
- [x] 从当前根源码打包 addon，准备随附模板及 pnpm JS。
- [x] 配置 Forge ZIP maker，保留 runAsNode，生成 Windows x64 ZIP。
- [x] 检查包内容、进程路径、资源与没有第二份 Node。

### Task 4: 验证与交付说明

- [x] 集中运行根测试、TS、Vue SFC 检查、相关静态构建和 CJS 语法检查。
- [x] 完成内置 Node 实际运行/保存/归档探针，记录适用平台。
- [x] 一次只读代码审阅，按实际核心影响修正。
- [x] 更新计划、使用说明、阶段状态，提供 Windows ZIP 路径及明确的未验证项。

## 执行记录

- 用户选择 Windows Electron + 内置 Node + Forge ZIP 后直接实施，保留上一阶段未提交改动。
- desktop 包独立 workspace 配置解决父目录 pnpm 配置接管问题；PNPM 11 的 hoisted 配置写入 desktop/pnpm-workspace.yaml，不使用已不生效的 .npmrc 设置。
- 新模板固定 Markdown-it 14.3.0，修复全新依赖解析到 15 导致 CLI 无法启动的实测问题。该问题在普通 Node 下也复现，确认不是 Electron 内置 Node 限制。
- 随附 addon 工程每次打开执行复用缓存的普通安装；取消启用/锁文件转换前不改已有工程，避免另建恢复状态或静默使用旧 addon。
- 最终根测试 230 通过/1 既有 QA 跳过，TS、Vue SFC、JS/CJS 语法、静态构建通过。实际内置 Node 安装/启动/保存/另存及组件编译探针通过；一次只读审阅无核心发现。
- Windows ZIP 已生成并核对当前源码与资源，没有第二份 node.exe。交付路径及 SHA 在 docs/status.md；Windows 原生运行和交互明确未验证。
- 没有自动浏览器交互、网站改造、Git 提交/推送、npm 发布或上线操作。
