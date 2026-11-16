# 文本框与工程字体实施计划

用户已确认上一轮方案并要求计划后连续实现。使用 writing-plans / executing-plans，主 agent 实现，末尾一次独立代码审阅。

## 已确认范围与实现选择

- 保留 Tiptap、标准 HTML、现有 v-drag、源码提交和撤销；不更换编辑器，不增加依赖、服务或数据库。
- 文本框提供自动高度/固定大小、固定框八向尺寸调整、顶部/居中/底部对齐、四边内边距、溢出提示。旧框不自动迁移；用户调整框布局时用单个普通内容 div 保持混合行内文字与多段落，不裁剪或自动缩字。
- 字体选择提供搜索、中英文样字预览、工程字体与本机候选分类，继续允许手工输入字体族；本机候选不声称已经安装。
- 字体导入接受 WOFF2/WOFF/TTF/OTF，导入时填写字体族、字重和常规/斜体。优先明确字段，不增加字体解析依赖。浏览器 FontFace 实际加载验证后保存；无转换或中文子集化。
- 文件保存在 public/fonts/，注册保存为 public/fonts/studio-fonts.css 标准 @font-face CSS。CSS 是唯一登记来源；不添加私有字体数据库。新增字体接口属于已有 dev-only 素材 API；生产构建仅加入静态 CSS 引用，不保留写接口。
- Vite 虚拟 CSS 入口加载标准注册，处理开发/生产与 base；导入后即时更新字体样式。工程 ZIP 和静态网页导出沿用原 public/ 文件链路。保留作者其他字体配置，不自动下载外部字体。真实探针确认 Slidev 开发页绕过常规 HTML 注入，因此用现有虚拟模块模式接入。
- 不发布、升级已有工程、制作 Windows 安装包或合并 main；截图可选，不自动点击/填写浏览器。

## Task 1：文本框布局

文件：client/md/elements.ts、client/composables/useTextEditor.ts、useTransformGizmo.ts、client/ui/SelectionLayer.vue、client/ui/parts/TextBoxFields.vue、client/ui/panels/PanelInspect.vue、test/elements.test.ts、既有 rich-text 测试。

接口：readTextBoxLayout(content, range) 读取 v-drag 高度与框属性；patchTextBoxLayout(content, range, patch) 同步普通根样式、内容容器及高度；现有 readTextContent/replaceTextContent 透明保留容器。resizeElement 不再拒绝固定框高度，水平调整保留其高度；自动框仍自动高度。

- [ ] 补充关键源码行为测试并观察失败：模式切换、固定尺寸保留、混合内容与容器编辑、邻居/样式保持。
- [ ] 实现 source 操作、编辑挂载、固定框 handles 与检查器；延用现有面板视觉。
- [ ] 运行 elements、rich-text 与相关 gizmo 既有检查。

## Task 2：工程字体保存与加载

文件：shared/fonts.ts、node/fonts.ts、node/plugin.ts、client/composables/useDeckApi.ts、test/fonts.test.ts。

接口：GET @studio/fonts 返回 { css }；POST @studio/fonts 接收 {name,data,family,weight,style} 并返回 {css}。readFontCSS(options) / saveFont(options,payload) 负责标准 CSS 与真实文件；CSS 路径常量在 shared/fonts.ts。上传重用现有素材命名与写入，不污染普通图片/媒体列表。virtual:slidev-studio/fonts.css 在编辑和构建中引用同一 CSS，尊重 base；字体修改只使虚拟模块失效供下次刷新读取，不强制重载编辑页。

- [ ] 真实临时文件与工程 ZIP 测试先失败：字体字节、字重/斜体 CSS、重名、已有注册保留、工程归档携带。
- [ ] 实现字体保存和 GET/POST，复用素材文件 helper；不改媒体 AssetKind 的产品含义。
- [ ] 运行 fonts、assets、project 相关检查。

## Task 3：字体选择与交付

文件：client/ui/parts/FontPicker.vue、TextElementFields.vue、client/fonts.ts、两种语言字典、现行文档。UI 使用 frontend-design 的原则，跟随现有 Studio 视觉，不另建视觉系统。

- [ ] 接入搜索、样字、来源分类、导入表单及 FontFace 加载校验，保持编辑选区和字体手工输入；解析 CSS 使用浏览器 CSSOM，编辑器格式仍走已有 text.run。
- [ ] 更新使用、限制、开发和当前状态说明。
- [ ] 一次完整 vitest、tsc、Vue SFC、真实 Slidev 构建与 HTTP 字体字节/归档检查；不做浏览器自动交互。
- [ ] 一次独立审阅，处理实际核心问题；稳定说明并入现行文档后删除此计划。

## 重点验证

旧自动框继续兼容；固定框移动/水平调整不丢高度；框内容不被编辑器额外重写；导入字体可立即用于当前编辑与最终网页；本机候选不承诺便携；字体字重/斜体按导入字段注册；工程与网页均携带文件和标准 CSS。
