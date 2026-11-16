---
theme: default
addons:
  - .
layout: none
title: 组件字段与单选
---

<div data-studio-element="text" v-drag="[60,35,840,NaN]" style="font-size:32px"><p>哪张图片是横向风景？</p></div>

<StudioQuestion question="field-single" name="图文单选" mode="single" :options="[{ id: 'A', correct: true }, { id: 'B', correct: false }]" v-drag="[60,110,220,32]" />

<EditableOptionCard question="field-single" option="A" content-html="&lt;p&gt;宽阔的 &lt;strong&gt;横向风景&lt;/strong&gt;&lt;/p&gt;" image-src="/samples/landscape.svg" image-alt="横向风景" v-drag="[60,180,400,150]" />

<EditableOptionCard question="field-single" option="B" content-html="&lt;p&gt;竖向构图&lt;/p&gt;" image-src="/samples/portrait.svg" image-alt="竖向构图" v-drag="[500,180,400,150]" />

<StudioFeedback question="field-single" idle-text="请选择一项" v-drag="[60,365,840,56]" />

<p v-drag="[60,440,840,60]">编辑时双击卡片文字；选中图片后在属性面板替换。预览时点击或按 Enter / 空格答题。</p>

---
layout: none
title: 组件字段与多选
---

<div data-studio-element="text" v-drag="[60,35,840,NaN]" style="font-size:32px"><p>选中两种构图，再确认答案</p></div>

<StudioQuestion question="field-multiple" name="图文多选" mode="multiple" :options="[{ id: 'A', correct: true }, { id: 'B', correct: true }]" v-drag="[60,110,220,32]" />

<EditableOptionCard question="field-multiple" option="A" content-html="&lt;p&gt;横向构图&lt;/p&gt;" image-src="/samples/landscape.svg" image-alt="横向风景" v-drag="[60,170,400,150]" />

<EditableOptionCard question="field-multiple" option="B" content-html="&lt;p&gt;竖向构图&lt;/p&gt;" image-src="/samples/portrait.svg" image-alt="竖向构图" v-drag="[500,170,400,150]" />

<StudioButton question="field-multiple" action="submit" content-html="&lt;p&gt;确认答案&lt;/p&gt;" v-drag="[60,355,190,52]" />

<StudioButton question="field-multiple" action="clear-pending" content-html="&lt;p&gt;清空选择&lt;/p&gt;" v-drag="[280,355,190,52]" />

<StudioFeedback question="field-multiple" idle-text="选择后确认" v-drag="[60,435,840,56]" />
