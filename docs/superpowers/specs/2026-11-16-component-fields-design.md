# 组件可编辑字段约定

状态：用户已以“ok 开干”确认。实施位于 codex/studio-component-fields，验证结果见配套计划。

## 目的

组件作者显式声明 Studio 可编辑的 props 与编辑方式；画布上的 DOM 标记仅定位字段。字段内容只存于页面上的组件 props，面板和画布共用写回路径。使用现有 Vue、studio YAML、Tiptap、素材 API 和 runtime，不引入基类、通用脚本执行器、组件实例注册中心或新的文稿格式。

## 方案与推荐范围

采用现有 `<studio>` 元数据扩展；相比继承基类，Vue 组件无需改变实现方式；相比继续推断任意 DOM，作者可以明确指定可编辑边界。

分两步交付：
1. 本轮实施字段声明、静态值写回、富文本和图片编辑，用一个独立图文选项示例验证实际答题。此阶段可独立验收。
2. 字段路径验证后，再迁移现有题目模板与配置，移走题目控件里的题干/选项文案。第二步的数据迁移与旧稿取舍尚未批准，本轮不自动执行。

本轮不是只提供一个无实际用途的字段示例：图文选项必须连接已有 useQuiz，编辑与预览隔离、运行时正常作答并展示选中/正确/错误外观。

## 前置工作

main 当前为 ec7f26d。组件 snippet 修复在 codex/studio-authored-snippets、文字 B 方案在 codex/studio-text-paths，均为未提交工作树。新实现必须基于二者集成后的工作分支，不在 main 旧文字路径上再加分支，不覆盖二者现有改动。实施时允许在任务分支整合已授权修改；提交、推送、合并 main 按用户实际授权处理。

## 声明与兼容

建议新增 `propsMode: declared`，用于显式暴露模式：

```vue
<studio lang="yaml">
propsMode: declared
snippet: '<EditableOptionCard question="q1" option="A" content-html="选项文字" image-src="" />'
preview: '<EditableOptionCard question="" option="A" content-html="图文选项" image-src="" />'
props:
  contentHtml:
    label: 选项文字
    control: richtext
  imageSrc:
    label: 选项图片
    control: image
  imageAlt:
    label: 图片说明
    control: text
</studio>
```

- declared 模式只展示 props 列出的非 hidden 字段；未声明内部字段不自动暴露。没有 propsMode 的旧组件沿用已有推断，避免本轮隐式取消其他组件能力。
- defineProps 继续用于校验/补充默认值与基础类型，不能扩大 declared 白名单。构造默认 snippet 所需的类型信息与表单可见性分开处理。
- PropControl 新增 richtext、image；既有 text/number/boolean/select/color 等继续使用。首版新路径只编辑静态 string 字段，不支持嵌套路径、数组项定位、函数或任意 JS 求值。
- hidden 与 hideComponents 仅控制组件库入口。已存在于页面中的、符合单根与源码定位条件的组件仍需可读取元数据；目录数据保留 hidden 标记，库列表过滤它。不能再次将组件库清单当成整个可编辑组件集合。
- 显式 snippet、preview 不被未知标签处理改写，依赖前置修复。

## DOM 与字段所有权

```html
<div data-studio-component="EditableOptionCard">
  <div data-studio-field="contentHtml" v-html="contentHtml" />
  <img data-studio-field="imageSrc" :src="imageSrc" :alt="imageAlt">
</div>
```

- 单击选中、移动、缩放、旋转都作用于组件的定位根。字段区域不是新画布对象，不具有独立位置、图层或复制身份。
- 标记使用 prop 的 camelCase 名称；页面标签的 kebab-case/camelCase 由已有属性匹配规则识别。
- 只有最近的、可确定源码范围的组件拥有字段标记。嵌套 Vue 子组件的字段不能误算到外层；采用新字段约定的组件必须在根显式标记 `data-studio-component="组件名"`；字段解析只在最近的该边界内匹配，不能匹配页面源码时不继续向外猜测。嵌入其他组件时，字段标记由其所属组件负责，父组件不能代用。
- 首版约定一个字段有一个直接 DOM 编辑区域；重复/缺失区域或无法确定归属时，面板仍显示字段，但画布入口提示无法定位，不猜测目标。
- 富文本区域为专用 div，内部仅呈现该字符串；不得包含组件实例、模板绑定或其他可编辑字段。图片标记位于真实 img。
- 图片为空时保留可识别的图片区域或占位，选中组件后始终能从面板设置图片。

## 交互约定

- 组件单击选中整体；双击 richtext 区域编辑字段，文字控件仍使用现有 Home/Tiptap。
- 图片区域单击定位到相应属性操作，提供从文件/素材库替换与清除。无需新增图片子对象、裁剪系统或组件内部布局工具。
- 组件字段面板提供 richtext 的“编辑内容”入口、image 的预览与替换入口。没有可定位的富文本 DOM 时使用受支持字符串的源码字段编辑；不伪造 DOM 内容作为原始值。
- F2：命中字段时编辑对应文字；没有明确字段时，只有一个可定位富文本字段可直接进入；多个字段则显示字段面板，不随意选择第一个。
- 保留 B 方案的“编辑组件标签”入口，用于动态表达式和高级源码。
- 应用是一次正文写回/撤销步骤；取消恢复被临时编辑的 DOM；未修改不写回。字段会话沿用 B 方案生命周期，不恢复旧 HTML/container 编辑器。

## 字段读取与写回

1. 从已选组件的源码标签读取 prop，不能从已渲染 DOM反推作者值。
2. 接受普通字符串属性及可确定的字符串字面量绑定；使用既有 literals/tag 工具，不 eval。支持 JSON 双引号字符串、现有解析工具可准确读取的单引号字符串；不实现新的通用 JS parser。
3. 缺失属性可使用可解析的静态字符串默认值；没有明确默认值时提示先在源码配置，不能把未知值视为空。清空字段写入空字符串，恢复默认值则是独立的删除属性动作，二者不能混淆。
4. 对表达式、v-bind 对象、动态属性名、同名重复绑定，字段显示“由代码控制”，禁用可视化覆盖并保留源码入口。
5. 富文本 HTML 先经过已有 prepareTextHTML 检查；不支持的语法进入源码，未经修改不规范化。新增字符与格式写回 HTML 字符串，不能当模板展开或作为 JS 执行。
6. 新路径的 string 写回统一使用 JSON.stringify 后的字符串绑定，再进行属性层实体转义：先编码 &，再编码尖括号/引号等；读取按相反层次解码。保证引号、&、实体、换行和中文往返准确；不复用会根据内容猜测数组/数字的通用 writeProp。
7. 只替换目标组件开标签中的字段；其余属性、slot 源码、位置、动画和相邻内容保持不变。读取返回目标范围/字段和值，提交前沿用当前页与目标源码检查；发现目标变化提示重新打开，不增加自动重定位恢复队列。
8. 图片使用现有素材上传与 public 相对路径约定，替换字段不改变组件几何。组件本身负责在有 Vite base 的工程中正确解析图片路径；示例使用项目已有资源路径约定，不新增全局 URL 重写系统。

## 模块边界

- shared/catalog.ts：元数据类型、propsMode、hidden 标记、richtext/image 控件类型。
- node/metadata.ts、node/catalog.ts：声明解析、完整组件目录和可见性；不执行字段值或业务脚本。
- client/md/component-fields.ts（新增）：纯源码字符串读取/编码/局部写回，复用 tags/literals。
- client/component-fields.ts（新增）：组件根与字段 DOM 归属、声明查找、字段编辑目标描述；不注册题目或发网络请求。
- client/composables/useTextEditor.ts、client/ui/InlineEditor.vue：在 B 方案三条路径上承接字段目标，复用一个 Tiptap 引擎与会话生命周期。
- client/composables/useImageInsertion.ts：扩展现有图片请求目标，复用文件选择、上传、素材库；不会为每种组件新增图片服务。
- client/ui/parts/PropField.vue、PanelInspect.vue、selection-target/useSelection：面板入口与双击路由。业务题目选择器仍属题目专用 UI，本轮不增加通用 action 注册表。
- playground/components/EditableOptionCard.vue：字段约定的真实 Vue 使用者，通过 runtime 公共 useQuiz/useStudioContext 执行业务；runtime 不导入 client。

## 题目验证示例与后续迁移

本轮图文选项 props 为 question、option、contentHtml、imageSrc、imageAlt；后两类视觉内容存于选项自身。字段声明只暴露视觉内容，示例 question/option 在源码绑定已有题目，暂不新增业务字段选择器。

渲染：可定位外框、可富文本编辑区域、图片区域。一个整体移动；内部布局由 Vue 模板/CSS 管理。组件代码负责从 question.mode 选择 choose 或 set-option，读取已有 selected/result/correct，检查 active，提供键盘激活与相应 ARIA 状态。多选继续使用现有 submit/clear-pending 按钮。不得以绑定字符串运行脚本。

控制器继续使用当前 QuizConfiguration 接口。示例为兼容该接口填写最小 label（选项 ID），不复制 contentHtml 的显示内容。用普通文本框表示题干，示例体现视觉内容与答题规则独立。现有标准题目生成器/StudioButton/StudioQuestionTitle/StudioFeedback 在本轮不迁移。

下一轮候选：控制器配置去掉题干与选项文案依赖；统一标准选项与自定义选项的字段编辑；题干由普通对象承载；明确反馈文案归属；更新复制时 question ID 重映射和关联线。这一轮须先选择旧稿保留、手动转换或一次性迁移策略，避免静默修改用户文稿和建立长期双模型。

## 验证边界

复用已有目录、源码、富文本、图片、题目与 runtime 用例。新增测试只覆盖真实新增契约：declared 白名单、隐藏组件仍可编辑、字符串往返、动态值拒绝覆盖、字段整体归属、一次保存/取消、图片目标写回，以及图文选项使用现有答题状态。单元测试不替代浏览器输入法/剪贴板/原生文件对话框验收。

完整改动集中运行 pnpm test、pnpm typecheck、图文选项示例静态构建及必要的修改 SFC 开发编译检查；UI 默认最多截图，无自动点击/输入，无新增大型 CI/E2E 环境。
