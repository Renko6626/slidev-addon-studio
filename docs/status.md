# Studio 当前状态

按 2026-11-17 的本地仓库整理。产品定位与约束见 [overall](overall.md)，本文只记录源码、交付和验证范围。

## 源码与交付

- Studio 根包与桌面壳的源码版本当前均为 `0.5.1`，分别维护，允许独立更新。
- 本地 main 已整合 `codex/studio-import-export` 的三个功能提交：`d08abf4`（演示导出与工程 ZIP 导入）、`74e3f89`（只读源码定位与桌面原生工程管理）、`3821d93`（中性源码入口和复制内容）。此前 `660e2f2` 提供的包更新与桌面改进保留。已有工程打开不会自动升级。
- 仓库最近明确记录的 npm 发布是 [0.4.0-renko.1](releases/0.4.0-renko.1.md)。本次未联网复核注册库；源码版本、发布说明或本地产物的存在均不证明该版本已经公开发布。
- [0.5.0](releases/0.5.0.md) 和 [0.5.1](releases/0.5.1.md) 记录对应版本的改动。桌面包另按壳版本交付；这次合并不改版本、不发布 npm、不打包 Windows，也不代表已安装版本含有新增能力。

## 当前可用能力

- 可视化制作：页面列表与预设、富文本、图片、形状、音视频、多选排版、图层、背景、复制粘贴、备注、动画与放映。
- 人与 agent 接续制作：只读源码、文件位置与页面信息复制、随包技能、完整样例、组件可编辑字段与公共 runtime。agent 由外部工具运行，复制信息不附带任务指令。
- 内置交互：单选、多选、规则控件、独立题干/选项/反馈、选项增删及本次试播首次答对计数。动态表达式和自定义选项结构仍按源码维护。
- 本地工程：源码写回、显式保存、工程 ZIP，以及 PDF/PNG/图片型 PPTX 导出入口；桌面壳提供新建、打开、ZIP 导入、另存、日志、依赖准备和手动 Studio 包更新。原生工程管理不依赖项目编译，允许显式确认后从磁盘重新加载或返回主页。
- 独立交付：普通 Slidev 工程可以继续编辑和构建；addon 不要求账号、Git、数据库或协作工作台。

详细行为以[使用指南](usage.zh-CN.md)与[限制说明](limitations.md)为准。手机答题、远程服务和多人同步没有因提供 Pinia/runtime 而实现。

## 已有验证记录

下表来自此前实施记录；这次整合后的实际验证结果见下一节。

| 范围 | 已有结果 | 证据边界 |
| --- | --- | --- |
| 统一包更新阶段 | `pnpm test`：389 通过，1 项可选 HTTP QA 跳过；`pnpm typecheck` 与临时 `vue-tsc@3.1.8 --noEmit --project tsconfig.json` 通过 | 不代表 Windows 或真实操作验收 |
| 桌面包来源与更新 | 相关包、工程、更新、发布及保存检查通过；本地 HTTP 与真实临时文件验证归档及写入 | 未使用真实 npm 执行工程更新 |
| 发布命令 | `node scripts/release.cjs build --dry-run` 及其 `--offline` 模式通过 | 未联网获取正式包，未制作新 ZIP |
| 人机协同样例与 runtime | 实际 tgz 安装后的 Slidev 52.19 样例、子路径静态构建及保留 patches 的工作台 53.0 模板构建通过 | 属于此前版本记录，不代表所有 Slidev 版本兼容 |
| Windows 桌面基础 | 历史版本做过 Linux 真实工程启动、保存与另存探针，以及 Windows ZIP 交叉打包和库存核对 | Linux 结果不能替代 Windows 实机 |

## 本次合并验证，2026-11-17

- `node_modules/.bin/vitest run`：396 通过，1 项既有可选 HTTP QA 跳过。
- `node_modules/.bin/tsc --noEmit`：通过。Vue SFC 检查使用既有缓存 vue-tsc 3.1.5，显式调用工程 TypeScript 5.9.3，参数为 `--noEmit --project tsconfig.json`：通过；没有安装或升级依赖。
- `node_modules/.bin/slidev build playground/slides.md --base /studio-check/ --out /tmp/studio-merge-build.GydGo3`：通过。
- `node --check` 检查 `desktop/main.cjs`、`desktop/projects.cjs`、`desktop/preload.cjs`、`desktop/project-management.cjs`：通过；`git diff --check` 通过。

合并后的生产代码与测试和原功能分支一致，手工解决的冲突仅在 README 和桌面说明。已完成计划中的有效结论并入现行文档，原始过程保留在分支提交历史。

## 尚待实际使用验证

实际 PDF 打印、标签页采集和 PNG/PPTX 产物、Windows ZIP 导入、原生工程管理菜单及确认框、真实错误工程重新加载、网络更新与进程重启、输入法、原生剪贴板、文件选择、全屏和音视频解码仍需按实际场景试用。没有执行浏览器自动点击、填写或交互流程。

正常使用发现问题后，根据日志和工程文件修复；这些验收缺口不自动扩展为新的恢复系统或大范围自动化。验证命令与发布方式见[开发说明](development.md)及[桌面指南](../desktop/README.md)。
