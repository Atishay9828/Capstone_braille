# OCR Benchmark Results

**Mode:** REAL pix2tex (CPU)  
**Images:** 20 synthetic ground-truth renders (matplotlib mathtext)  
**Source:** `scripts/ocr_benchmark.py` over `datasets/test_images/real/`  

> Synthetic renders are cleaner than phone photos, so these numbers are an **upper bound** on real-world accuracy. They are most useful for *relative* comparison across categories and DPI, and as a reproducible regression baseline.

## Summary

- **Strict exact match:** 4/20 (20%) — byte-identical after whitespace normalization
- **Lenient exact match:** 17/20 (85%) — same equation after case-folding + brace-stripping (the dominant pix2tex errors on clean renders are `x`->`X` and redundant braces)
- **Mean character similarity:** 0.82
- **Mean inference time:** 1719 ms (CPU)

### By category

| Category | Exact match |
|----------|-------------|
| fraction | 2/4 (50%) |
| linear | 0/5 (0%) |
| quadratic | 0/5 (0%) |
| radical | 0/3 (0%) |
| trig | 2/3 (67%) |

### By DPI

| DPI | Exact match |
|-----|-------------|
| 72 | 1/3 (33%) |
| 150 | 1/4 (25%) |
| 300 | 2/13 (15%) |

## Per-image

| Image | Category | DPI | Ground truth | pix2tex output | Exact | Sim | Time(ms) | Conf |
|-------|----------|-----|--------------|----------------|-------|-----|----------|------|
| linear_2x3_300.png | linear | 300 | `2x + 3 = 7` | `2X+3=7` | no | 0.83 | 1468 | 0.85 |
| linear_axbc_300.png | linear | 300 | `ax + b = c` | `\ a x+b=c` | no | 0.92 | 1407 | 0.85 |
| linear_xhalf_300.png | linear | 300 | `\frac{x}{2} = 4` | `{\frac{x}{2}}=4` | no | 0.93 | 1387 | 0.70 |
| linear_3x5_150.png | linear | 150 | `3x - 5 = 10` | `3X-5=10` | no | 0.86 | 1107 | 0.85 |
| linear_2x3_72.png | linear | 72 | `2x + 3 = 7` | `2X+3=7` | no | 0.83 | 868 | 0.85 |
| quad_x2_3x2_300.png | quadratic | 300 | `x^2 + 3x + 2 = 0` | `X^{2}+3X+2=0` | no | 0.73 | 1628 | 0.85 |
| quad_abc_300.png | quadratic | 300 | `ax^2 + bx + c = 0` | `\partial x^{2}+b x+c=0` | no | 0.71 | 1768 | 0.70 |
| quad_x2m4_300.png | quadratic | 300 | `x^2 - 4 = 0` | `{\cal X}^{2}-\lambda=0` | no | 0.36 | 1717 | 0.70 |
| quad_2x2_150.png | quadratic | 150 | `2x^2 + 5x - 3 = 0` | `2X^{2}+5X-3=0` | no | 0.75 | 1511 | 0.85 |
| quad_x2_3x2_72.png | quadratic | 72 | `x^2 + 3x + 2 = 0` | `x^{2}+3x+2=0` | no | 0.91 | 1221 | 0.85 |
| frac_abcd_300.png | fraction | 300 | `\frac{a}{b} = \frac{c}{d}` | `{\frac{a}{b}}={\frac{c}{d}}` | no | 0.92 | 1717 | 0.70 |
| frac_3412_300.png | fraction | 300 | `\frac{3}{4} + \frac{1}{2}` | `\frac{3}{4}+\frac{1}{2}` | yes | 1.00 | 1647 | 0.70 |
| frac_x2_300.png | fraction | 300 | `\frac{x}{2} = \frac{6}{4}` | `{\frac{x}{2}}={\frac{6}{4}}` | no | 0.92 | 1903 | 0.70 |
| frac_3412_72.png | fraction | 72 | `\frac{3}{4} + \frac{1}{2}` | `\frac{3}{4}+\frac{1}{2}` | yes | 1.00 | 1133 | 0.70 |
| rad_sqrt_300.png | radical | 300 | `\sqrt{x + 1} = 3` | `\sqrt{\left.\mathcal{N}\right.\stackrel{\rightarrow}{\mathcal{1}\rightarrow\left|\prod}\begin{array}{c}{{\phantom{\rightarrow}}}\\ {{\longrightarrow}}\end{array}\right.\stackrel{\rightarrow}{\longrightarrow}\begin{array}{` | no | 0.09 | 6339 | 0.20 |
| rad_circle_300.png | radical | 300 | `x^2 + y^2 = r^2` | `\ x^{2}+y^{2}=r^{2}` | no | 0.76 | 2070 | 0.85 |
| rad_sqrt2_150.png | radical | 150 | `\sqrt{2x} = 4` | `{\sqrt{2x}}=4` | no | 0.92 | 1102 | 0.70 |
| trig_sincos_300.png | trig | 300 | `\sin\theta + \cos\theta = 1` | `\sin\theta+\cos\theta=1` | yes | 1.00 | 1308 | 0.70 |
| trig_tan_300.png | trig | 300 | `\tan\theta = \frac{1}{2}` | `\tan{\theta}={\frac{1}{2}}` | no | 0.92 | 2112 | 0.70 |
| trig_sin2_150.png | trig | 150 | `\sin 2x = 0` | `\sin2x=0` | yes | 1.00 | 972 | 0.70 |
