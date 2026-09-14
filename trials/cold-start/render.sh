#!/bin/zsh
set -e
SK=/Users/lijixiang/.dimcode/v2/skills/insight-cards
OUT=/Users/lijixiang/projects/insight-studio/out/notes-trial
mkdir -p "$OUT"
cd "$SK"

node bin/make-card.mjs \
  --theme startrails --palette deep-field \
  --index 01 --total 6 \
  --title '你一直在移动，但轴心从来没动过' \
  --summary '三年换四个城市，每一次都叫重新开始，带过去的却是同一套习惯、同一批困惑。移动量很大，中心点没变——所以每一次都回到同一个地方，而不是走到新的地方。' \
  --out "$OUT/01-startrails.png"

node bin/make-card.mjs \
  --theme starfield --palette violet-night \
  --index 02 --total 6 \
  --title '真正有用的那五条，是回看的时候才被点亮的' \
  --summary '两年里记了无数东西，从不回看。被迫整理时只挑出五条，而且是当初最不觉得重要的那五条。它们当时和别的条目躺在同一个地方，差别只在于后来有没有被看。' \
  --out "$OUT/02-starfield.png"

node bin/make-card.mjs \
  --theme discharge --palette core \
  --index 03 --total 6 \
  --title '你并不是慢慢变好的，改变只在几个很短的瞬间发生' \
  --summary '回看那几个明显的转折点，全都挤在很短的时间里；前后是长长的、什么都没发生的时期。缓慢的是等待，不是变化——积累在暗处继续，出口只有一个点。' \
  --out "$OUT/03-discharge.png"

node bin/make-card.mjs \
  --theme echo --palette amber \
  --index 04 --total 6 \
  --title '那句你以为随口说的话，一直在你身上工作' \
  --summary '当时没往心里去。三年后在一个毫不相干的场合突然想起它，才发现它早就替你做过很多判断。有些话不是被记住的，是被延迟执行的。' \
  --out "$OUT/04-echo.png"

node bin/make-card.mjs \
  --theme tideline --palette brass \
  --index 05 --total 6 \
  --title '改变你的不是你读完的书，是你翻旧了的那几本' \
  --summary '认真读过的书大多没留下什么，塑造判断的是那几本被反复翻开的。而反复的理由往往不体面：不是因为重要，是因为读起来舒服。重要的不是哪一本，是那一遍又一遍。' \
  --out "$OUT/05-tideline.png"

node bin/make-card.mjs \
  --theme lattice --palette graphite \
  --index 06 --total 6 \
  --title '你在分别修理五个缺点，它们其实是同一个东西的五种长法' \
  --summary '总在同一种人身上受挫，总在快完成时拖延。处理了很多年，因为它们看起来是不同的问题。可是成分没变，变的只是它们出现时的排列和场合——分头处理，等于每次都从零开始。' \
  --out "$OUT/06-lattice.png"

echo "done"
