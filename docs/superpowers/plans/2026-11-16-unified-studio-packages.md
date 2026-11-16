# Unified Studio Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution after the user authorizes implementation. User instructions take priority over skill defaults for tests, delegation, commits and scope. No implementation is authorized by this planning-only turn.

**Goal:** 轻量版与完整版使用统一的 Studio tgz 获取、版本比较、工程安装和手动更新流程，桌面壳可独立发布。

**Architecture:** 桌面主进程选择随附/已下载/云端包，统一复制版本化 tgz 到工程，再复用 pnpm 安装和 Slidev 启停。pnpm 管理第三方依赖缓存；工程保留自己的版本。一个小型包模块与一个更新编排模块分别负责包和工程更新，不引入服务、数据库或任务系统。

**Tech Stack:** 现有 Electron 45.3.2、内置 Node、pnpm 10.33.0、CommonJS、Vue/TypeScript、Vitest；不新增第三方依赖或云端工作流。

**Spec:** [统一设计](../specs/2026-11-16-unified-studio-packages-design.md)

## Global Constraints

- 当前授权仅限设计和计划；以下全部产品修改均待实施指令。保留已有未提交的桌面、发布、题目和图片/缩放改动，不自动提交、推送、发布或回退。
- 轻量版与完整版只区别随附范围。仅主动检查和更新；打开旧工程不联网查新、不升级、不降级其他工程。
- 包名固定 `@renko_1055/slidev-addon-studio`，工程依赖别名固定 `slidev-addon-studio`；正式版本 `X.Y.Z`，跟踪 npm latest。旧非正式版继续可打开，不扩展成通用版本迁移。
- 新工程/主动更新使用 `vendor/slidev-addon-studio-X.Y.Z.tgz`；旧固定文件名保留，直到用户显式更新。
- 根 Studio 与 desktop 版号独立；推荐正式桌面包取得 npm 已发布的精确 Studio tgz；开发启动保留源码 pack。发布标签建议分别为 `vX.Y.Z` 和 `desktop-vX.Y.Z`。
- 不升级其他直接依赖；锁文件只因必要的 Studio 依赖解析改变。不制作旧离线锁与新 Studio 的混合工程。
- 复用 pnpm store 和现有进度、日志、保存及 `working`。不增加重试、队列、回滚、自动缓存清理、后台更新、批量更新、自建注册库或通用升级框架。
- 新增永久测试只覆盖本功能的具体关键行为；优先更新已有测试，不写源码字符串或仅验证 mock 的测试。UI 和文案不单独加永久测试。
- 浏览器至多导航和截图，不自动点击、输入、滚动、下载或跑更新流程；真实 Windows 行为单独列为待试包验收。

## Review Focus

以下五项是重点实际行为；在最合适的一层各覆盖一次，不复制到所有测试层：

1. 同一个旧桌面壳使用较新 Studio 后能重新打开，且不会被随附旧包替换（Task 2）。
2. 完整版选中较新缓存 Studio 时不套用旧离线基线；普通安装仍可复用完整版 store（Task 2）。
3. 检查失败、用户取消或保存失败时，当前工程内容与已运行编辑器保持原状（Task 3）。
4. 下载不完整/校验失败的字节不能成为本机可选包，也不修改工程（Task 1）。
5. 正式桌面产物的 Studio 版本和字节来自指定 npm 产物，不要求等于壳版号；开发源码 pack 不冒充已发布产物（Task 4）。

## Shared Interfaces

以下形状用于主进程 CJS 模块，在文档中约定即可，不为它们建立独立类型框架。

```ts
type StudioArchive = { name: string; version: string; archive: string; integrity: string }
type StudioRelease = { name: string; version: string; tarball: string; integrity: string }
type InstallPlan = { needsInstall: boolean; storeDir?: string; offline: boolean }
type UpdateInfo = {
  projectName: string | null
  currentVersion: string | null
  localVersion: string
  latestVersion: string
  targetVersion: string
  canUpdate: boolean
}
type HostResult = { ok: boolean; error?: string }
```

- Task 1 → Task 2/3/4：`createStudioPackageSource({ resources, userData, registryUrl?, fetchImpl? })` 返回 `local(): Promise<StudioArchive>`、`check(version = 'latest'): Promise<StudioRelease>`、`acquire(release): Promise<StudioArchive>`。registryUrl/fetchImpl 仅用于生产默认值与本地 HTTP 测试，不通过渲染端开放。
- Task 2 → Task 3/4：`enableStudio(project, resources, archive?)`；`createProject(directory, resources, { platform?, arch?, studioPackage? } = {})`；`readProjectStudio(project)` 返回 `{ installedVersion: string | null, expectedVersion: string | null, configured: boolean, managed: boolean }`；`dependencyPreparation(project, resources, target = {}): Promise<InstallPlan>`。
- Task 2 → Task 3：`runtime.install(project, { changed?, importLock?, storeDir?, offline? })`，保留既有 start/stop/logPath。
- Task 3 → preload/UI：`window.studioDesktop.studioUpdate?: () => Promise<HostResult>`，对应主进程固定 IPC `studio:updates`；不接受渲染端版本、包名、路径或 URL。
- Task 4 → Task 1：`studio-resources/studio-package.json` 是 `{ name, version, integrity }`，描述同目录 `slidev-addon-studio.tgz` 的实际字节。

依赖顺序：Task 1 → Task 2 → Task 3；Task 4 依赖 Task 1/2 的包与工程接口；Task 5 集中收尾。实施时直接沿用已确认接口；发现新的重要边界或存储方案先报告。

## Task 1: 统一 Studio 包描述、本机选择和云端获取

**Files:** Create `desktop/studio-packages.cjs`, `test/desktop-packages.test.ts`。

**Interfaces:** 实现上述包来源接口；可导出 `compareStudioVersions(a, b)` 与 `readBundledStudio(resources)` 供工程和构建复用。其余扫描与摘要处理保留模块内部。

- [x] 在新测试文件使用临时目录和 Node 本地 HTTP 服务覆盖以下可观察结果：`0.10.0` 高于 `0.9.9`；随附 `0.5.1` 与缓存 `0.5.2` 选中后者；只检查云端版本不写缓存；成功下载保存与响应完全相同的字节；错误摘要不产生可选版本。
- [x] Run: `pnpm exec vitest run test/desktop-packages.test.ts`。Expected: 新能力缺失导致测试失败，既有工程文件未受影响。
- [x] 实现 `createStudioPackageSource`：读随附描述、按正式版本文件名扫描用户归档、查询固定 npm 包的 latest/精确版本、比较数字版本、取得并校验 tgz。下载先写临时文件，完成后再成为正式归档；不开发下载恢复。缓存是简单文件目录，不能另加持久版本索引或当前版本指针。
- [x] `acquire` 复用同版本且摘要匹配的本机归档；同版不同内容应明确报错，不静默覆盖。错误处理只报告原因，用户决定重试。
- [x] Run: `pnpm exec vitest run test/desktop-packages.test.ts`。Expected: 上述行为通过，测试不访问真实 npm、不改实际应用缓存。

## Task 2: 工程统一安装与离线基线判断

**Files:** Modify `desktop/projects.cjs`, `desktop/runtime.cjs`, `test/desktop-projects.test.ts`, `test/desktop-runtime.test.ts`。

**Interfaces:** 消费 Task 1 的 StudioArchive；实现 Shared Interfaces 的工程读取、创建、启用、InstallPlan 和 runtime.install。`hasBundledStudio` 可保留作“与离线基线一致”的判断，不再用它代表“工程能否打开/是否必须启用随附包”。

- [x] 更新现有临时资源夹具，提供真实描述和已知归档字节。扩展已有行为用例：壳 `0.5.1` 配工程 Studio `0.5.2`，安装就绪后 `needsInstall === false`；重开不改 manifest、文稿或归档；启用/更新只替换 Studio 依赖，其余直接依赖与作者字段保持原值。
- [x] 在现有离线用例覆盖：随附 Studio 与 manifest/锁匹配时 `offline === true`；选中较新归档后不复制旧基线锁，`offline === false`，仍返回随附 `storeDir`；已有普通工程与旧固定 tgz 引用仍可打开。
- [x] Run: `pnpm exec vitest run test/desktop-projects.test.ts test/desktop-runtime.test.ts`。Expected: 需要版本解耦和安装计划变化的新行为先失败；原有效断言保留。
- [x] 修改项目函数接收选定归档，写版本化本地引用；安装就绪检查读取工程预期/安装版本、关键入口与锁文件，不读取 desktop 版号。未知来源保留工程环境，既有显式启用提示继续用于真正未启用 Studio 的工程。
- [x] 将 runtime 的 `offlineStore` 参数统一成 `storeDir` 与 `offline`。普通安装保持 `--prefer-offline`；只有匹配的完整基线使用 `--offline --frozen-lockfile --ignore-scripts --package-import-method=copy`。普通更新可复用同一 store，但不静默联网补救一次失败的离线安装。
- [x] Run: `pnpm exec vitest run test/desktop-projects.test.ts test/desktop-runtime.test.ts`。Expected: 原行为和新增关键行为通过。安装命令验证沿用既有真实子进程边界；若已有本地小包夹具可验证锁文件效果则复用，不搭建独立安装测试工程或联网拉全量依赖。

## Task 3: 手动检查、下载及当前工程更新

**Files:** Create `desktop/studio-update.cjs`, `test/desktop-update.test.ts`；Modify `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/welcome.html`, `desktop/welcome.js`, `client/project-host.ts`, `client/ui/StudioFile.vue`, `client/i18n/en.ts`, `client/i18n/zh-CN.ts`。样式仅按现有按钮需要局部调整。

**Interfaces:** `runStudioUpdate({ packages, project, save, stop, open, confirm, status }): Promise<HostResult>`。packages 来自 Task 1；project 是主进程当前工程或 null；confirm 接收 UpdateInfo 并返回用户选择；save/stop/open 复用主进程保存、清理 current 和 `openPrepared(project, { changed: true })`；整个操作受 main.cjs 既有 working 约束。

- [x] 用 Task 1 的本地 HTTP 和临时包方式、Task 2 的真实工程函数测试：无工程时只取得缓存；有工程时更新版本化引用并调用宿主重新打开；保存拒绝、用户取消或元数据请求失败时原 manifest/文稿/工程 tgz 保持原字节。Electron 对话框和进程入口允许替代，但不以调用次数或内部顺序代替文件与结果断言。
- [x] Run: `pnpm exec vitest run test/desktop-update.test.ts`。Expected: 更新编排尚未实现导致失败。
- [x] 实现固定流程：读取当前与本机版本 → 查询 latest → 原生对话框显示实际版本与目标 → 用户同意后取得归档 → 有工程则保存 → 停止并清理旧 current → 启用所选包 → 安装并重开。无工程时停在缓存完成。云端较旧时仍比较本机候选，不降级。
- [x] 检查网络失败保持编辑器运行；保存失败不停止；安装/重开失败返回现有准备页和日志，不自动恢复或回滚。状态转发继续使用既有 reportStatus，不估算总下载百分比。
- [x] preload 只暴露无参数 studioUpdate，main 对固定 IPC 保留 sender 检查。首页与文件页按钮调用它；文件页按方法存在性显示，独立浏览器与旧壳不出现不可用入口。不新增版本管理页面。
- [x] main 新建使用本机最高可用归档；打开已有工程与另存使用该工程自身版本；移除“已更新工程再次被推荐替换成旧随附包”的入口条件。
- [x] Run: `pnpm exec vitest run test/desktop-update.test.ts test/desktop-packages.test.ts test/desktop-projects.test.ts test/desktop-runtime.test.ts`。Expected: 相关行为通过；至此只运行局部检查，留 Task 5 做一次集中验证。

## Task 4: 构建输入统一与独立版本发布

**Files:** Modify `desktop/scripts/prepare.cjs`, `desktop/scripts/prepare-offline.cjs`, `desktop/package.json`, `scripts/release.cjs`, `test/release.test.ts`, `.github/workflows/release.yml`；在 `test/desktop-packages.test.ts` 复用描述/下载验证，不再新增一套打包测试框架。

**Interfaces:** `setVersion(projectRoot, target: 'studio' | 'desktop', version)`；`releaseInfo(projectRoot, offline = false)` 返回 `desktopVersion`, `studioVersion`, 原有 mode/产物路径；`prepare({ source: 'workspace' | 'published' })` 与用于真实文件测试的 `writeStudioPackageInfo(resources, { name, version })`。构建脚本被 import 时不能自动打包。

- [x] 修改已有 release 测试以断言：变更 Studio 版号不改壳版号；不同版号仍能生成产物信息；online/offline ZIP 用壳版号，tgz 用 Studio 版号；收集校验表保留另一模式 ZIP。更新有效预期，不简单删除原版号检查用例。
- [x] 在包测试中调用真实写描述函数，验证读取的版本与归档摘要对应；正式资源准备使用本地 HTTP 提供的指定版本 tarball，断言输出 tgz 与响应字节一致。未发布的精确版本报错，不能回退 workspace pack。开发 pack 沿用已有路径，不做云端请求。
- [x] Run: `pnpm exec vitest run test/release.test.ts test/desktop-packages.test.ts`。Expected: 新版号和正式来源行为先失败。
- [x] 将命令改为 `pnpm release:version studio X.Y.Z` / `pnpm release:version desktop X.Y.Z`。正式 release:build 走 published，desktop:dev 走 workspace；直接调用桌面 make 也走正式来源，避免入口结果不一致。
- [x] prepare 写随附描述，再调用同一个 createProject 生成完整基线并收集锁与 store。只在 `--offline` 时收集完整依赖；不调整 pnpm store 内部布局。新建基线明确使用随附归档，不受构建机其他缓存版本影响。
- [x] releaseInfo 不要求两版相等。桌面 GitHub tag 使用 `desktop-v<desktopVersion>`；npm 的 `v<studioVersion>` 流水线只改为直接读取根 package.json 校验。既有 npm 测试/类型检查范围和桌面手动发布方式不扩展。
- [x] Run: `pnpm exec vitest run test/release.test.ts test/desktop-packages.test.ts`。Expected: 版号与产物来源行为通过。Run: `node scripts/release.cjs build --dry-run` 和 `node scripts/release.cjs build --offline --dry-run`。Expected: 仅打印对应输入/版本/模式与输出路径，不联网、不打包、不发布。

## Task 5: 文档和一次集中验收

**Files:** Modify `desktop/README.md`, `README.md`, `docs/usage.zh-CN.md`, `docs/limitations.md`, `docs/development.md`；实施记录追加到本计划，不为本轮新建发布版本说明。

- [x] 文档说明轻量/完整仅区别随附范围、tgz/store/node_modules 各自职责、主动更新范围、两个独立版号、正式先发 npm 再打桌面包，以及新依赖仍可能需要联网。改掉“版本必须一致”“始终使用随附 Studio”等已不适用的当前说明；历史阶段记录不重写。
- [x] Run: `pnpm exec vitest run test/desktop-packages.test.ts test/desktop-projects.test.ts test/desktop-runtime.test.ts test/desktop-update.test.ts test/release.test.ts test/project.test.ts test/project-save.test.ts test/i18n.test.ts`。Expected: 所有相关测试通过；不启动可选 HTTP QA 或浏览器交互。
- [x] Run: `pnpm typecheck`；`pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`；对实际修改的 CJS 执行 `node --check`；`git diff --check`。Expected: 全部通过。
- [x] 如需看新入口，只导航并截图首页/文件页；不执行自动更新。静态构建仅在确有 Studio 源码改动影响的情况下使用既有 playground 构建一次。实际 Windows 下载、对话框和重启作为后续人工试包项，不用模拟测试冒充验收。
- [x] 按用户需要再进行一次正式轻量/完整打包或大规模依赖下载；默认不做。完成实施时报告实际命令、结果和未验证项；保留所有无关改动，不自动提交、推标签、发布 npm 或上传 GitHub。

## 计划检查与交接

- 本计划使用已有依赖，不增加通用缓存、队列或恢复功能。新模块仅对应已确认的“取得 Studio 包”和“更新当前工程”两项职责。
- 每条 Review Focus 在对应任务中有单层行为覆盖；产品 UI 不增加永久测试。运行时/工程/发布测试不机械复制同一场景。
- 首次实现前，核对本机执行的 pnpm 确为交付的 10.33.0；仓库 packageManager 是 11.20.0，查看工具帮助时可能被工程配置切换版本，不能把开发机命令输出直接当作桌面实际版本。包管理器能力或缓存验证应在独立临时工程进行，不借此升级交付版本。
- 推荐在同一会话由主 agent 顺序实施，相关修改共享项目/包接口，不拆成多个并行实现。若需委派，任务必须保留用户约束并明确文件所有权。
- 尚未开始以上任务。用户已确认的模型不再重复询问；实施前需核对本计划中新明确的正式构建来源、版本化文件名和独立发布标签是否接受。


## 执行记录

- 用户已在本会话明确指令“开干”，授权按计划实施；上文“仅计划”描述保留为制定时状态。
- Pre-flight: Task 1 包描述供 Task 2/3/4 共用；Task 2 安装计划供 Task 3/4 使用；Task 4 随附描述写入与 Task 1 读取一致。无接口冲突。
- Ruling: 直接在当前工作区顺序实现，已备份涉及文件的既有内容，保留其他改动；不按技能默认步骤自动提交或创建新工作树。最终对本轮实际差异做一次只读审阅。

- Ruling: `runStudioUpdate` 显式接收 resources，供其调用已有 `enableStudio`，无新增存储或宿主能力。

## 实施结果

- Task 1–4 已完成：统一包来源、按工程版本安装、首页/文件页手动更新、精确发布归档和独立版号均已接入。Task 5 的文档和默认验证已完成；复选项中的条件性截图、实际打包/Windows 验收没有执行，不能视为验收通过。
- 新增包/更新编排用例，以及修改后的工程/发布用例，均先确认缺少实现时失败，再完成实现。没有删除有效断言来掩盖失败。
- `pnpm exec vitest run test/desktop-packages.test.ts test/desktop-projects.test.ts test/desktop-runtime.test.ts test/desktop-update.test.ts test/release.test.ts test/project.test.ts test/project-save.test.ts test/i18n.test.ts`：8 文件、34 项通过。下载与正式包来源用本地 HTTP 和真实文件验证；没有访问真实 npm 更新工程。
- `pnpm typecheck`：通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`：通过。
- 对 `desktop/{studio-packages,studio-update,projects,runtime,main,preload}.cjs`、`desktop/welcome.js`、`desktop/scripts/{prepare,prepare-offline}.cjs` 和 `scripts/release.cjs` 共 10 文件执行 `node --check`：通过。
- `node scripts/release.cjs build --dry-run` 与 `node scripts/release.cjs build --offline --dry-run`：正确区分轻量/完整模式、壳与 Studio 版号、published 归档输入；没有联网或构建 ZIP。
- `git diff --check`：通过。另一次只读审阅未发现阻塞问题；没有按理论风险扩大实现。
- 没有新增依赖、改动实际版号、提交、推标签、发布 npm、上传 GitHub、执行正式桌面打包、联网安装全量依赖或浏览器交互。保存与更新界面、Windows 原生对话框、实际网络下载、node.cmd 和进程重启仍需后续试包；已有安装包不包含本轮实现。
- 桌面 pnpm 安装包元数据为 10.33.0，在临时目录执行也是 10.33.0；仓库的 11.20.0 配置不作为桌面交付版本证据。


## 合并前验证

用户随后明确要求合并 main、提交并推送，授权包含工作区中此前保留的桌面启动、题目选项和发布脚本改动。完整 `pnpm test`：389 项通过，1 项既有可选 HTTP QA 跳过；`pnpm typecheck` 和 `vue-tsc@3.1.8 --noEmit --project tsconfig.json` 通过。`git diff --check` 通过。此次不打发布标签、不发布 npm 或桌面安装包，Windows 实机范围仍未验证。
