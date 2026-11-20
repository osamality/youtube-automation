#!/bin/sh
# Synthesises the sound effects in ../sfx with ffmpeg. No samples, no licences.
# Re-run after changing a formula: sh packages/templates/scripts/make-sfx.sh
set -e
cd "$(dirname "$0")/../sfx"
gen() { # name duration expression [filters]
  ffmpeg -loglevel error -y -f lavfi -i "aevalsrc=exprs='$3':s=44100:d=$2" \
    -af "${4:-anull},afade=t=out:st=$(echo "$2 - 0.02" | bc | sed "s/^\./0./"):d=0.02" -ac 1 -c:a pcm_s16le "$1.wav"
}
# Bubbly pop: pitch falls from ~1350 Hz to 250 Hz.
gen pop 0.16 '0.8*(1-exp(-400*t))*exp(-22*t)*sin(2*PI*(250*t+61.1*(1-exp(-18*t))))'
# Soft air swoosh for transitions.
gen whoosh 0.5 '(2*random(0)-1)*pow(sin(PI*t/0.5),2)*0.9' 'bandpass=f=1100:width_type=o:w=2.2,volume=1.4'
# Bright bell for landed numbers and highlights.
gen ding 1.0 '0.42*(1-exp(-300*t))*exp(-5*t)*(sin(2*PI*1318.5*t)+0.45*sin(2*PI*2637*t)+0.2*sin(2*PI*3955.5*t))'
# Two-note message alert.
gen notify 0.36 '0.5*(1-exp(-300*t))*(lt(t,0.12)*exp(-25*t)*sin(2*PI*988*t)+gte(t,0.12)*exp(-14*(t-0.12))*sin(2*PI*1480*t))'
# Short tick.
gen click 0.04 '(2*random(0)-1)*exp(-180*t)*0.7' 'highpass=f=1800'
# Low impact for hook titles: pitch falls from ~135 Hz to 45 Hz.
gen boom 0.6 '0.95*(1-exp(-200*t))*exp(-6.5*t)*sin(2*PI*(45*t+7.5*(1-exp(-12*t))))+0.25*(2*random(0)-1)*exp(-40*t)'
# Rising four-note sparkle for wins.
gen sparkle 0.75 '0.26*(1-exp(-300*t))*(exp(-9*t)*sin(2*PI*1568*t)+gte(t,0.07)*exp(-9*(t-0.07))*sin(2*PI*2093*(t-0.07))+gte(t,0.14)*exp(-9*(t-0.14))*sin(2*PI*2637*(t-0.14))+gte(t,0.21)*exp(-8*(t-0.21))*sin(2*PI*3136*(t-0.21)))'
ls -1 *.wav
