# Windows 桌面预览版

Windows x64，使用 Electron 自带 Node。分发 ZIP 不包含第二份 `node.exe`，用户无需安装 Node、pnpm、Docker 或工作台服务。轻量版随附 Studio，缺少的依赖安装时联网获取；完整版额外随附标准工程的 Windows x64 依赖缓存。两者采用同一安装和更新流程。Studio 与桌面壳分别使用 X.Y.Z 版本号，目前源码均为 0.5.1，可独立更新。

## 使用

完整解压 ZIP，在解压目录中运行 `Slidev Studio.exe`，不要只复制 exe。

- **新建工程**：选择一个新的空文件夹。应用从随附包和已下载包中选择本机最高正式版本，生成普通 Slidev 工程与依赖清单，安装后进入编辑器。新建不查询云端。
- **准备进度**：主页显示创建工程、安装依赖和启动编辑器的当前阶段；等待时显示滚动进度条、已用时间及最新安装信息。包数量来自 pnpm 实际输出，进度条不估算总百分比。准备期间仍可查看运行日志。
- **打开工程**：选择已有工程文件夹，默认打开 `slides.md`；没有默认入口时再选择 Markdown。依赖版本按工程清单保留。
- **导入工程 ZIP**：首页和新版 Studio 文件页选择 ZIP 及空目标目录，解包后按打开工程的流程选择入口、准备依赖。支持子目录入口，保留原有内容与依赖配置；不导入 PPTX。取消入口选择时已解包文件留在目标目录，可稍后打开。
- **导出演示**：新版 Studio 文件页先保存，再在系统浏览器打开 Slidev 导出页，支持 PDF、PNG 压缩包和图片型 PPTX。采集图片时选择共享当前标签页，导出期间保持工程打开。PPTX 内的文字和对象不能单独编辑。
- **启用 Studio**：仅对尚未启用 Studio 的工程询问是否启用本机可用版本。确认后添加 `vendor/slidev-addon-studio-X.Y.Z.tgz` 并设置 `file:` 依赖及启用配置；保留其他直接依赖和文稿。已有工程继续使用自己的 Studio，旧固定文件名也可继续打开。
- **另存为**：先保存当前编辑，再按工程 ZIP 的规则复制到工程外的空文件夹，然后打开副本。依赖、缓存、Git 历史和本机凭据配置不会复制。
- **关闭工程**：先保存，再停止本地 Slidev，回到欢迎页。窗口关闭也先检查保存；失败时留在编辑器。
- **日志**：欢迎页或编辑器“文件 → 打开运行日志”查看依赖安装和编辑进程日志。发生错误后可修正文件，再重新打开，不自动重试。

窗口原生按钮叠加在 Studio 标题栏，空白区域可以拖动窗口。欢迎页和非全屏预览保留窗口拖动区域。原生菜单默认隐藏，按 Alt 显示；Ctrl+Shift+M 弹出“工程管理”。日常工程操作在编辑器“文件”页；Ctrl+N 新建，Ctrl+O 打开，Ctrl+Shift+S 另存，Ctrl+Shift+I 打开开发者工具；Ctrl+S 保留 Studio 的保存行为。

原生工程管理不依赖项目 Vue/Vite 编译，可打开当前或最近尝试打开的工程目录、查看日志、复制工程诊断，以及重新加载工程或返回主页。重新加载与返回主页先明确确认可能丢失尚未应用的编辑，再直接使用磁盘文件；这两个操作不调用页面保存钩子，也不自动回滚源码。普通关闭、另存和更新仍按原保存检查执行。使用外部 agent 修正编译错误后可重新加载；完整可视化编辑器仍与文稿共用应用。Windows 原生菜单、快捷键、确认对话框及错误工程实际恢复需实机验收。

“文件”页的项目路径可点击打开文件夹；“查看 → 源码”提供当前页源码、相关文件位置和页面信息复制。使用外部工具修改工程的说明见[接入指南](../docs/custom-code/agent-guide.md)。 人和 agent 接续修改同一工程，整体约束见 [overall](../docs/overall.md)。先应用并保存，再交给 agent；期间暂停编辑同一内容，完成后查看刷新结果。

标准工程核对工程选定的 Studio、依赖配置、已安装版本和锁文件；环境一致就直接启动，不要求 Studio 版号等于桌面版号。自定义依赖或尚未准备好的工程执行 pnpm install 并优先复用缓存；匹配完整基线时按下文离线安装。普通打开不查新、不自动升级，锁文件继续约束依赖。已有 npm/Yarn 工程需要安装时，会先询问是否导入锁文件并生成 pnpm 锁，原锁保留。也可以取消，在外部准备依赖后打开。

选择“保留工程现有环境”时，旧版 addon 可能没有新的文件页或保存接口；离开前应用会明确要求自行保存。首版按可信的个人工程使用；Slidev 配置和依赖按普通本地工程执行。没有附带第三方原生模块的 C++/Python 编译工具链。

## 检查和更新 Studio

欢迎页和支持该宿主能力的“文件”页均提供“检查 Studio 更新”。原生对话框显示本机版本、npm 最新发布版本，以及当前工程版本（如已打开）。仅手动检查联网；取消或没有更高版本时不安装、不降级。

- 没有打开工程：选择“下载更新”，取得经 SHA-512 校验的 tgz，之后新建工程使用这个版本。
- 已打开工程：选择“更新并重启编辑器”，先取得归档，再完成保存，随后停止旧服务、更新当前工程的 Studio 依赖、安装并重开。其他工程不变。
- 查询失败时可继续编辑；保存失败停止更新。安装或重启失败会显示错误和日志，用户可修正后重新打开，不自动回滚或重试。

随附 Studio tgz 和 `studio-package.json` 记录一个明确版本。下载归档保存在 Electron 用户数据目录的 `studio-packages`；工程保留自己的 `vendor` tgz，ZIP 导出会带走它。第三方依赖缓存仍由 pnpm store 管理，工程运行使用自己的 node_modules。不会自建注册库或包数据库。

完整版本的旧缓存不保证覆盖新版新增的依赖。更新时可复用缓存，缺少的依赖仍需联网。该入口更新 Studio，不更新 Electron、窗口或原生文件功能；旧壳需要先换成支持该入口的桌面版本。

## 开发与打包

开发机需要 Node 22.13+ 和 pnpm。根仓库与 desktop 各自安装依赖：

```bash
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm desktop:dev
```

Windows ZIP：

```bash
pnpm release:build
# 可选完整版
pnpm release:build --offline
```

正式产物归档到仓库相邻的 `release/studio/<桌面版本>/`：ZIP 使用桌面版本，`slidev-addon-studio-<Studio版本>.tgz` 使用 Studio 版本，校验表按模式区分。online 表示轻量版，offline 表示完整版。`desktop/out` 是 Forge 中间输出。正式打包从 npm 获取根 package.json 指定、已经发布的精确 Studio tgz；未发布则停止，不改用本地源码。`desktop:dev` 仍从当前源码 pack。Forge 带入模板和 pnpm JS。`desktop/pnpm-workspace.yaml` 将此工具包与根仓库隔离，并仅在桌面包使用 hoisted 布局。未新增根 workspace 成员。

新建工程固定 Slidev CLI 52.19.0、默认主题 0.25.0、Vue 3.5.41、Markdown-it 14.3.0；后者避免当前 Markdown 插件自动解析到 15 后无法启动。首次安装生成工程自己的 `pnpm-lock.yaml`。现有工程不套用这套模板版本。

## 验证范围

以下实际启动和 ZIP 记录属于此前版本。此次包更新源码已用相关文件/HTTP/编排测试与静态检查验证，尚未重新制作 Windows 包，也未实际在 Windows 执行更新。

已在 Linux 完成真实文件测试，并用 Electron 45.3.2 / 内置 Node 24.22.2 创建全新工程、安装依赖、运行安装脚本、启动 Slidev、保存及另存。安装脚本记录的执行程序确认为 Electron。已交叉打包 Windows ZIP 并检查 exe、生产依赖、pnpm JS、模板及当前 addon。

没有 Windows/Wine 环境；Windows 原生对话框、node.cmd 实际执行、窗口关闭、剪贴板与 ZIP 解压启动仍需实机试用。Linux 探针不能替代 Windows 验收。未接入签名、安装器、Electron 自动更新或网站同步。Studio 手动包更新与 Electron 更新分别处理。GitHub Release 由本地命令手动上传，不在 CI 中构建或上传桌面包。

桌面包随附一个明确版本的 Studio，其中包含人机协同 skill 与完整样例；新工程 AGENTS 指向随包技能。样例在项目安装后的 node_modules/slidev-addon-studio/examples/human-agent 中。

## Windows 完整版与离线基线

完整解压到可写目录，例如 `D:\StudioOffline`，再运行 exe。新建工程选中的 Studio 与随附基线一致时，复制随包固定锁文件，以 pnpm 10.33.0 从软件资源目录中的 store 安装；不访问注册库、不执行安装脚本。安装后工程有自己的 node_modules，不依赖软件目录中的链接。

标准工程的依赖、锁文件和配置与基线一致，且已有安装锁及关键入口时，重新打开直接启动。改文字、拖动、换素材不触发安装。只为这一明确基线跳过准备；新增依赖、改版本或导入旧工程仍沿用原有准备流程，不承诺离线可用，也不会替换其锁文件来凑成基线。标准工程离线安装失败会停下显示日志，不自动切换联网安装。

选中随附基线时建议试用：

1. 解压后先断网，再新建一个空目录中的工程，确认状态显示“从随附文件准备离线依赖”，安装日志下载数为 0。
2. 修改文字、保存并关闭工程；重新打开，确认直接启动编辑器。
3. 试一次另存为，新副本应从随包依赖完成离线准备。
4. 如失败，保留“打开运行日志”中的内容反馈；不要只复制 exe，也不要删除随包的 studio-resources。

离线范围是标准工程的编辑与构建依赖。外链图片、网络字体、在线服务和 agent 新增的包不在这个承诺中。当前无 Windows/Wine 环境；依赖安装已在 Linux 上指定 Windows 目标验证，实际 Windows 启动、路径、原生窗口行为需本次试用确认。

构建并归档完整版：在仓库根目录运行 `pnpm release:build --offline`（`pnpm desktop:make:offline` 也可）。准备脚本在临时工程生成锁文件，以 supportedArchitectures 的 win32/x64 配置收集独立 store；不复制开发机全局缓存。随包 pnpm 安装时会写入缓存元数据，因此软件目录必须可写。普通 `make` 生成不含完整依赖缓存的轻量包。选中较新的缓存 Studio 时，不复制旧离线锁文件；后续安装复用 store 并允许下载新增依赖。


## 版本与手动发布

```bash
pnpm release:version studio 0.5.2   # 只修改 Studio 版本
pnpm release:version desktop 0.5.2  # 只修改桌面壳版本
pnpm release:build                 # 默认轻量版，取得已发布的精确 Studio 包
pnpm release:build --offline    # 需要时再制作离线版
pnpm release:publish --dry-run  # 检查本地产物并预览上传，不联网
```

Studio 发布沿用 `docs/releases/X.Y.Z.md`、根 package.json 和 `vX.Y.Z` 标签；显式推送该标签触发现有 npm 工作流，版号校验不读取 desktop。正式桌面包需要等指定 Studio 版本发布完成，再本地构建。桌面发布使用 `desktop-vX.Y.Z` 标签；可提供 `docs/releases/desktop-X.Y.Z.md` 作为说明。本地打包不会发布 npm，版本命令不自动提交或打标签。

GitHub Release 另行手动执行，需先安装并登录 GitHub CLI，且远端已存在对应标签：

```bash
pnpm release:publish            # 上传已构建的轻量版
pnpm release:publish --offline  # 可选：给同一 Release 补充离线版
```

上传命令先核对本地 SHA256，再创建 Release 或给已有 Release 上传所选模式。已有同名资产会报错，不覆盖。每次重新分发内容不同的桌面 ZIP 都使用新桌面版本；平日只更新 Studio 时无需打桌面包。`--dry-run` 也可用于打包命令，查看模式和输出位置。

历史安装包按需手动清理；打包脚本不自动删除其他版本、截图或其他项目的产物。


## 启动诊断

首次安装后，Slidev 仍需进行本地编译。桌面启动等待上限为 3 分钟，每次 HTTP 就绪探测允许最多 10 秒；启动输出会显示在准备页。子进程报错或退出会立即结束等待并显示原因，不会一直等到超时。

“打开运行日志”保留各次命令、工程目录、完整安装/启动输出和进程退出原因。若仍失败，请附上失败时最后几行日志；页面加载失败会回到准备页，再次打开不会被误认为已成功打开。
