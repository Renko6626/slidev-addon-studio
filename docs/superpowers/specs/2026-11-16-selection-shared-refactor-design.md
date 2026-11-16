# 共用类型与选择模块整理设计

状态：用户已以“开干”确认本方案；2026-11-16 已在 codex/studio-selection-shared 隔离工作树完成实施和验证。npm 发布与桌面打包不在本轮范围，分支集成状态以 Git 记录为准。

## 目的与范围

对应本轮代码检查建议 2、3：消除客户端与 Node 的元数据重复定义，将两端共用的纯 HTML 扫描移入 shared，并从 useSelection 提取目标识别及渲染后的重新定位。保持现有功能、源码格式和交互语义。

基线：main / a81161b。已有基线验证为 pnpm test（345 通过，1 项可选 HTTP QA 跳过）及 pnpm typecheck 通过，记录来自本次检查前一轮。

## 方案与取舍

推荐局部提取：复用既有 shared、composables 目录，保留 useSelection 的调用接口，按现有职责移动代码。优点是依赖方向明确、可用已有测试确认行为；代价是增加少量文件和类型转导出。

仅移动文件、不统一类型，无法解决重复定义和调用方耦合；全面引入编辑器 store、对象模型或交互状态机则超出本轮需要。useTransformGizmo 的几何与绘制拆分留待实际修改时再讨论。

## 模块职责与依赖

```text
shared/catalog.ts             共用 Prop*、组件/布局目录数据类型
shared/html-scan.ts           现有纯 HTML 扫描器
node/metadata.ts              YAML 元数据解析、文件选项解析
node/catalog.ts               目录发现与组装，使用 shared 类型
client/types.ts               DOM 编辑目标、位置及客户端加载能力
client/selection-target.ts    DOM 命中、目标描述、源码映射、多选资格
client/composables/
  useSelectionRebind.ts       重选、新插入对象定位、DOM 替换观察
  useSelection.ts             选择事件、框选、键盘与编辑入口的组织
  useTransformGizmo.ts        保持现状
```

- shared 不依赖 client、node、DOM、Vue、Pinia 或文件系统。
- client 与 node 均向 shared 依赖；不再由 client/md/batch 导入 node/html-scan。
- selection-target 可使用 DOM 与现有源码定位函数，不读写编辑器全局状态，不注册事件。
- useSelectionRebind 沿用现有 selection、selectedTargets、studioOpen，拥有 MutationObserver 的创建与释放。
- useSelection 组合目标识别和重选能力，保留原参数与返回方法；PanelLayers 改为直接依赖目标识别文件。

## 行为约束

- 保留 PropMeta 的全部既有字段，包括 Node 当前独有的 bind?: boolean。本轮只统一声明，不改变 bind 的写回解释。
- 共用目录类型只包含可传输数据；load?: () => Promise<any> 留在客户端扩展类型中。现有导出名称通过类型转导出或别名保留。
- HTML 扫描仅移动路径，保持算法、行范围、偏移及原始文本处理。
- 保留命中顺序、当前页过滤、背景排除、Monaco 排除、穿透编辑覆盖层和不可见元素处理。
- 保留重选的范围/签名判断、1500ms 等待上限、40ms 轮询、无范围插入的既有 120ms 路径及现有取消条件；不趁拆分统一不同路径的行为。
- 保留多选整体定位、MutationObserver 生命周期、首次按下拖动、轻点不写入、双击文字编辑和右键选择。
- 不新增请求队列、重试、取消令牌、通用轮询框架、状态机或持久化字段，不迁移编辑器状态到 Pinia。
- 不涉及 runtime、Slidev 兼容适配、catalog 的解析器拆分、UI 样式、功能扩展、发布或桌面打包。

## 验收

现有测试继续调用真实的源码改写、目标识别和交互实现。默认不新增永久测试；若核实关键行为缺少覆盖，仅在已有最合适的测试文件补充必要用例，保持原有断言强度。

完整改动后集中运行 pnpm test、pnpm typecheck、一次 playground 静态构建及 git diff --check；检查客户端不再导入 node/。不执行浏览器自动交互，不扩大到 Windows 或其他 Slidev 版本。报告实际结果与未验证范围。
