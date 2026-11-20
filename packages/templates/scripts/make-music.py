"""Synthesises gentle, upbeat background loops for the health channel (original, royalty-free).

Usage: python3 synth.py <out.wav> <style>
Styles: warm (100 BPM, C major, marimba arpeggios) · easy (88 BPM, G major, soft keys).
Each track is a seamless loop: the tail past the last bar is folded back onto the start.
make-news-music.py imports SR, chord, hz, tone, pad, kick, noise_hit, place and write from this file. Keep those names.
"""

import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name: str, octave: int) -> float:
    midi = 12 * (octave + 1) + NOTE[name]
    return 440.0 * 2 ** ((midi - 69) / 12)


def chord(root: str, quality: str, octave: int = 3):
    r = 12 * (octave + 1) + NOTE[root]
    steps = {"maj": [0, 4, 7], "min": [0, 3, 7], "maj7": [0, 4, 7, 11], "min7": [0, 3, 7, 10], "sus2": [0, 2, 7]}[quality]
    return [440.0 * 2 ** ((r + s - 69) / 12) for s in steps]


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def tone(freq: float, dur: float, partials, attack=0.005, decay=0.5) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, amp, d in partials:
        out += amp * np.sin(2 * np.pi * freq * k * t) * np.exp(-t / (decay * d))
    return out * np.clip(t / attack, 0, 1)


def pad(freqs, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for k, amp in [(1, 1.0), (2, 0.35), (3, 0.15), (4, 0.06)]:
            detune = 1 + 0.0015 * np.sin(2 * np.pi * 0.3 * t + k)
            out += amp * np.sin(2 * np.pi * f * k * detune * t)
    shape = np.clip(t / 0.35, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    return out * shape / len(freqs)


def kick(dur=0.35) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 50 + 70 * np.exp(-t / 0.04)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t / 0.12)


def noise_hit(dur: float, decay: float, bright: int) -> np.ndarray:
    n = int(dur * SR)
    x = rng.standard_normal(n)
    for _ in range(bright):  # first differences: a cheap high-pass
        x = np.diff(x, prepend=0.0)
    x = np.convolve(x, np.ones(6) / 6, mode="same")  # take the hiss off the top
    x /= np.max(np.abs(x)) + 1e-9
    t = np.arange(n) / SR
    return x * np.exp(-t / decay)


def place(track: np.ndarray, clip: np.ndarray, at: float, gain: float):
    i = int(at * SR)
    j = min(len(track), i + len(clip))
    if i < len(track):
        track[i:j] += gain * clip[: j - i]


def render(style: str) -> np.ndarray:
    if style == "warm":
        bpm, prog = 100, [("C", "maj"), ("A", "min"), ("F", "maj"), ("G", "maj")] * 2 + [
            ("F", "maj7"), ("G", "maj"), ("E", "min"), ("A", "min"), ("F", "maj"), ("G", "maj"), ("C", "maj"), ("C", "sus2")]
        prog = prog + prog  # 32 bars
        lead = "marimba"
    else:
        bpm, prog = 88, [("G", "maj"), ("D", "maj"), ("E", "min7"), ("C", "maj7")] * 2 + [
            ("C", "maj7"), ("D", "maj"), ("B", "min"), ("E", "min"), ("A", "min7"), ("D", "maj"), ("G", "maj"), ("G", "sus2")]
        prog = prog + prog
        lead = "keys"
    beat = 60 / bpm
    bar = 4 * beat
    total = bar * len(prog)
    out = np.zeros(int((total + 3) * SR))
    k = kick()
    clap = noise_hit(0.25, 0.06, 1)
    shaker = noise_hit(0.08, 0.018, 3)

    for b, (root, q) in enumerate(prog):
        t0 = b * bar
        section = (b // 8) % 4  # 0 intro-ish, 1 groove, 2 lift, 3 groove
        freqs = chord(root, q, 3)
        place(out, pad(freqs, bar + 0.3), t0, 0.17)
        # Bass: root on beats 1 and 3, a pickup on beat 4 "and".
        broot = hz(root, 2)
        for at, f, g in [(0, broot, 1.0), (2 * beat, broot, 0.8), (3.5 * beat, broot * 1.5, 0.5)]:
            place(out, tone(f, beat * 1.4, [(1, 1.0, 1), (2, 0.25, 0.6)], 0.01, 0.35), t0 + at, 0.22 * g)
        # Drums: lighter in the first 8 bars, so the track starts gently.
        if section != 0 or b % 2 == 1:
            for at in (0, 2 * beat):
                place(out, k, t0 + at, 0.26)
        if section != 0:
            for at in (beat, 3 * beat):
                place(out, clap, t0 + at, 0.035 if lead == "keys" else 0.045)
        for i in range(8):
            place(out, shaker, t0 + i * beat / 2, (0.018 if i % 2 else 0.011) * (0.6 if section == 0 else 1))
        # Lead: arpeggios (marimba) or off-beat chords (keys).
        up = chord(root, q, 4)
        if lead == "marimba":
            pattern = [0, 1, 2, 1, 0, 2, 1, 2] if section != 2 else [0, 2, 1, 2, 0, 2, 1, 0]
            for i, p in enumerate(pattern):
                f = up[p % len(up)] * (2 if section == 2 and i in (3, 7) else 1)
                place(out, tone(f, beat * 1.2, [(1, 1.0, 1), (4, 0.18, 0.25), (10, 0.04, 0.1)], 0.003, 0.28), t0 + i * beat / 2, 0.13)
        else:
            for i in (1, 3, 5, 7):
                hit = sum(tone(f, beat * 0.9, [(1, 1.0, 1), (2, 0.3, 0.5), (3, 0.1, 0.3)], 0.004, 0.22) for f in up)
                place(out, hit, t0 + i * beat / 2, 0.07)
            if section == 2:
                for i in (0, 3, 6):
                    place(out, tone(up[-1] * 2, beat, [(1, 1.0, 1), (3, 0.1, 0.3)], 0.003, 0.3), t0 + i * beat / 2, 0.05)

    # Seamless loop: fold the tail past the last bar back onto the start.
    n = int(total * SR)
    tail = out[n:]
    loop = out[:n].copy()
    loop[: len(tail)] += tail
    loop = np.tanh(loop * 1.6) / 1.6  # gentle glue
    return loop / (np.max(np.abs(loop)) + 1e-9) * 0.85


def write(path: str, x: np.ndarray):
    stereo = np.stack([x, np.roll(x, 90)], axis=1)  # a touch of width
    data = (stereo * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


if __name__ == "__main__":
    write(sys.argv[1], render(sys.argv[2]))
