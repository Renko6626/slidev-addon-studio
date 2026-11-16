# Windows 桌面预览版

Windows x64，使用 Electron 自带 Node。分发 ZIP 不包含第二份 `node.exe`，用户无需安装 Node、pnpm、Docker 或工作台服务。首次准备工程依赖需要联网。

## 使用

完整解压 ZIP，在解压目录中运行 `Slidev Studio.exe`，不要只复制 exe。

- **新建工程**：选择一个新的空文件夹。应用生成普通 Slidev 工程、随附 Studio addon 及依赖清单，安装后进入编辑器。
- **准备进度**：主页显示创建工程、安装依赖和启动编辑器的当前阶段；等待时显示滚动进度条、已用时间及最新安装信息。包数量来自 pnpm 实际输出，进度条不估算总百分比。准备期间仍可查看运行日志。
- **打开工程**：选择已有工程文件夹，默认打开 `slides.md`；没有默认入口时再选择 Markdown。依赖版本按工程清单保留。
- **启用 Studio**：已有工程会明确询问是否使用本应用随附的 Studio。确认后添加 `vendor/slidev-addon-studio.tgz`，修改 addon 依赖和 `package.json` 的启用配置；不升级已有 CLI、主题或 Vue。即使 npm 包版本号相同，也会按实际源码包识别是否已经接入本次能力。
- **另存为**：先保存当前编辑，再按工程 ZIP 的规则复制到工程外的空文件夹，然后打开副本。依赖、缓存、Git 历史和本机凭据配置不会复制。
- **关闭工程**：先保存，再停止本地 Slidev，回到欢迎页。窗口关闭也先检查保存；失败时留在编辑器。
- **日志**：欢迎页或“帮助 → 打开运行日志”查看依赖安装和编辑进程日志。发生错误后可修正文件，再重新打开，不自动重试。

编辑器“文件”页和应用原生菜单都能操作工程。Ctrl+N 新建，Ctrl+O 打开，Ctrl+Shift+S 另存；Ctrl+S 保留 Studio 的保存行为。

使用随附 Studio 的工程每次打开都会执行一次普通 pnpm install 并复用缓存，确保之前中断或取消安装后不会误用旧 addon。不执行 pnpm update，不改已有版本约束；已生成的锁文件继续约束依赖。已有 npm/Yarn 工程需要安装时，会先询问是否导入锁文件并生成 pnpm 锁，原锁保留。也可以取消，在外部准备依赖后打开。

选择“保留工程现有环境”时，旧版 addon 可能没有新的文件页或保存接口；离开前应用会明确要求自行保存。首版按可信的个人工程使用；Slidev 配置和依赖按普通本地工程执行。没有附带第三方原生模块的 C++/Python 编译工具链。

## 开发与打包

开发机需要 Node 22.13+ 和 pnpm。根仓库与 desktop 各自安装依赖：

```bash
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm desktop:dev
```

Windows ZIP：

```bash
pnpm desktop:make
```

输出为 `desktop/out/make/zip/win32/x64/Slidev Studio-win32-x64-0.1.0.zip`。准备步骤从当前根源码打包 addon，不发布 npm；Forge 带入模板和 pnpm JS。`desktop/pnpm-workspace.yaml` 将此工具包与根仓库隔离，并仅在桌面包使用 hoisted 布局。未新增根 workspace 成员。

新建工程固定 Slidev CLI 52.19.0、默认主题 0.25.0、Vue 3.5.41、Markdown-it 14.3.0；后者避免当前 Markdown 插件自动解析到 15 后无法启动。首次安装生成工程自己的 `pnpm-lock.yaml`。现有工程不套用这套模板版本。

## 验证范围

已在 Linux 完成真实文件测试，并用 Electron 45.3.2 / 内置 Node 24.22.2 创建全新工程、安装依赖、运行安装脚本、启动 Slidev、保存及另存。安装脚本记录的执行程序确认为 Electron。已交叉打包 Windows ZIP 并检查 exe、生产依赖、pnpm JS、模板及当前 addon。

没有 Windows/Wine 环境；Windows 原生对话框、node.cmd 实际执行、窗口关闭、剪贴板与 ZIP 解压启动仍需实机试用。Linux 探针不能替代 Windows 验收。本轮未接入签名、安装器、自动更新、网站同步或云端发布。

0.2.0 随附 Studio 0.4.0-renko.1、人机协同 skill 与完整样例；新工程 AGENTS 指向随包技能。样例在项目安装后的 node_modules/slidev-addon-studio/examples/human-agent 中。
