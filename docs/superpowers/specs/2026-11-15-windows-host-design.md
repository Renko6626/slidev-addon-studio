# Windows 桌面宿主

用户已选择：Windows 桌面宿主，Electron + 内置 Node + Electron Forge，先交付可解压运行的 ZIP；先计划再实施。

## 目标

在普通本地 Slidev 目录上提供新建、打开、另存、关闭工程，复用当前 Studio 编辑器和保存链路。用户不需要另外安装 Node、pnpm、Docker 或网站服务。首次准备依赖需要网络。

## 路线及取舍

- 采用 Electron 自带 Node，通过 `ELECTRON_RUN_AS_NODE=1` 启动 Slidev 和随包的 pnpm JS，不再携带第二份 Node。
- Tauri + Node sidecar 更轻，但需额外维护 Node 分发和 Rust 宿主；本阶段不采用。
- 使用 Electron Forge 的 Windows ZIP maker，优先完整的可解压目录；安装程序、自动更新、签名和发布服务不在本阶段范围。
- `desktop/` 为独立的小型包，不把根仓库改造成 monorepo，不改网站后端。主进程使用普通 CommonJS 和 Node API，欢迎页使用本地 HTML/CSS，不新增前端框架或构建器。

## 子系统

- `desktop/projects.cjs`：识别工程/入口、创建模板、明确启用随附 addon、从现有工程 ZIP 另存。保持源文件与既有依赖版本，不要求 Git。
- `desktop/runtime.cjs`：内置 Node 命令环境、小型 node 命令桥、pnpm 调用、单个 Slidev 子进程的启停/就绪及日志。无任务队列、自动恢复或多工程并行管理。
- `desktop/main.cjs`：窗口、原生文件对话框、菜单和有限的工程 IPC。任何工程切换或关闭前调用当前 Studio 保存接口；失败时留在工程。
- `desktop/preload.cjs`：仅向界面暴露固定的新建/打开/另存/关闭操作，不提供任意路径读写或命令执行。
- Studio：文件页在发现桌面宿主时显示真实工程操作；浏览器独立使用行为保持原状。暴露一个 dev-only 保存函数供主进程统一执行。

## 项目行为

- 新建：用户选择空目录，写入普通 `package.json`、`slides.md`、`.gitignore` 和 `vendor/slidev-addon-studio.tgz`；CLI/theme/Vue 使用本次已验证基线版本，安装生成锁文件。tarball 随工程保留，解压工程 ZIP 后可以按普通 Slidev 工程安装。
- 打开：选择目录，默认入口为 slides.md；没有默认入口时再选择 Markdown。识别最近 package.json，保留原内容和依赖版本。
- 启用 Studio：若已有工程未使用本次随附的 addon，先显示对话框，允许使用随附版本、保留现有环境或取消；只在用户选择启用时写入 vendor、addon 依赖及 package.json 的 slidev.addons。保留原 CLI/theme/Vue 版本和其他字段。不会静默升级。
- 准备依赖：非托管已有工程保留现有 CLI，存在时直接启动。使用随附 addon 的工程每次打开运行普通 pnpm install 并复用缓存，确保取消安装后再打开不会误用旧 addon；不执行 update、不增加恢复状态。非 pnpm 锁文件工程在需要安装时先提示，用户选择后导入现有锁文件并生成 pnpm 锁，原锁保留。安装失败显示日志位置，允许用户修正后重新打开，不设计自动恢复。
- 另存：先保存当前编辑，调用已有工程 ZIP API，再解压到用户选择的新目录；不覆盖非空目录、不允许另存到当前工程内部。成功后打开副本。
- 关闭/切换：保存失败则中止；成功后停止原 Slidev 进程。关闭工程回到欢迎页，关闭窗口退出 App。旧版 addon 没有保存接口时，明确要求用户先自行保存，并选择继续或取消。
- 本地服务只使用 loopback。渲染进程保持 contextIsolation、sandbox、nodeIntegration=false；文件能力限定于原生对话框选择的工程动作。

## 分发

固定 Electron 45.3.2、Forge 8.0.1、pnpm JS 10.33.0。构建准备步骤从当前根仓库打包 addon（不发布 npm），随 ZIP 放入 pnpm JS 和模板资源。Windows x64 首发；不包含 Linux/macOS 分发。

## 验证

新增少量真实文件测试覆盖模板、原工程字段保留、另存非覆盖、归档路径安全、命令桥；沿用已有测试检查 Studio 保存。临时实际启动 Electron 内置 Node + Slidev，检查工程信息、保存、工程 ZIP。生成 Windows ZIP 并检查 exe、资源与无独立 node.exe。当前环境为 Linux，无 Windows/Wine；Windows 原生对话框、依赖安装脚本、关闭行为及包运行需要用户在 Windows 试用，不以 Linux 结果代替。
