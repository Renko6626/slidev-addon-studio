---
theme: default
title: Slidev Studio playground
addons:
  - .
mdc: true
transition: fade
layout: center
---

# Slidev Studio

Press <kbd>E</kbd> to open the editor, then click anything on this slide.

---

# Click to select

Every block here maps back to a line in `playground/slides.md`.
Select one and the Element panel shows the exact Markdown behind it.

- Headings, paragraphs, lists and quotes
- Plain HTML elements
- Vue components

<Badge label="a component" />

---

# Props, without leaving the canvas

Select the shape and the Element panel offers its props. The picker below is not
hardcoded: `Shape.vue` declares that its `name` prop comes from `./shapes/*.svg`,
so the editor lists whatever is in that folder.

<Shape name="hexagon" :size="150" caption="A hexagon" />

---

# Lists are rows, not blobs

A prop holding records is edited as one row per entry, with a field per key.
The fields come from the type the component declares, so an empty list still
knows what it wants.

<Milestones :items="[
  { year: '2019', text: 'First talk', highlight: false },
  { year: '2024', text: 'Fiftieth talk', highlight: true },
]" />

---

# Drag anything

<Note>
Drag a block on the canvas and Studio gives it a free position, writing the
coordinates back into the Markdown. The Element panel sends it back into the
document flow whenever you want.
</Note>

---

# Animate

<v-click>

This heading's paragraph appears on a click, because the Animate panel wrapped
it in `<v-click>`.

</v-click>

<v-clicks>

- Lists can reveal one item at a time
- Which is a `<v-clicks>` wrapper
- With `every` and `depth` to tune it

</v-clicks>

---
layout: center
---

# Everything is just Markdown

Close the editor, open `playground/slides.md`, and every change you made is
there as an ordinary diff.

---

# MARKER-DELTA

---
layout: default
---

# Text boxes and pictures

<div data-studio-element="text" v-drag="[45,120,360,NaN]" style="font-size:28px;line-height:1.5;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;margin:0;padding:0;color:#345d59"><div>从这里开始制作</div><div>双击修改文字，保留 <b>重点内容</b>。</div><div>调整宽度，文字会自动换行。</div></div>

<img data-studio-element="image" v-drag="[460,120,460,259]" style="object-fit:contain;object-position:center;max-width:none;margin:0;display:block" src="/samples/landscape.svg" alt="山间小路与远处的太阳" />

<div data-studio-element="text" v-drag="[460,410,450,NaN]" style="font-size:20px;line-height:1.3;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;margin:0;padding:0">图片支持等比缩放、更换和完整显示。</div>

---
layout: default
---

# Picture frames

<div data-studio-element="text" v-drag="[50,100,240,NaN]" style="font-size:24px;line-height:1.3;text-align:center;min-height:1em;margin:0;padding:0">完整显示</div>

<img data-studio-element="image" v-drag="[50,145,240,320]" style="object-fit:contain;object-position:center;max-width:none;margin:0;display:block;background:#eef2f1" src="/samples/landscape.svg" alt="完整横图放入竖向外框" />

<div data-studio-element="text" v-drag="[365,100,240,NaN]" style="font-size:24px;line-height:1.3;text-align:center;min-height:1em;margin:0;padding:0">填满外框</div>

<img data-studio-element="image" v-drag="[365,145,240,320]" style="object-fit:cover;object-position:center;max-width:none;margin:0;display:block" src="/samples/landscape.svg" alt="横图居中填满外框" />

<div data-studio-element="text" v-drag="[680,100,240,NaN]" style="font-size:24px;line-height:1.3;text-align:center;min-height:1em;margin:0;padding:0">更换为竖图</div>

<img data-studio-element="image" v-drag="[680,145,240,320]" style="object-fit:contain;object-position:center;max-width:none;margin:0;display:block" src="/samples/portrait.svg" alt="竖图完整显示在相同大小的外框中" />
