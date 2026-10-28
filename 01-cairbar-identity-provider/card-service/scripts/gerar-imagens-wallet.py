"""Gera as imagens do passe do Google Wallet a partir da marca do tema (theme/src/shared/brand).

    python3 scripts/gerar-imagens-wallet.py   # em card-service/, exige Pillow

Dimensões das diretrizes do Google (developers.google.com/wallet/generic/resources/brand-guidelines):
- assets/logo.png (660x660): faixas do logotipo sobre branco; o Google recorta em círculo.
- assets/wide-logo.png (1280x400, transparente): logotipo horizontal, como no topo do cartão do
  portal; substitui o círculo no topo do passe.
- assets/hero.png (1032x336, transparente): faixas azuis do cartão do portal, sem texto.

Publicadas no bucket por ansible/scripts/gcp-wallet-assets.sh.
TODO(seção 23.15): regerar com o logotipo vetorial e a paleta oficial quando existirem.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT.parent / "theme" / "src" / "shared" / "brand"
OUT = ROOT / "assets"
STRIPE = "#7DC1E7"  # brand.stripe em theme/src/shared/theme.ts
SCALE = 4  # supersampling para bordas suaves


def logo() -> None:
    size = 660 * SCALE
    image = Image.new("RGB", (size, size), "white")
    draw = ImageDraw.Draw(image)
    # Geometria do símbolo (symbol.png, 192x192), centralizada dentro do círculo visível.
    unit = size / 192 * 0.62
    offset_x = (size - 192 * unit) / 2
    offset_y = (size - 192 * unit) / 2
    width = round(13 * unit)

    def point(x: float, y: float) -> tuple[float, float]:
        return offset_x + x * unit, offset_y + y * unit

    def line(*points: tuple[float, float]) -> None:
        coords = [point(x, y) for x, y in points]
        draw.line(coords, fill=STRIPE, width=width, joint="curve")
        radius = width / 2
        for cx, cy in (coords[0], coords[-1]):
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=STRIPE)

    line((20, 41), (96, 20), (172, 41))
    for y in (79, 124, 166):
        line((20, y), (172, y))
    image.resize((660, 660), Image.LANCZOS).save(OUT / "logo.png", optimize=True)


def wide_logo() -> None:
    width, height = 1280, 400
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mark = Image.open(BRAND / "logo.png").convert("RGBA")
    # Alinhado à esquerda, como no cartão do portal; o Google exibe a imagem no canto superior.
    target_width = width - 40
    mark = mark.resize((target_width, round(mark.height * target_width / mark.width)), Image.LANCZOS)
    image.alpha_composite(mark, (0, (height - mark.height) // 2))
    image.save(OUT / "wide-logo.png", optimize=True)


def hero() -> None:
    # Mesmo padrão do cartão do portal (Carteirinha.tsx): faixa de 8px a cada 22px, brand.stripe
    # com 20% de opacidade, escalado para a largura do passe. O fundo transparente deixa ver a cor
    # do passe; margem em cima e embaixo, como pedem as diretrizes.
    width, height, padding = 1032, 336, 48
    period, stripe = 44, 16
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    color = tuple(int(STRIPE[i : i + 2], 16) for i in (1, 3, 5)) + (0x33,)
    for top in range(padding, height - padding - stripe + 1, period):
        draw.rectangle((0, top, width - 1, top + stripe - 1), fill=color)
    image.save(OUT / "hero.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    logo()
    wide_logo()
    hero()
