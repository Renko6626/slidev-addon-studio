# 多选与排版实施记录

目标：当前页独立定位对象支持 Shift 点选、框选、批量移动、复制、删除、对齐和等距分布，每个动作只写入一次历史。

沿用 Vue、StudioTarget、v-drag 与 Markdown 写回。没有持久分组、批量缩放旋转或新对象存储。

用户已确认选择方案：保留主 selection 并增加临时目标集合，兼容既有单选调用。另一可行方案统一迁移为数组会牵涉文字、形状与属性链路，回归面更大。

- [x] 准备纯几何排版与倒序批量源码工具，补充关键行为测试。
- [x] 在接口获准后接入选择、框选与多对象拖动。
- [x] 接入工具栏、属性区、复制粘贴和快捷键。
- [x] 集中运行相关检查，记录未验证范围并提交。

验证仅使用现有测试与必要新行为测试；页面验证最多导航截图，不自动进行交互测试。


实现：`state.selectedTargets` / `setSelectedTargets` 是当前页临时选择，`selection` 仍是既有主对象。外部设置新主对象或 null 会收束到单选。`describeTarget` 导出现有来源解析器，图层面板可复用。`StudioContext.selectInsertedMany` 和 gizmo 的 `getTargets` 均为可选兼容接入。

多选资格：有确定源码范围和独立 v-drag 位置的 Studio 文本框、图片、形状，以及可确定的组件；排除嵌套范围、frontmatter 内容和背景 marker。独立包装器可作为组件根接入。普通文档流保持单选体验。框选以可见对象的屏幕包围盒相交判断；Shift 框选累加。

对齐使用选区视觉包围盒，居中按整个选区中心；等距需要至少三个对象，固定两端，均分对象边缘间隙。批量移动只加相同坐标增量，保留每个对象的原始宽高、自动高度、旋转和其他属性。排版与快捷键移动会重渲染后重新绑定多个范围；拖动沿用直接绘制 DOM 与 skipHmr。

批量复制与粘贴仍是现有 CopiedBlock/version 1/MIME。多个完整对象源码以空行连接保存到既有 source 字符串；粘贴复用纯 scanTags 扫描器识别不同顶层容器中的定位根，逐对象偏移后合成一次 commit。单个容器内部的定位子对象不会被拆散。未增加 version、blocks、ID 或持久分组模型。

验证：

- `node node_modules/typescript/bin/tsc --noEmit`：通过。
- `node node_modules/vitest/vitest.mjs run test/multiselect.test.ts test/pointer-interaction.test.ts test/object-clipboard.test.ts test/clipboard.test.ts test/shape-tools.test.ts test/elements.test.ts test/i18n.test.ts --root /data/sunyunbo/www/better-ppt/.worktrees/studio-multiselect`：首轮 7 文件 41 条通过；新增实际历史撤销与框选断言后，仅重跑受影响三个文件，26 条通过。
- 使用 `@vue/compiler-sfc` 的 parse/compileScript/compileTemplate 编译 SelectionLayer、StudioRoot、StudioToolbar、PanelInspect 与 ArrangeSelection：通过。
- `git diff --check`：通过。

未进行浏览器交互测试、截图或完整 Slidev 打包；最终整合验收由主 agent 执行。未新增永久组合、批量缩放或旋转、动画、多页选择。遇到外部手改源码使范围不可解析时沿用现有选择解析限制，不增加稳定 ID 或恢复队列。

合并注意：state.ts 与阶段2只有添加选择状态和 PanelId 的局部重叠；StudioToolbar、i18n、styles 为独立新增入口与追加键。useSelection 文件末尾固定一行 `export { describe as describeTarget }` 与阶段2复用；阶段3 targetFrom 背景过滤须保留。PanelInspect 阶段3的图片裁剪字段应保留在单选分支，多选分支仅显示排版控件。
