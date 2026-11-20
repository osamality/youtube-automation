#!/bin/bash
# Normalises a rendered video's audio to YouTube's loudness (-14 LUFS, true peak -1.5 dB), in place.
# YouTube turns loud uploads down but never turns quiet ones up, so a -22 LUFS render plays ~8 dB quieter.
# Two-pass ffmpeg loudnorm; the video stream is copied, not re-encoded.
# Usage: packages/templates/scripts/loudnorm.sh <video.mp4> [more.mp4 ...]
set -euo pipefail

TARGET="I=-14:TP=-1.5:LRA=11"

for file in "$@"; do
  stats=$(ffmpeg -hide_banner -nostats -i "$file" -af "loudnorm=$TARGET:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  get() { python3 -c "import json,sys; print(json.loads(sys.stdin.read())['$1'])" <<<"$stats"; }
  before=$(get input_i)
  measured="measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset)"
  tmp="${file%.mp4}.loudnorm.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$file" -c:v copy -af "loudnorm=$TARGET:$measured:linear=true" -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$tmp"
  mv "$tmp" "$file"
  after=$(ffmpeg -hide_banner -nostats -i "$file" -af ebur128 -f null - 2>&1 | awk '/Integrated loudness/{getline; print $2}')
  echo "✔ $file: $before → $after LUFS"
done
