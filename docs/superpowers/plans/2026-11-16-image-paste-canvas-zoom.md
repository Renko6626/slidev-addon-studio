# 图片粘贴与画布缩放

**目标：** 按用户要求快速加入系统剪贴板图片粘贴和手动画布缩放，沿用现有编辑器架构。

**实现范围：** 不增加依赖、后端接口或存储。保留当前工作区的既有改动，不提交或发布。桌面包更新本轮只调查并提出路线，未授权改变更新架构。

- [x] 粘贴：在已有对象粘贴入口识别图片文件，复用图片上传、尺寸识别、插入、选中及撤销路径。Studio 对象数据优先；输入框和文字编辑保留原生粘贴。支持剪贴板实际提供的图片数据，不下载仅作为文字提供的远程网址。
- [x] 缩放：沿用真实画布 CSS 定位和现有坐标转换。增加 25%–300% 比例选择、加减、适应窗口；Ctrl/Cmd+滚轮缩放，普通滚轮和中键拖动平移。视图状态只在编辑器内存中，不改 frontmatter 或放映尺寸。
- [x] 验证：在现有测试设施补充关键图片粘贴和视图几何行为，运行相关测试、TypeScript/Vue 检查与一次构建。浏览器只允许导航和截图，不自动点击、填写或运行交互流程。

**检查重点：** 文本编辑的粘贴归属、已有对象剪贴板优先级、无扩展名截图命名、缩放后的坐标和适应窗口复位。系统剪贴板、鼠标手感及 Windows 原生行为留给用户试用。


## 实施与验证结果

- 直接沿用现有工作区，保留已存在的桌面、发布和题目改动；没有提交、推送、打包或发布。
- 两个新增行为先由失败测试确认缺口，再完成实现。输入框与文字编辑保留原生图片粘贴；Studio 对象粘贴继续走原路径。
- 审阅发现放大时形状绘制层会盖住工具栏，已用独立视口裁剪绘制表面与预览，保留取消提示。普通滚轮仅在手动视图下平移，初始与适应窗口模式保留原行为。
- `pnpm exec vitest run test/editor-view.test.ts test/image-paste.test.ts test/object-clipboard.test.ts test/background.test.ts test/pointer-interaction.test.ts test/multiselect.test.ts test/i18n.test.ts`：45 项通过。
- 绘制层局部修正后，`pnpm exec vitest run test/shape-tools.test.ts test/editor-view.test.ts`：8 项通过（其中 5 项为前述视图测试，合计覆盖 48 项不同测试）。
- `pnpm typecheck`：通过。
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`：通过，局部修正后再次通过。
- `pnpm exec slidev build playground/slides.md --out /tmp/studio-image-paste-zoom-build-20261116`：通过。
- `git diff --check`：通过。
- 浏览器仅导航、初始化截图所需视图/绘制预览状态和只读检查，没有自动点击、输入、滚轮、拖动或粘贴。1440×900、960×720、200% 及放大绘制预览截图位于 `/tmp/studio-canvas-{fit,compact,zoom200,drawing200}.png`。200% 实际画布为 1960×1104，绘制时工具栏/面板命中不属于绘制层。浏览器报错只有已有 Wake Lock 权限提示；绘制提示另有既有 cancel 翻译键缺失警告。
- 未验证 Windows、系统剪贴板和真实鼠标手感；没有重新制作桌面包。

## 桌面一键更新调查

当前 `desktop/projects.cjs` 将 addon 指向 `file:vendor/slidev-addon-studio.tgz`，`desktop/main.cjs` 打开工程时按随附包判断准备方式；只执行 pnpm update 不能获得 npm 最新包。

建议下一阶段按工程提供“更新编辑器”：保存并停止当前编辑器，定向安装已发布的 `@renko_1055/slidev-addon-studio`（保留 `slidev-addon-studio` 别名），记录明确版本与锁文件，再启动。识别已更新工程，避免再次提示用旧随附包替换。仅更新 addon；Electron、窗口、原生文件操作、内置 pnpm 等桌面壳变更仍须重打桌面包。提供更新入口的桌面版需先发布一次；以后编辑器改动发布 npm 即可。该路线尚未实施，等待架构选择。
