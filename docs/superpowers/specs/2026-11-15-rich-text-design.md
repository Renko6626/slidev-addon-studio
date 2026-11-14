# Studio 文本框富文本编辑

用户已选择 B（Tiptap/ProseMirror），并授权细化、制定计划后直接实施，不再增加设计或计划批准步骤。

## 目标

对标桌面 PowerPoint 的文字操作：同一工具栏根据对象选中、文字选区、光标三种状态执行整框格式、局部格式和后续输入格式。点击格式工具保持编辑与选区，输入与格式可撤销，段落和列表操作在画布上完成。

本阶段完整能力限定于 `data-studio-element="text"` 的 Studio 文本框。普通 Markdown、frontmatter 字符串及复杂组件沿用原编辑路径。图片、拖动、画布、页面历史和素材目录保持既有职责。

## 已选方案与取舍

- A：继续扩展原 contenteditable/DOM 标签操作，依赖少，但选区、局部格式和撤销需要自行维护。
- B（用户已选择）：用 Tiptap/ProseMirror 管理文本框内文，复用文字选区、命令及历史。接受新增编辑依赖和适配工作；不改变文稿存储格式，不把整个幻灯片改造成富文本编辑器。

## 交互与格式

- 支持字体名称（常用候选并可输入）、字号输入/常用档位、颜色、粗体、斜体、下划线、删除线及清除局部格式。字号继续使用画布 CSS px，不偷偷转换现有文稿尺寸。
- 选中文字只改所选范围；光标无选择时设置后续输入的格式；只有文本框被选中时命令作用于全部文字。字号/字体/颜色和段落格式混合时显示“混合”，按钮提供混合状态。
- 顶部“开始”中的字体与段落工具和右侧详细字段共用一个命令/状态来源。常用操作包括对齐、项目符号、编号、增加/减少缩进、行距。字号、颜色输入取得焦点时保存编辑器自己的文字选区，命令执行后回到文字继续输入。
- Enter 新段落，Shift+Enter 段内换行；列表中 Tab/Shift+Tab 调整层级，空列表项继续 Enter 退出列表。中文输入法组合期间 Enter/Esc 不被 Studio 当作提交或退出。
- 保留双击进入文字编辑；进入后由文字编辑器处理选词和范围选择。F2 在对象选中/文字编辑间切换；Esc 或 Ctrl/Cmd+Enter 应用并退出；浮动取消按钮放弃当前编辑。新文本框仍全选占位内容。
- 点击其他对象提交并切换，点击幻灯片空白提交并取消选择，沿用上一阶段。点击文字格式工具不触发外部提交。
- 编辑期间 Ctrl/Cmd+Z、重做快捷键和顶栏按钮使用当前文本框的编辑历史，覆盖输入、格式和段落命令；退出后现有文稿历史把本次文字编辑作为一次操作。重新进入文本框开启新的文字编辑历史，不建设跨会话全局事务系统。
- 普通粘贴按支持的文字结构/格式解析，纯文本粘贴使用浏览器对应快捷键；不承诺复制 Office 页面布局。保留已有链接和行内代码。
- 内边距、垂直对齐、固定高度、自适应缩字、字体安装、WordArt、字符间距、跨框流式文字均不在本阶段。

## 实现边界

- 使用 `@tiptap/core`、`@tiptap/pm`、`@tiptap/starter-kit`、`@tiptap/extension-text-style`、`@tiptap/extension-text-align` 的同一固定 3.x 版本。现有 Vue composable 持有实例；直接挂载真实文本框内，不额外引入 Vue 编辑器视图封装。
- `client/text/` 只负责支持的 schema、命令、格式摘要、HTML 读写。`useTextEditor` 负责编辑实例和工具栏衔接。`InlineEditor` 保留应用/取消和旧内容的编辑路径；`StudioRoot` 提供文字服务。
- 内部使用编辑器文档状态，持久化仍为已有根 div、v-drag 与 HTML 内文。paragraph/span/list 的必要展示样式随 HTML 保存，静态放映无需编辑器或仅开发模式 CSS。根元素位置、尺寸、旋转和已有默认样式保留。
- 支持现有纯文本、换行、div 行容器、p、基本行内标记、链接、列表。打开且未修改时不规范化重写文件。无法无损表达的自定义 HTML/属性直接使用源码编辑并明确提示，避免 schema 静默丢内容；不自动迁移旧 Markdown。
- 清除格式恢复文本框已有默认样式，不擅自改变主题或根元素样式。字体名称由浏览器解析，未安装的字体按现有字体回退规则显示。
- 不引入服务器接口、数据库、持久对象 ID、请求队列、自动恢复状态机、付费云编辑服务或协作系统。

## 布局

沿用现有深色工作区和控件样式（frontend-design 仅用于控件分组和密度），不做整站视觉重设计：

    字体 [名称] [字号] [颜色]  B I U S 清除格式
    段落 [左 中 右 两端] [项目符号 编号] [减缩进 增缩进] [行距]

右侧保留完整字段及“整框 / 所选文字 / 后续输入”的作用范围提示。浮动条保留完成、取消、源码入口，避免再维护一套不同的格式动作。

## 验证

在现有 Vitest 中为实际 Tiptap 行为增加一个 jsdom 测试文件。jsdom 仅作为 devDependency，用于运行真实 Editor/DOM API，不建设端到端环境或手写大型 DOM 替身。重点覆盖部分文字取消粗体、光标格式、混合格式、段落/列表、编辑历史、HTML 往返与不支持内容保留。

集中运行已有测试、TypeScript、Vue SFC 类型检查以及开发页与静态构建编译。浏览器仅打开和截图，不自动点击、输入、拖动或跑交互流程；中文输入法、系统剪贴板、真实选区及焦点手感由用户试用。

## 对照资料

- Microsoft：添加文字 https://support.microsoft.com/en-gb/powerpoint/add-text-to-a-slide
- Microsoft：段落格式 https://support.microsoft.com/en-gb/powerpoint/change-text-alignment-indentation-and-spacing-in-powerpoint
- Microsoft：快捷键 https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations
- Tiptap：命令/焦点 https://tiptap.dev/docs/editor/api/commands
- Tiptap：TextStyleKit https://tiptap.dev/docs/editor/extensions/functionality/text-style-kit
- Tiptap：撤销 https://tiptap.dev/docs/editor/extensions/functionality/undo-redo
