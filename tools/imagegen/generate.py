"""Free local image generation on this Mac (Apple GPU), no account or credits.

Model: Animagine XL 4.0 (anime SDXL, CreativeML Open RAIL++-M licence, commercial use allowed).
Optional IP-Adapter: pass a reference picture to keep a character's face and outfit.

Setup (once):
  python3 -m venv data/cache/imagegen/venv
  data/cache/imagegen/venv/bin/pip install torch torchvision diffusers transformers accelerate safetensors pillow huggingface_hub
  (the model downloads to data/cache/imagegen/models/)

Usage:
  data/cache/imagegen/venv/bin/python tools/imagegen/generate.py jobs.json --out data/manga/art/local
jobs.json is a list of:
  {"id": "saya-cuff", "prompt": "...", "shape": "char" | "wide" | "square",
   "negative": "...", "seed": 7, "count": 2, "ref": "path/to/reference.png", "ref_scale": 0.6}
Files are written as <out>/<id>.png (or <id>-2.png ... when count > 1). Existing files are skipped,
so a stopped run can be restarted.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import torch
from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionXLPipeline
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "data/cache/imagegen/models/animagine-xl-4.0"
IP_DIR = ROOT / "data/cache/imagegen/models/ip-adapter"

# SDXL's native sizes. "char" is portrait so a full-body figure gets the most pixels.
SHAPES = {"char": (832, 1216), "wide": (1344, 768), "square": (1024, 1024)}

QUALITY = "masterpiece, high score, great score, absurdres"
NEGATIVE = (
    "nsfw, lowres, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, "
    "text, letters, words, logo, signature, watermark, username, error, cropped, out of frame, "
    "worst quality, low quality, low score, bad score, average score, blurry, jpeg artifacts"
)


def load(with_ip: bool):
    pipe = StableDiffusionXLPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, use_safetensors=True)
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    if with_ip:
        pipe.load_ip_adapter(
            str(IP_DIR), subfolder="sdxl_models", weight_name="ip-adapter-plus_sdxl_vit-h.safetensors",
            image_encoder_folder="models/image_encoder",
        )
    pipe.to("mps")
    pipe.set_progress_bar_config(disable=True)
    return pipe


def _chunks(tok, text: str, n: int | None = None) -> list[list[int]]:
    """Token ids in 75-token pieces, each wrapped as BOS + piece + EOS + padding = 77 (CLIP's limit)."""
    ids = tok(text, add_special_tokens=False, truncation=False).input_ids
    pieces = [ids[i : i + 75] for i in range(0, len(ids), 75)] or [[]]
    while n and len(pieces) < n:
        pieces.append([])
    out = []
    for p in pieces:
        c = [tok.bos_token_id, *p, tok.eos_token_id]
        out.append(c + [tok.pad_token_id] * (77 - len(c)))
    return out


@torch.no_grad()
def encode(pipe, prompt: str, negative: str):
    """SDXL embeddings for prompts of any length. Diffusers cuts prompts at 77 tokens, which dropped the end of
    every job prompt (framing, background, rating) and most of the negative. Here each prompt is encoded in
    77-token chunks that are joined, and the shorter prompt gets empty chunks so both have the same length."""
    n = max(len(_chunks(pipe.tokenizer, prompt)), len(_chunks(pipe.tokenizer, negative)))
    result = []
    for text in (prompt, negative):
        per_chunk, pooled = [], None
        ids1 = _chunks(pipe.tokenizer, text, n)
        ids2 = _chunks(pipe.tokenizer_2, text, n)
        for k, (a, b) in enumerate(zip(ids1, ids2)):
            o1 = pipe.text_encoder(torch.tensor([a], device=pipe.device), output_hidden_states=True)
            o2 = pipe.text_encoder_2(torch.tensor([b], device=pipe.device), output_hidden_states=True)
            per_chunk.append(torch.cat([o1.hidden_states[-2], o2.hidden_states[-2]], dim=-1))
            if k == 0:
                pooled = o2[0]
        result += [torch.cat(per_chunk, dim=1), pooled]
    return result  # prompt_embeds, pooled, negative_embeds, negative_pooled


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs")
    ap.add_argument("--out", required=True)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--cfg", type=float, default=5.0)
    ap.add_argument("--only", help="comma-separated ids to run")
    args = ap.parse_args()

    jobs = json.loads(Path(args.jobs).read_text())
    if args.only:
        keep = set(args.only.split(","))
        jobs = [j for j in jobs if j["id"] in keep]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with_ip = any(j.get("ref") for j in jobs)
    pipe = load(with_ip)

    for j in jobs:
        count = j.get("count", 1)
        names = [f"{j['id']}.png"] + [f"{j['id']}-{k}.png" for k in range(2, count + 1)]
        todo = [n for n in names if not (out / n).exists()]
        if not todo:
            continue
        w, h = SHAPES[j.get("shape", "square")]
        extra = {}
        if with_ip:
            if j.get("ref"):
                extra["ip_adapter_image"] = Image.open(ROOT / j["ref"]).convert("RGB")
                pipe.set_ip_adapter_scale(j.get("ref_scale", 0.6))
            else:
                # The adapter is loaded for this run: give it a blank picture at zero strength.
                extra["ip_adapter_image"] = Image.new("RGB", (224, 224), "white")
                pipe.set_ip_adapter_scale(0.0)
        for k, name in enumerate(names):
            if name not in todo:
                continue
            seed = j.get("seed", 1000) + k
            t = time.time()
            # Job-specific negatives go first, so they carry the most weight.
            neg = f"{j['negative']}, {NEGATIVE}" if j.get("negative") else NEGATIVE
            pe, pp, ne, npool = encode(pipe, f"{j['prompt']}, {QUALITY}", neg)
            img = pipe(
                prompt_embeds=pe, pooled_prompt_embeds=pp,
                negative_prompt_embeds=ne, negative_pooled_prompt_embeds=npool,
                width=w, height=h, num_inference_steps=args.steps, guidance_scale=args.cfg,
                generator=torch.Generator("cpu").manual_seed(seed), **extra,
            ).images[0]
            img.save(out / name)
            print(f"{name} {w}x{h} seed {seed} {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    sys.exit(main())
