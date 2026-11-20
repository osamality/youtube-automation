"""Synthesises background loops for news and business explainers (original, royalty-free, no samples).

Usage: python3 make-news-music.py <out.wav> <style>
Styles:
  pulse  96 BPM, A minor: pulsing bass, plucked arpeggios, soft hats. For investigations and news stories.
  drive  104 BPM, D minor turning bright: steadier drums, off-beat chords. For money and business explainers.
Each track is a 32-bar seamless loop that builds in four 8-bar sections, so long videos don't hear the same bar for a minute.
Shares the synth helpers in make-music.py.
"""

import importlib.util
import os
import sys

import numpy as np

_spec = importlib.util.spec_from_file_location("music", os.path.join(os.path.dirname(__file__), "make-music.py"))
music = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(music)
SR, chord, hz, tone, pad, kick, noise_hit, place, write = (
    music.SR, music.chord, music.hz, music.tone, music.pad, music.kick, music.noise_hit, music.place, music.write,
)


def pluck(freq: float, dur: float) -> np.ndarray:
    """A short plucked synth: bright attack, quick decay."""
    return tone(freq, dur, [(1, 1.0, 1), (2, 0.45, 0.5), (3, 0.2, 0.3), (5, 0.06, 0.15)], 0.002, 0.16)


def sub(freq: float, dur: float) -> np.ndarray:
    """A round bass note with a little grit, faded at both ends to avoid clicks."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    x = np.tanh(1.8 * x) / 1.8
    return x * np.clip(t / 0.008, 0, 1) * np.clip((dur - t) / 0.03, 0, 1)


def render(style: str) -> np.ndarray:
    if style == "pulse":
        bpm = 96
        base = [("A", "min"), ("F", "maj"), ("C", "maj"), ("G", "maj")]
        turn = [("D", "min"), ("F", "maj"), ("A", "min"), ("E", "min")]
    else:
        bpm = 104
        base = [("D", "min"), ("A#", "maj"), ("F", "maj"), ("C", "maj")]
        turn = [("G", "min"), ("A#", "maj"), ("D", "min"), ("A", "min")]
    prog = (base * 2) + (base * 2) + (turn + base) + (base * 2)  # 32 bars
    beat = 60 / bpm
    bar = 4 * beat
    total = bar * len(prog)
    out = np.zeros(int((total + 3) * SR))
    k = kick()
    hat = noise_hit(0.06, 0.012, 3)
    snare = noise_hit(0.22, 0.05, 1)

    for b, (root, q) in enumerate(prog):
        t0 = b * bar
        section = b // 8  # 0 sparse, 1 add arps, 2 full, 3 full with variation
        place(out, pad(chord(root, q, 3), bar + 0.3), t0, 0.12 if section == 0 else 0.1)
        # Pulsing bass on every eighth, accent on the beat.
        broot = hz(root, 1 if style == "pulse" else 2)
        for i in range(8):
            place(out, sub(broot, beat / 2 * 0.9), t0 + i * beat / 2, 0.2 if i % 2 == 0 else 0.12)
        # Drums arrive in section 1 (kick) and section 2 (hats and snare).
        if section >= 1:
            for at in (0, 2 * beat) if style == "pulse" else (0, beat, 2 * beat, 3 * beat):
                place(out, k, t0 + at, 0.22)
        if section >= 2:
            for i in range(8):
                place(out, hat, t0 + i * beat / 2, 0.02 if i % 2 else 0.012)
            for at in (beat, 3 * beat):
                place(out, snare, t0 + at, 0.03)
        # Arpeggios (pulse) or off-beat chord stabs (drive) from section 1.
        up = chord(root, q, 4)
        if section >= 1:
            if style == "pulse":
                pattern = [0, 1, 2, 1, 2, 1, 0, 1] if section != 3 else [0, 2, 1, 2, 0, 2, 1, 2]
                for i, p in enumerate(pattern):
                    f = up[p % len(up)] * (2 if section == 3 and i == 7 else 1)
                    place(out, pluck(f, beat * 0.9), t0 + i * beat / 2, 0.09)
            else:
                for i in (1, 3, 5, 7):
                    stab = sum(pluck(f, beat * 0.6) for f in up)
                    place(out, stab, t0 + i * beat / 2, 0.05)
        if section == 3 and b % 2 == 1:  # a high answer every other bar
            place(out, pluck(up[-1] * 2, beat * 1.5), t0 + 3 * beat, 0.06)

    n = int(total * SR)
    tail = out[n:]
    loop = out[:n].copy()
    loop[: len(tail)] += tail
    loop = np.tanh(loop * 1.5) / 1.5
    return loop / (np.max(np.abs(loop)) + 1e-9) * 0.85


if __name__ == "__main__":
    write(sys.argv[1], render(sys.argv[2]))
