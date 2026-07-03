#!/usr/bin/env python3
"""
Music Generator — Modern social media ad-style background music.

Synthesizes a ~32s track at 128 BPM with:
  - Punchy kick (frequency-swept sine + click)
  - Crisp snare (tonal body + filtered noise)
  - Closed hihat (high-passed noise burst)
  - Sub bass (sine + saw harmonics)
  - Warm synth pad (detuned saw stack + slow LFO)
  - Riser transitions between sections

Sections:
  1. Intro   (bars 1-2):  pad + soft kick
  2. Drop    (bars 3-8):  full beat, 4-on-floor pattern
  3. Build   (bars 9-12): denser hihats + riser
  4. Climax  (bars 13-16): full energy, sustained
  5. Outro   (bar 17):    pad fade + final kick

Usage:
  python3 generate_music.py [--out path.wav] [--bpm 128] [--bars 17]

Requirements:
  pip install numpy scipy
"""

import argparse
import os
import sys
import numpy as np
from scipy.io import wavfile

# ============================================================
# SYNTHESIS PRIMITIVES
# ============================================================

def kick(sr, duration=0.32):
    """Punchy kick drum: frequency-swept sine + click."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    freq = 110 * np.exp(-t * 9) + 45
    phase = np.cumsum(2 * np.pi * freq / sr)
    body = np.sin(phase)
    click = np.exp(-t * 200) * np.random.uniform(-1, 1, n) * 0.3
    env = np.exp(-t * 7) * (1 - np.exp(-t * 400))
    return (body * 0.9 + click * 0.4) * env


def snare(sr, duration=0.22):
    """Crisp snare: tonal body + filtered noise."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    tone = (np.sin(2*np.pi*180*t) + 0.5*np.sin(2*np.pi*330*t)) * np.exp(-t * 30)
    noise = np.random.uniform(-1, 1, n) * np.exp(-t * 18)
    noise = np.diff(noise, prepend=0)  # crude high-pass
    env = (1 - np.exp(-t * 800)) * np.exp(-t * 14)
    return (tone * 0.4 + noise * 0.8) * env


def hihat(sr, duration=0.05):
    """Closed hihat: bright noise burst."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    noise = np.random.uniform(-1, 1, n)
    noise = np.diff(noise, prepend=0)
    env = np.exp(-t * 90)
    return noise * env * 0.5


def bass(freq, sr, duration):
    """Sub bass: sine + saw harmonics, soft-clipped."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    sub = np.sin(2*np.pi*freq*t)
    saw = sum(np.sin(2*np.pi*freq*h*t) / h for h in range(1, 6)) * 0.25
    env = np.exp(-t * 1.5) * (1 - np.exp(-t * 50))
    sig = (sub * 0.7 + saw * 0.3) * env
    return np.tanh(sig * 1.5) * 0.7


def pad(freqs, sr, duration):
    """Warm pad: detuned saw stack + slow LFO."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    sig = np.zeros(n)
    for f in freqs:
        for det in [-0.5, 0, 0.5]:
            ff = f * (1 + det / 100)
            for h in [1, 2, 3]:
                sig += np.sin(2*np.pi*ff*h*t) / (h * 3)
    lfo = 0.5 + 0.5 * np.sin(2*np.pi*0.3*t)
    env = np.minimum(1, t * 2) * np.minimum(1, (duration - t) * 2)
    return sig * env * lfo * 0.08


def riser(sr, duration=1.5):
    """Transition riser: filtered noise sweep + rising sine."""
    n = int(sr * duration)
    t = np.arange(n) / sr
    noise = np.random.uniform(-1, 1, n)
    env = (t / duration) ** 2
    freq_rise = 200 + 2000 * (t / duration)
    phase = np.cumsum(2 * np.pi * freq_rise / sr)
    sine_sweep = np.sin(phase) * 0.3
    return (noise * 0.5 + sine_sweep) * env * 0.4


def add(buf, sig, start_sec, sr, gain=1.0):
    """Mix a mono signal into a stereo buffer at start_sec."""
    s = int(start_sec * sr)
    if s >= len(buf):
        return
    end = min(s + len(sig), len(buf))
    buf[s:end] += (sig[:end-s] * gain).astype(np.float32)


# ============================================================
# ARRANGEMENT
# ============================================================

def generate_music(output_path, bpm=128, total_bars=17, sr=44100):
    beat = 60.0 / bpm
    bar = 4 * beat
    duration = total_bars * bar
    n_samples = int(sr * duration)

    left = np.zeros(n_samples, dtype=np.float32)
    right = np.zeros(n_samples, dtype=np.float32)

    # Chord progression (A minor vibe): Am - F - C - G
    chord_roots = [110.0, 87.31, 130.81, 98.0]
    chord_pads = [
        [220, 261.63, 329.63],
        [174.61, 220, 261.63],
        [261.63, 329.63, 392.0],
        [196, 246.94, 293.66],
    ]

    # --- Section 1: Intro (bars 1-2) ---
    add(left,  pad([110, 165, 220], sr, bar * 2), 0, sr, 0.7)
    add(right, pad([110, 165, 220], sr, bar * 2), 0, sr, 0.7)
    for b in range(2):
        add(left,  kick(sr, 0.28), b * bar, sr, 0.5)
        add(right, kick(sr, 0.28), b * bar, sr, 0.5)

    # --- Section 2: Drop (bars 3-8) ---
    for bar_idx in range(2, 8):
        bs = bar_idx * bar
        ci = (bar_idx - 2) % 4
        add(left,  pad(chord_pads[ci], sr, bar), bs, sr, 0.5)
        add(right, pad(chord_pads[ci], sr, bar), bs, sr, 0.5)
        add(left,  bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.6)
        add(right, bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.6)
        for beat_idx in [0, 2]:
            add(left,  kick(sr), bs + beat_idx * beat, sr, 0.85)
            add(right, kick(sr), bs + beat_idx * beat, sr, 0.85)
        for beat_idx in [1, 3]:
            add(left,  snare(sr), bs + beat_idx * beat, sr, 0.6)
            add(right, snare(sr), bs + beat_idx * beat, sr, 0.6)
        for eighth in range(8):
            add(left,  hihat(sr), bs + eighth * beat/2, sr, 0.35)
            add(right, hihat(sr), bs + eighth * beat/2, sr, 0.35)

    # Riser into build
    add(left,  riser(sr, beat * 2), 8 * bar - beat * 2, sr, 0.5)
    add(right, riser(sr, beat * 2), 8 * bar - beat * 2, sr, 0.5)

    # --- Section 3: Build (bars 9-12) ---
    for bar_idx in range(8, 12):
        bs = bar_idx * bar
        ci = (bar_idx - 8) % 4
        add(left,  pad(chord_pads[ci], sr, bar), bs, sr, 0.55)
        add(right, pad(chord_pads[ci], sr, bar), bs, sr, 0.55)
        add(left,  bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.7)
        add(right, bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.7)
        for beat_idx in [0, 2]:
            add(left,  kick(sr), bs + beat_idx * beat, sr, 0.9)
            add(right, kick(sr), bs + beat_idx * beat, sr, 0.9)
        for beat_idx in [1, 3]:
            add(left,  snare(sr), bs + beat_idx * beat, sr, 0.7)
            add(right, snare(sr), bs + beat_idx * beat, sr, 0.7)
        for sixteenth in range(16):
            gain = 0.4 if sixteenth % 2 == 0 else 0.25
            add(left,  hihat(sr, 0.04), bs + sixteenth * beat/4, sr, gain)
            add(right, hihat(sr, 0.04), bs + sixteenth * beat/4, sr, gain)

    add(left,  riser(sr, beat * 2), 12 * bar - beat * 2, sr, 0.6)
    add(right, riser(sr, beat * 2), 12 * bar - beat * 2, sr, 0.6)

    # --- Section 4: Climax (bars 13-16) ---
    for bar_idx in range(12, 16):
        bs = bar_idx * bar
        ci = (bar_idx - 12) % 4
        add(left,  pad(chord_pads[ci], sr, bar), bs, sr, 0.6)
        add(right, pad(chord_pads[ci], sr, bar), bs, sr, 0.6)
        add(left,  bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.75)
        add(right, bass(chord_roots[ci], sr, beat * 2), bs, sr, 0.75)
        for beat_idx in range(4):  # four-on-floor
            add(left,  kick(sr), bs + beat_idx * beat, sr, 0.95)
            add(right, kick(sr), bs + beat_idx * beat, sr, 0.95)
        for beat_idx in [1, 3]:
            add(left,  snare(sr), bs + beat_idx * beat, sr, 0.75)
            add(right, snare(sr), bs + beat_idx * beat, sr, 0.75)
        for sixteenth in range(16):
            gain = 0.45 if sixteenth % 2 == 0 else 0.3
            add(left,  hihat(sr, 0.04), bs + sixteenth * beat/4, sr, gain)
            add(right, hihat(sr, 0.04), bs + sixteenth * beat/4, sr, gain)

    # --- Section 5: Outro (bar 17) ---
    outro = 16 * bar
    add(left,  pad([110, 165, 220], sr, bar), outro, sr, 0.8)
    add(right, pad([110, 165, 220], sr, bar), outro, sr, 0.8)
    add(left,  kick(sr, 0.5), outro, sr, 0.9)
    add(right, kick(sr, 0.5), outro, sr, 0.9)

    # --- Master: soft clip + normalize ---
    stereo = np.stack([left, right], axis=1)
    stereo = np.tanh(stereo * 1.2) * 0.85
    peak = np.max(np.abs(stereo))
    if peak > 0.99:
        stereo = stereo * (0.99 / peak)

    stereo_int = (stereo * 32767).astype(np.int16)
    wavfile.write(output_path, sr, stereo_int)
    return duration, peak


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Generate Digital Forge background music')
    parser.add_argument('--out', default='forge_theme.wav', help='Output WAV path')
    parser.add_argument('--bpm', type=int, default=128, help='Tempo (default: 128)')
    parser.add_argument('--bars', type=int, default=17, help='Total bars (default: 17)')
    parser.add_argument('--sr', type=int, default=44100, help='Sample rate (default: 44100)')
    args = parser.parse_args()

    print(f'[music] Generating {args.bars} bars @ {args.bpm} BPM → {args.out}')
    duration, peak = generate_music(args.out, args.bpm, args.bars, args.sr)
    size_mb = os.path.getsize(args.out) / 1024 / 1024
    print(f'[music] Done: {duration:.2f}s, {args.sr}Hz stereo, peak {peak:.3f}, {size_mb:.2f} MB')

if __name__ == '__main__':
    main()
