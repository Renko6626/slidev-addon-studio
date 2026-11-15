---
theme: default
title: Studio Shapes
layout: default
addons:
  - .
---

# 可编辑的基础图形

从“插入 → 形状”绘制。选中图形后拖动手柄，或在右侧调整样式。

<StudioShape kind="rect" v-drag="[55,160,150,100]" fill="#DBEAFE" stroke="#2563EB" :stroke-width="2" />
<StudioShape kind="rect" v-drag="[255,160,150,100]" :radius="22" fill="#E0E7FF" stroke="#6366F1" :stroke-width="3" />
<StudioShape kind="ellipse" v-drag="[455,160,150,100]" fill="#FEF3C7" stroke="#D97706" :stroke-width="3" />
<StudioShape kind="triangle" v-drag="[655,160,150,100]" fill="#D1FAE5" stroke="#059669" :stroke-width="2" />

<StudioShape kind="diamond" v-drag="[55,310,150,100]" fill="#FCE7F3" stroke="#DB2777" :stroke-width="2" />
<StudioShape kind="hexagon" v-drag="[255,310,150,100]" fill="none" stroke="#64748B" :stroke-width="3" dash="dashed" />
<StudioShape kind="arrow" v-drag="[455,310,150,100]" fill="#E0F2FE" stroke="#0284C7" :head="0.3" :shaft="0.4" />
<StudioShape kind="line" v-drag="[655,355,150,16,-20]" stroke="#7C3AED" :stroke-width="4" :start-arrow="true" :end-arrow="true" />

<StudioShape kind="line" v-drag="[55,455,350,16]" stroke="#2563EB" :stroke-width="3" :end-arrow="true" />
<StudioShape kind="line" v-drag="[455,455,350,16]" stroke="#64748B" :stroke-width="3" dash="dotted" />
