---
title: 人机协同制作
theme: default
addons:
  - slidev-addon-studio
layout: none
---

<div data-studio-element="text" v-drag="[60,35,840,NaN]" style="font-size:38px"><p>今晚的分享嘉宾</p></div>

<GuestSpotlight content-html="&lt;p&gt;&lt;strong&gt;林澈&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;从一个想法，到一场值得分享的活动。&lt;/p&gt;" image-src="/portrait.svg" image-alt="示例头像" accent="#38bdf8" v-drag="[60,135,840,250]" />

<div data-studio-element="text" v-drag="[60,415,840,NaN]" style="font-size:22px"><p>标题可以独立移动。卡片整体拖动，双击内部文字修改介绍，在属性面板换头像。</p></div>

<!-- agent 修改光效时保留以上 v-drag 和用户文案。 -->

---
layout: none
title: 共用答题逻辑
---

<StudioQuestion question="handoff-question" name="人机协同" mode="single" :options="[{ id: 'A', correct: true }, { id: 'B', correct: false }]" v-drag="[60,20,220,32]" />

<div data-studio-element="text" data-studio-question-ref="handoff-question" v-drag="[60,80,840,NaN]" style="font-size:32px"><p>修改哪一项不需要重新编写光效？</p></div>

<StudioButton question="handoff-question" action="choose" option="A" content-html="&lt;p&gt;嘉宾姓名与头像&lt;/p&gt;" v-drag="[60,195,400,90]" />

<StudioButton question="handoff-question" action="choose" option="B" content-html="&lt;p&gt;光效的运动规则&lt;/p&gt;" v-drag="[500,195,400,90]" />

<StudioFeedback question="handoff-question" idle-text="进入预览后选择答案。" correct-text="答对了，内容字段与光效实现分开。" incorrect-text="运动规则由 agent 改代码，姓名和头像留给人微调。" v-drag="[60,330,840,70]" />

<StudioCorrectCount label="本次答对" v-drag="[60,435,340,48]" />

---
layout: none
title: 继续制作
---

<div data-studio-element="text" v-drag="[60,50,840,NaN]" style="font-size:36px"><p>准备好素材，完成最后的微调</p></div>

<StudioCorrectCount label="上一页累计答对" v-drag="[60,160,440,64]" />

<div data-studio-element="text" v-drag="[60,280,840,NaN]" style="font-size:24px"><p>从“插入 → 素材”添加音频、视频或图片。</p><p>音视频默认手动播放，选中后可替换文件、调整音量和起播时间。</p><p>回到编辑会重置本次试播；最终交付前在现场设备上播放自己的素材。</p></div>

---
layout: none
title: 原生音视频
---

<div data-studio-element="text" v-drag="[60,35,840,NaN]" style="font-size:34px"><p>替换素材，保留排版</p></div>

<StudioMedia kind="video" src="/intro.mp4" :muted="true" v-drag="[60,120,520,293]" />

<StudioMedia kind="audio" src="/chime.wav" :volume="0.3" v-drag="[620,120,280,100]" />

<div data-studio-element="text" v-drag="[620,250,280,NaN]" style="font-size:20px"><p>视频和提示音均为自生成样例。进入预览后手动播放；编辑时不出声。</p></div>
