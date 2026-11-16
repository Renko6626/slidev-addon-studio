# Studio 导入导出实施计划

依据：同日 import-export-design；范围已获用户确认。沿用 Vue、Slidev、Electron、JSZip 和现有保存流程，不增依赖。浏览器仅截图，不自动点击或填写。

1. 文件页添加保存后打开 Slidev 浏览器导出页的入口，说明 PDF、PNG 压缩包及图片型 PPTX；处理 browserExporter 禁用、保存失败；桌面借外部链接打开系统浏览器。
2. 提取现有 ZIP 解包为可复用函数，保留 saveProjectCopy 的目标限制；为真实 ZIP 解包添加一个短测试。桌面复用入口选择和打开流程，提供独立可选 importProject bridge，首页及文件页展示入口。
3. 修复文件页名称被全宽刷新按钮挤压的问题，文件树名称单行省略；使用截图检查桌面和窄屏。
4. 更新使用说明。集中运行相关已有测试、类型检查、静态构建、JS 语法检查及 diff 检查。记录原生打印、屏幕共享、Windows 对话框未实机验收。

不增加纯样式永久测试。源码查看/修改功能仅在交付时讨论边界。

## 实施及验证记录

- 已完成四项。实现保持现有浏览器导出与桌面解包/打开流程；新增可选 importProject bridge，未升级依赖或发布。
- `node_modules/.bin/vitest run test/desktop-projects.test.ts test/project-save.test.ts test/project.test.ts test/i18n.test.ts`：22 通过。新增真实 ZIP 导入和保存后进入导出页的行为覆盖，先观察失败再实现；保存失败用原有用例扩展验证不会进入导出页。
- `node_modules/.bin/tsc --noEmit`：通过。
- 使用缓存 vue-tsc 3.1.5 并显式传入工程 TypeScript 5.9.3 的 tsc 路径执行 `run(require.resolve('typescript/lib/tsc.js'))`：通过。直接使用缓存环境默认的 TypeScript 7 不兼容，未修改工程依赖。SFC 检查发现并修正导出入口函数缺少闭合括号；修正后重新检查通过。
- `node --check desktop/main.cjs`、`node --check desktop/projects.cjs`、`node --check desktop/preload.cjs` 及 `git diff --check`：通过。
- `node_modules/.bin/slidev build playground/slides.md --base /studio-check/ --out /tmp/studio-import-export-build`：通过。静态构建不包含 Studio 编辑 UI；另以真实开发页和 SFC 检查覆盖编辑器编译。
- 截图复现刷新按钮占满标题行，1200/800px 视口下标题原为 27px 宽、421px 高；修正后分别为 830/462px 宽、35px 高。实际文件页截图为 `/tmp/studio-import-export-file-{desktop,compact}.png`，导出页为 `/tmp/studio-import-export-exporter.png`。仅导航和初始化文件页状态，没有自动点击、填写或执行导出流程。
- 实际带 `/studio-check/` base 的导出页正常显示，未出现 Studio 编辑工作区。无头浏览器报告既有 Wake Lock 权限拒绝，未修改 Slidev 权限行为。开发服务器因本机 watcher 配额已满而使用 CHOKIDAR_USEPOLLING=1 启动，未改工程配置。
- 一次限定范围的只读独立审阅，无阻塞发现。
- 未验证：真实打印/保存 PDF、标签页共享与 PNG/PPTX 产物、Windows 原生导入对话框和依赖安装。没有 npm 发布、Windows 打包或合并 main。
