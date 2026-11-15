---
theme: default
addons:
  - .
layout: none
title: 共享题目状态
---

<h1 v-drag="[60,30,840,64]">同一道题，两种计数显示</h1>

<StudioQuestion question="shared-example" mode="single" title="哪种状态只属于本次浏览器试播？" :options="[{ id: 'A', label: '已选答案与正确次数', correct: true }, { id: 'B', label: '保存到文稿中的题干', correct: false }]" idle-text="请选择一项。" correct-text="回答正确。两处计数都读取同一份状态。" incorrect-text="题干是配置；答案和次数保存在内存中。" v-drag="[60,100,220,36]" />

<StudioQuestionTitle question="shared-example" v-drag="[60,140,840,56]" />

<StudioButton question="shared-example" action="choose" option="A" v-drag="[60,220,405,76]" />

<StudioButton question="shared-example" action="choose" option="B" v-drag="[495,220,405,76]" />

<StudioFeedback question="shared-example" v-drag="[60,320,840,54]" />

<StudioCorrectCount label="内置显示" :font-size="22" color="#2563EB" v-drag="[60,420,260,48]" />

<QuizProgress label="自定义显示" :font-size="26" color="#047857" v-drag="[410,405,490,86]" />

---
layout: none
title: 跨页读取与整场重置
---

<h1 v-drag="[60,40,840,64]">切页保留正确次数</h1>

<p v-drag="[60,145,840,96]">这页没有第二套计分逻辑。自定义 QuizProgress 通过公共 useQuiz() 读取同一个 correctCount；点击“重新试播”会清空本次试播全部题目的答案和计数。</p>

<QuizProgress label="本次练习" :font-size="32" color="#7C3AED" v-drag="[60,290,720,98]" />

<p v-drag="[60,420,840,64]">在 Studio 编辑位置、外框和字号。预览、放映时位置固定，编辑画布与组件库中的重置按钮不可用。</p>
