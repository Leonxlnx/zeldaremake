# The Spider-Verse Look: A Technical Reference for Real-Time Reimplementation

Target: a custom Three.js / WebGL2 renderer with hand-written GLSL, rendered headless to frames.

This document separates three kinds of statement, and labels every one of them:

- **[DOC]** — documented by a primary source (patent, SIGGRAPH talk, conference talk, supervisor
  interview). Cited.
- **[MEAS]** — measured by me from public promotional frames. Method and uncertainty given in
  [Appendix A](#appendix-a--measurement-method-and-its-limits). **No published source gives dot
  pitch, screen angle or offset magnitude in pixels.** If you want numbers, they have to be
  measured, and these are mine.
- **[EST]** — my engineering estimate where no source exists. Flagged every time.

Where sources contradict each other I say so and give both, in
[Appendix B](#appendix-b--where-sources-disagree).

---

## Table of contents

1. [Halftone / Ben-Day dots](#1-halftone--ben-day-dots)
2. [Hatching](#2-hatching)
3. [Ink lines](#3-ink-lines)
4. [Depth of field as chromatic misregistration](#4-depth-of-field-as-chromatic-misregistration)
5. [Shading: quantisation and designed shadow shapes](#5-shading-quantisation-and-designed-shadow-shapes)
6. [Frame rate and animation](#6-frame-rate-and-animation)
7. [Colour](#7-colour)
8. [Compositing and print artifacts](#8-compositing-and-print-artifacts)
9. [Across the Spider-Verse: per-universe styles](#9-across-the-spider-verse-per-universe-styles)
10. [Camera language](#10-camera-language)
- [Appendix A — measurement method and its limits](#appendix-a--measurement-method-and-its-limits)
- [Appendix B — where sources disagree](#appendix-b--where-sources-disagree)
- [Appendix C — sources, ranked by reliability](#appendix-c--sources-ranked-by-reliability)
- [Appendix D — suggested render-graph order](#appendix-d--suggested-render-graph-order)
- [Appendix E — verification](#appendix-e--verification)

---

## The one architectural fact that matters most

Before any individual effect: **the Spider-Verse look is a compositing look, not a shader look.**

> "The signature Spider-Verse graphic look was created almost entirely in comp, which meant every
> shot had an extensive amount of work done in Nuke." — Foundry interview with the Imageworks comp
> team [DOC]
> <https://colorway.foundry.com/insights/film-tv/graphic-look-in-comp-spiderman>

> "The majority of half-toning and hatching is compositing based using render passes." — Danny
> Dimian, VFX Supervisor [DOC]
> <https://vfxvoice.com/imageworks-artists-break-the-mold-to-create-an-alternate-spider-verse/>

Imageworks built "over 25 individual tools for the compositors, and probably just as many
templates" [DOC, Foundry]. The renderer produced comparatively conventional smooth-shaded beauty
passes plus auxiliary passes; nearly everything recognisable was applied afterwards in 2D.

For a WebGL2 implementation this is good news and it dictates your architecture: **render to an
MRT G-buffer, then do the entire look as a chain of full-screen post passes.** Concretely you need
these render targets:

| Attachment | Format | Contents | Consumed by |
| --- | --- | --- | --- |
| `beauty` | RGBA16F | smooth-shaded lit colour, linear | everything |
| `luma` | R16F | shading luminance *before* albedo (i.e. the lighting term alone) | Thresher banding |
| `P` | RGBA32F | world position, `.w` = object id | Hatcher projection |
| `N` | RGB16F | world normal | Hatcher tri-planar blend |
| `uv` | RG16F | surface UV | Hatcher UV mode |
| `Pref` | RGB32F | rest-pose position | Hatcher object lock |
| `depth` | R32F | view-space depth | misregistration, haze |
| `motion` | RG16F | screen-space motion vector | motion trails, redraw rate |
| `id` | R16UI | object / partition id | per-part frame rate, line grouping |

Separating `luma` from `beauty` is the single most important choice. The Thresher quantises a
*luminance gradient* and re-applies it as a multiply, so you need the lighting term independent of
albedo or you will band the texture detail instead of the light [DOC, patent US 11270474; see
§1.2].

---

## 1. Halftone / Ben-Day dots

### 1.1 The two tools, and what each actually does

The system is a pair of Nuke tools, **Hatcher** and **Thresher**, patented as
US 11,270,474 B2 "Screen-tone look generator", inventors **Bret St. Clair** and **Marco Recuay**,
filed 2019-10-16, granted 2022-03-08, from provisional 62/775,842 (2018-12-05) titled
*"Thresher and Hatcher tools: The Creation of a Screentone Look"* [DOC]
<https://patents.google.com/patent/US11270474B2/en>

The division of labour, straight from the patent [DOC]:

- **Hatcher** = *pattern generator*. Takes the rendered image plus **per-pixel position
  information** and synthesises the screen: dots, lines and grid patterns. It is the thing that
  decides *where the dots are in space*.
- **Thresher** = *tone quantiser and applier*. Divides the image into "a fixed number of sections
  defined by luminance… a series of successive bands which can be manipulated individually", then
  **applies the Hatcher patterns into the transitions between those bands**.

That last clause is the crux and it is what most reimplementations get wrong. From the patent:

> "a smooth gradient image 210 is processed into a 'screen-tone' image 230 by quantizing the smooth
> gradient image 210 into a quantized image 220 and integrating the patterns 240 generated by the
> hatcher 120 **in the transitions between gradient bands**."

So dots are **not** sprayed uniformly over a tonal region. The image is posterised into N bands,
and the screen lives in the *boundary zone* between band k and band k+1, where it dithers the
transition. Each band carries its own independent controls: "position and width of the luminance
bands, the width of the transition between bands, the pattern to be applied across each
transition, and final color correction" [DOC].

### 1.2 The multiply layer — how the screen is applied

This is the mechanism to copy, because it makes screentones composable:

> "The luminance is remapped based on its value relative to the incoming screen-tone gradient
> channel at the given pixel. These values are then stored as a **'multiplier' layer**, which is a
> new gradient with values that are either **above one or below one** depending on whether the pixel
> needs to be darkened or brightened. Once the luminance is converted, the screen-tones can be
> applied to any image using a **standard multiply**." — US 11270474 [DOC]

Two consequences:

1. **A screentone is a multiplier around 1.0, not an ink colour composited over.** Dots darker than
   1.0 darken; dots above 1.0 *brighten*. That is how you get dots in highlights as well as
   shadows without a separate light-ink system.
2. The multiplier layer "can be used elsewhere in the graph to apply the screen-tone distribution as
   defined upstream, regardless of the luminance at the new location" [DOC]. So you compute the
   screen once from the lighting and can re-apply it to unrelated elements.

This answers the user question *"what colour are the dots — a multiply of the shadow colour, or
separate ink colours?"* → **a multiply of whatever is underneath**, with an optional per-band colour
correction on top. Not separate CMYK ink plates.

```glsl
// Thresher core. luma = lighting term (NOT beauty). screen = Hatcher pattern in [0,1].
// uBandPos[i] = luma of band edge i; uTransWidth[i] = width of its dithered transition;
// uBandMul[0..BAND_COUNT] = the multiplier for each of the BAND_COUNT+1 resulting bands.
// Returns a multiplier around 1.0, to be applied to beauty with a plain multiply.
float thresher(float luma, float screen)
{
    // Count how many band edges this pixel is above. Each crossing is dithered by the
    // screen, so the boundary between band k and k+1 breaks up into dots or hatch lines
    // instead of being a hard contour.
    float idx = 0.0;
    for (int i = 0; i < BAND_COUNT; ++i) {
        float tw = max(uTransWidth[i], 1e-4);
        // position within edge i's transition zone, in [0,1]
        float t  = clamp((luma - (uBandPos[i] - 0.5 * tw)) / tw, 0.0, 1.0);
        idx += step(screen, t);
    }
    return uBandMul[int(idx)];
}
```

Note `step(screen, t)`: the screen value acts as the *threshold*, so as `t` sweeps 0→1 across the
transition the dots switch on in order of their screen value. This is precisely "dither the
posterisation edge", which is what a real halftone is.

**The transition width is the single most important parameter.** It controls where you sit on the
continuum between two different looks:

- `uTransWidth[i]` ≪ band spacing → crisp posterisation with a thin dithered contour at each step.
  This is the "anime / clean cel" end, and matches the patent's uniform-grey variant (§5.2).
- `uTransWidth[i]` ≈ band spacing → the dither spreads across the whole tonal range and you get a
  continuous printed halftone. This is the "comic print" end.

Set it to roughly **0.6–1.0× the spacing between adjacent band edges** for the Spider-Verse look. Set
it small and you will get banding with barely visible dots, which is a mistake that is easy to make
and hard to spot until you compare side by side.

### 1.3 Amplitude modulation: dot size tracks tone

> "the screen-tones could not simply be dots that were either on or off. That is, **the position of
> every pixel needs to be known with respect to each tonal gradient** in order to simulate printing."
>
> "the **thickness of any dot or line** in a printed pattern typically **reflects the brightness of
> that region** along a single tonal range." — US 11270474 [DOC]

So it is classical **AM (amplitude-modulated) halftoning**: fixed lattice, variable dot radius.
Not ordered dithering with fixed dot size.

**[MEAS]** Confirmed directly. In the ITSV collider shot the dots visibly grow as tone darkens, and
in the darkest band adjacent dots **merge into each other** (my dot-centre detector collapses to a
2 px noise floor there, while in the mid-tone band it resolves a clean 8 px lattice). Implement dot
coverage up to and past 100% — let them touch and fuse in the deepest shadow.

The clean way to get AM dots in GLSL is a signed distance to the nearest lattice site:

```glsl
// Square dot lattice rotated by uScreenAngle, pitch uPitch (in the chosen projection space).
// Returns a smooth 0..1 "screen value": 0 at dot centres, 1 midway between dots.
float dotScreen(vec2 q, float pitch, float angleRad)
{
    float c = cos(angleRad), s = sin(angleRad);
    vec2  r = mat2(c, -s, s, c) * q / pitch;
    vec2  f = fract(r) - 0.5;
    float d = length(f) * 2.0;        // 0 at centre, ~1 at the cell edge
    return clamp(d, 0.0, 1.0);
}
```

Feed that as `screen` into `thresher()`. Because `thresher` compares `screen` against the
transition coordinate `t`, the *effective dot radius* automatically grows as `t` falls — you get AM
behaviour for free without ever computing a radius.

### 1.4 Projection: screen-locked or object-locked?

The patent frames this as the central unsolved problem, not a fixed answer:

> "the disposition of a dot pattern when the dot pattern is simply projected into a scene and a
> character in the scene turns. The question becomes **should the character swim through the
> pattern, should the pattern stick to the character but potentially stretch, or should additional
> patterns be filled in.**" — US 11270474 [DOC]

The resolution is that Hatcher offers **four projection modes** and the artist picks per shot [DOC]:

1. **UV space** — sticks perfectly, stretches with UV distortion.
2. **Screen space** — perfectly even pitch, but the character swims through it.
3. **Single axis** — one planar projection.
4. **Tri-planar** — blend of three planar projections by normal, with **per-axis transform
   overrides** because "when a camera is very wide or object shape or foreshortening resulted in
   unwanted compression or stretching" tri-planar fails on some axes.

Hatcher's projector consumes **`P` (position), `Pref` (reference position), `N` (normal), and
`UV`** [DOC]. It can additionally lock to **object space or bounding-box centre**, and an **animated
axis input** can be attached "to match the translation and rotation of the object" [DOC].

And Marco Recuay states the art direction explicitly:

> "the halftone dots you see in rim lights on a character. **In some instances, you want those to
> track along with the character, such as when Miles is swinging by on a web, otherwise he'll appear
> to be swimming through a pattern. Other times, you want them to be a little looser, so they feel
> like lights and not a texture.**" — Foundry [DOC]

**Implementation guidance [EST]:** default to **object-locked tri-planar** for character and prop
surface tone, and **screen-locked** for anything that reads as light rather than material (glows,
rim light, flares, god rays). Expose a per-material 0–1 blend so you can dial between them, because
that is exactly the control the film shipped with.

```glsl
// Hatcher projection. Returns the 2D coordinate to screen in.
vec2 hatcherCoord(int mode, vec3 P, vec3 Pref, vec3 N, vec2 uv, vec2 screenUV,
                  mat3 objInv, vec3 objCentre)
{
    if (mode == MODE_UV)     return uv * uUVScale;
    if (mode == MODE_SCREEN) return screenUV * uResolution;   // pitch in device px
    vec3 Po = objInv * ((uUseRest ? Pref : P) - objCentre);    // object-locked
    if (mode == MODE_AXIS)   return (uAxisBasis * Po).xy;
    // tri-planar: blend the three planar projections by |N|, per-axis scales
    vec3 w = pow(abs(N), vec3(uTriSharpness));
    w /= (w.x + w.y + w.z);
    return w.x * Po.zy * uAxisScale.x
         + w.y * Po.xz * uAxisScale.y
         + w.z * Po.xy * uAxisScale.z;
}
```

### 1.5 Dots scale with camera distance

The **granted independent claim** of US 11270474 — i.e. the legally load-bearing novelty — is
specifically about distance scaling:

> "the generated patterns including dots that run along edges of the character such that **the dots
> get larger as the character comes closer to the camera and the dots get smaller as the character
> moves away** from the camera" [DOC]

So apparent dot size is **not** constant in screen space by default; it is object-locked and
therefore foreshortens. To stop the pitch collapsing below a pixel at distance there is a
**bifurcation mode**:

> "an optional bifurcation mode which uses **derivatives to normalize the pattern scale** (i.e., if
> the patterns became too large, then the lines or dots are **split**)." [DOC]

That is a mip/LOD scheme on the screen itself. In GLSL, `fwidth` gives you the derivative directly:

```glsl
// Keep the projected pitch inside [minPx, maxPx] of screen space by octave-doubling,
// which is the "bifurcation" behaviour: too coarse -> split into more, finer dots.
float bifurcatedPitch(vec2 q, float basePitch, float minPx, float maxPx)
{
    float pxPerUnit = 1.0 / max(length(fwidth(q)), 1e-6);   // screen px per q unit
    float pitchPx   = basePitch * pxPerUnit;
    float octaves   = 0.0;
    if (pitchPx > maxPx) octaves =  ceil(log2(pitchPx / maxPx));
    if (pitchPx < minPx) octaves = -ceil(log2(minPx / pitchPx));
    return basePitch * exp2(-octaves);
}
```

Crossfade between adjacent octaves on the fractional part to avoid a visible pop.

**A limitation I hit when actually running this** (see [Appendix E](#appendix-e--verification)): the
bifurcation above normalises **isotropic** scale only. On a surface seen at a grazing angle — a
ground plane receding to the horizon is the worst case — the projected lattice is compressed along
one axis only, and the dots stretch into ellipses rather than staying round. `fwidth` returns a
single scalar and cannot express that. If you need round dots at grazing angles you have to
normalise anisotropically, using the full screen-space Jacobian of the projection:

```glsl
// Anisotropic pitch normalisation: scale each axis of q by its own screen-space
// derivative, so a lattice seen at a grazing angle keeps round dots.
vec2 isotropiseCoord(vec2 q)
{
    vec2 dqdx = dFdx(q), dqdy = dFdy(q);
    // per-axis screen-space rate of change of q
    float sx = max(length(vec2(dqdx.x, dqdy.x)), 1e-6);
    float sy = max(length(vec2(dqdx.y, dqdy.y)), 1e-6);
    float s  = sqrt(sx * sy);                 // geometric mean preserves overall density
    return vec2(q.x * s / sx, q.y * s / sy);
}
```

This is my own addition, not something the patent describes — the patent only mentions per-axis
*transform overrides* supplied by the artist for exactly this failure case, which suggests
Imageworks solved it by hand per shot rather than automatically [DOC].

### 1.6 The three-tier system

The user's quote is Justin K. Thompson, ITSV production designer, in Keyframe:

> "I wanted there to be **one set of screentones for the highlights, one for the half tones and then
> another one for the shadows.** If you look at the comics, that's actually how they do it." [DOC]
> <https://keyframemagazine.org/2019/03/01/web-of-innovation/>

He also gives the *reason*, which is a lighting requirement rather than a texture one:

> "I needed characters to be able to **walk through these dots and be affected by them**. If there's
> a light source on screen, I needed it to actually interact with the character in an exact way."
> [DOC]

The patent gives the mechanical realisation, with a concrete band count:

> "if the thresher 130 is set to quantize the image into **four luminance sections**, the thresher
> could be set to apply **dots to the two brightest** sections, and **hatch lines to the two
> darker** sections." [DOC]

So the three tiers are **three different pattern assignments across the band stack**, not three
overlaid screens:

| Tier | Tone range | Pattern | Behaviour |
| --- | --- | --- | --- |
| Highlight | brightest band(s) | dots, sparse, multiplier **> 1** | reads as light/glow; often screen-locked |
| Half-tone | middle band(s) | dots, AM, multiplier ≈ 1 → < 1 | reads as material; object-locked |
| Shadow | darkest band(s) | **hatch lines**, not dots | reads as ink; see §2 |

That directly answers *"do dots appear in highlights as well as shadows?"* → **dots appear in
highlights and mid-tones; shadows get hatching instead.** Dots in the deepest shadow are the
exception, not the rule.

### 1.7 Dots on rim light, flares and glows

Documented, and unusually specific:

> "in the train station, the **flares had halftones which scaled with light** and changed the
> appearance of them based on how the realistic flares react. **Halftone dots were sprinkled to
> represent the glows.**" — Geeta Basantani [DOC, Foundry]

> "using the Thresher and Hatcher tool to **dial them thick and thin based on the shading from
> lighting.** The artist had freedom to dial the **size, angles and space** between the screentones."
> — Geeta Basantani [DOC, Foundry]

Implementation: run a **second, independent screen** on your bloom/glow buffer, screen-locked,
coarser pitch, with the multiplier biased above 1.0 so dots read as emissive. Drive its dot radius
from the glow intensity so the dot field visibly grows as a light blooms.

### 1.8 Measured numbers

**No published source states dot pitch in pixels or screen angles.** The following are my
measurements. Method, cross-checks and error bars in [Appendix A](#appendix-a--measurement-method-and-its-limits).

Target: the ITSV collider/accelerator shot published by fxguide at 1920×1080 with a 2.39:1
letterbox, so the **live picture height is 803 px**.

<img src="/opt/cursor/artifacts/01_halftone_lattice.png" alt="Halftone lattice measurement: crop with overlaid 8 px lattice, power spectrum showing two orthogonal peaks at 45 and 135 degrees, and nearest-neighbour distance histogram peaking at 7.5-8.5 px" />

**[MEAS] Result — the dot field in the mid-tone band:**

| Quantity | Value | How obtained |
| --- | --- | --- |
| Lattice type | **square** | two equal orthogonal spectral fundamentals |
| Nearest-neighbour pitch | **8.0 px** at 803 px picture height | FFT peak; independently, NN-distance mode 7.5–8.5 px |
| Lattice orientation | **45° / 135°** to the frame axes | FFT peak bearings; NN bearings peak at 45–60° and 135–150° |
| Axis-aligned pitch | 8.0 × √2 = **11.3 px** | geometry of a 45°-rotated square lattice |
| Resolution-independent | **≈ 100 dot rows per picture height** along the lattice axis (≈ 71 along the frame axes) | 803 / 8.0 |

Two independent methods agree, which is why I trust this one: the zero-padded FFT gives 8.0 px at
45° and 135° plus a third component at 5.6 px ≈ 8.0/√2 (the (1,1) harmonic a square lattice must
have), and a completely separate geometric pass that locates 569 individual dot centres and
histograms nearest-neighbour distances peaks at 7.5–8.5 px with nearest-neighbour bearings at 45°
and 135°.

**[MEAS] On the CMYK screen-angle hypothesis — the answer is no.** I measured the three
subtractive separations independently (C = 1−R, M = 1−G, Y = 1−B) on the same patch:

| Separation | Dominant period | Angle |
| --- | --- | --- |
| C = 1−R | 8.0 px | 45.0° / 135.0° |
| M = 1−G | 8.0 px | 45.0° / 135.0° |
| Y = 1−B | 8.0 px | 45.1° / 135.0° |

**All three inks share one screen, at one angle, at one pitch.** There is no 15°/75°/0°/45°
rotation. This makes sense given §1.2: the screentone is a *single luminance-derived multiplier*
applied to all channels at once, so it physically cannot have per-ink angles. Do **not** implement
four rotated screens — you will get moiré rosettes the film does not have.

The one place I saw a separation break angle was a *line* screen on the collider ceiling, where
C and M sat at ~178.5° with period ~17.8 px but Y sat at ~154.6° with period ~14.6 px. That is one
region in one frame and could easily be scene content; I would not build on it.

**[EST] Recommended parameters for a 1080p-picture-height target**, scaling my measurement:

```
pitch (mid-tone character screen) : 10.7 px  (= 8.0 * 1080/803), lattice at 45 deg
pitch (highlight / glow screen)   : 16-21 px, screen-locked, 0 or 45 deg
pitch (background / far LOD)      : bifurcate to keep projected pitch in [6, 24] px
band count                        : 4 (patent's own worked example)
dots on                           : bands 0-1 (brightest two)
hatching on                       : bands 2-3 (darkest two)
```

---

## 2. Hatching

### 2.1 It is the same tool

Hatching is not a separate system: **Hatcher generates "dots, lines, and grid patterns"** from the
same projection machinery [DOC, US 11270474]. Everything in §1.4 (four projection modes, object
lock, animated axis, bifurcation) applies unchanged. The difference is only the pattern function
and which Thresher bands it is assigned to.

```glsl
// Line screen. Same q as dotScreen, so it inherits the same projection and bifurcation.
float lineScreen(vec2 q, float pitch, float angleRad)
{
    float c = cos(angleRad), s = sin(angleRad);
    float u = (mat2(c, -s, s, c) * q).x / pitch;
    return abs(fract(u) - 0.5) * 2.0;   // 0 on the line, 1 between lines
}

// Cross-hatch: two line screens at different angles, combined by min() so both darken.
float crossHatch(vec2 q, float pitch, float a0, float a1)
{
    return min(lineScreen(q, pitch, a0), lineScreen(q, pitch, a1));
}
```

### 2.2 Where hatching goes, and what drives it

> "**A lot of our shadows were hatches.** We'd combine line work, **thick to thin**, to get an
> overall value." — Danny Dimian [DOC, VFX Voice]

> "in sections that are relatively bright, the thresher application applies dots, whereas in
> sections that are **relatively dark or shadowy**, the thresher application **applies lines**."
> — US 11270474 [DOC]

So: **hatching is the shadow-tier pattern**, and it is lighting-driven, with line *weight* carrying
tone ("thick to thin… to get an overall value"). It is not a uniform texture overlay.

Because it lives in a Thresher band transition (§1.1), hatching naturally concentrates at the
**terminator** — the boundary between the lit band and the shadow band — which is exactly where a
comic inker puts it. You get that for free from the band architecture; you do not need a separate
"terminator" term.

### 2.3 Angles, spacing, thickness

Artist-controlled, per the Foundry quote in §1.7: "freedom to dial the size, **angles** and space
between the screentones". Hatcher exposes "control over **scale, orientation, spacing, and
hardness**" [DOC, US 11270474]. No source gives numbers.

**[EST]** Defaults that reproduce the look, scaled to 1080p picture height:

```
single hatch pitch        : 7-11 px
cross-hatch second angle  : first angle + 60 to 90 deg (not 90 exactly; 90 reads mechanical)
primary hatch angle       : 30-45 deg from horizontal
line width / pitch ratio  : 0.15 at the light end of the band -> 0.55 at the dark end
hardness (edge softness)  : 0.5-1.5 px equivalent; keep it crisp, see Dimian on softness in Sec. 5
deepest shadow            : add the second hatch direction only in the darkest band
```

Drive `width/pitch` from the band transition coordinate `t`, which gives the thick-to-thin
behaviour Dimian describes:

```glsl
float hatchMask(vec2 q, float t, float pitch, float a0, float a1, bool cross)
{
    float w = mix(0.15, 0.55, 1.0 - t);          // thicker as we go darker
    float s = cross ? crossHatch(q, pitch, a0, a1) : lineScreen(q, pitch, a0);
    return smoothstep(w - uSoft, w + uSoft, s);  // 0 on ink, 1 on paper
}
```

### 2.4 Does it boil?

**No source I found states that the halftone or hatch screens are re-randomised per frame**, and the
architecture argues against it: the whole point of the projection modes and the animated-axis input
is *temporal stability*, so that characters do not "swim through the pattern" [DOC]. The patent also
lists "how to handle **stereoscopic output** with slightly offset views of the same object" as a
problem the system must solve [DOC] — which is only possible if the screen is spatially coherent in
3D, not re-seeded per frame.

**[EST]** Keep screens temporally stable and locked to geometry. The boiling in the film's line
quality comes from the **ink lines** (§3.5), which genuinely are redrawn, and from the **per-part
frame rate stepping** (§6) — not from the screens.

---

## 3. Ink lines

### 3.1 Two generations of a different system

Ink lines are a separate patent: US 11,763,507 B2 "Emulating hand-drawn lines in CG animation",
inventor **Pawel Grochola**, filed 2019-10-16, granted 2023-09-19, from provisional 62/775,843
(2018-12-05) *"Ink Lines and Machine Learning for Emulating Hand Drawn Lines"* [DOC]
<https://patents.google.com/patent/US11763507B2/en>

The patent opens by rejecting the obvious approach outright:

> "It was determined that approaches involving 'line work/ink lines' based on procedural 'rules'
> (e.g., **using Toon Shaders**) were **ineffective** in achieving the satisfactory results. The main
> problem was that **the artists do not draw based on the limited rule sets.**" [DOC]

This is worth internalising before you write a contour shader. Sony tried the standard NPR
approach — depth/normal discontinuity edge detection, à la a Sobel on a G-buffer — and rejected it.
What shipped instead:

- **Adhering mode**: an artist draws ink lines with a stylus **directly onto the 3-D character**;
  the curves are attached to the geometry. Used "on the most complex shots, where adjusting the
  machine learning… is slower than obtaining the shot from scratch" [DOC].
- **Adjusting mode**: an ML model **predicts** the drawing from **shot data = camera angle +
  expression**, and the artist corrects it with a **"nudging brush"**; nudges are **keyed and
  interpolated** [DOC].
- Training is two-pass: first-pass drawings → UV space → first-pass training data; repeat →
  second-pass data; combine → **second-generation model** [DOC]. Training data "uses animated curves
  created for a set of angles with a set of corresponding expression changes" [DOC].

Ink lines are **curves in 3-D space**, not an image-space filter:

> "inklines are **curves in 3D space** and in Into the Spider-Verse we use them a lot on **face and
> hands** in order to make you feel like [a hand-drawn] character rather than 3D render. It's a
> **stylization layer**." — Edmond Boulet-Gilly, inkline technical lead, Imageworks, Blender Conference 2023 [DOC]
> <https://www.youtube.com/watch?v=8yHuJLeAAsA>

### 3.2 Scale: how much of the film has them

> "it's almost **90% of all the shots in the movie** that received inklines." — Blender Conference
> 2023 [DOC]

ITSV used them mainly on faces and hands. ATSV extended them to **full body, clothes, environments,
props, crowds, vehicles and even effects**, with a per-character logic [DOC, Blender 2023]:

| Element | Ink-line behaviour |
| --- | --- |
| Peter B. Parker | lines on his dress/clothing folds |
| Miguel O'Hara | lines **overshooting past his shoulder silhouette** |
| Hobie Brown | "**paper line** around his body"; "covered in inkline" |
| The Spot | **construction lines inside him** — the cylinders/volumes an artist sketches |
| Vulture | "sketchy **quill pen** strokes on old worn parchment" |
| 2099 world | "very **architectural**, based on camera perspective, with a lot of line work **overshooting from the surface**" |
| Mumbattan / India world | "1970s Indian comics… very rough, very loose, sketchy, **really heavy inks**" |
| Smoke / FX volumes | lines adhered to a **point cloud of the volume's velocity**, since there is no surface to project onto |

**Overshoot is a recurring, nameable feature** — lines that run past the silhouette they describe.
That is cheap to implement and very characteristic.

### 3.3 Grease Pencil, and why it is not rotoscoping

For ATSV, artists drew in **Blender Grease Pencil**, then exported to Maya/Houdini/Katana/Nuke
[DOC, Blender 2023]. The critical mechanic:

> "while it's true that we do **draw our lines in screen space**… we'll **project our lines onto the
> model and stick them on there**… because our lines are now attached to the model it actually
> **follows the animation**, which means we don't have to draw every single frame anymore."
> [DOC, Blender 2023]

And when the projection breaks down:

> "because we are projecting the lines from camera screen space, **if the character turns away from
> the camera or moves around a bit too much we do have to redraw the lines** on those frames."
> [DOC]

They built a custom interpolation tool (deliberately not Blender's built-in one, because theirs had
to be pipeline-cross-compatible *and* 3D-aware):

> "it will use the frames at the beginning and end of the range as parents to create a child that is
> a mix of the two, so **where the model starts to move it will begin to erase out the lines on the
> previous frame and then, sampling from the next frame, it'll begin to draw in** — while taking the
> 3D animation into account." [DOC, Blender 2023]

That crossfade — **one line set erasing off while the next draws on** — is the mechanism behind the
characteristic ink "boil". It is not noise; it is a keyframe-to-keyframe handoff.

### 3.4 The Kismet curve system (ATSV, Houdini)

For procedurally generated lines ATSV used a Houdini system referred to at the Gnomon panel as
**Kismet** [DOC, Gnomon Q&A]. Silhouette base curves are found by the standard method — per-polygon
**sign flip of the dot product** between view vector and normal, then splitting those polygons to
get a sub-polygon-accurate curve — after which secondary lines are placed **on** those base curves
and stylised by **tapering and offsetting**; the curves are handed to Katana for rendering, and
lighting can **modulate curve thickness or cull curves entirely** [DOC].

There was also a **procedural mode** driven by artist sliders:

> "it's **rule based rather than handmade**… sliders would control the underlying tool set to make
> really sketchy lines, make them looser or more rough, they could play with a **thick-thin**… those
> sliders become a **preset**, and then those presets get saved for a character." — Gnomon panel
> [DOC] <https://www.youtube.com/watch?v=NbatURNBv6Y>

So each character has a named line-style preset. Worth mirroring in your material system.

### 3.5 Redraw rate / boil

Lines react to motion, and this is stated explicitly:

> "all those layers of inkline are **reacting to how the character moves — depending on how fast or
> slow it's moving the inkline is behaving differently** — and that kind of emulates the traditional
> process of 2D animation." [DOC, Blender 2023]

**[EST] Implementation:** hold each line set for N frames, then crossfade to a freshly evaluated
set, with N driven by **screen-space angular velocity** of the owning partition:

```
redrawInterval = clamp(round(K / (1 + screenAngularVelocity)), 1, 4)   // frames
```

so a still character's lines hold for 3–4 frames (visible boil) and a fast-turning one is redrawn
every frame (lines keep up). Crossfade over ~1 frame using per-stroke arc-length erase-on/draw-off
so it reads as drawing rather than dissolving.

### 3.6 Colour, weight, taper

> "one could put wrinkles around a character's eyes and also use the **soft color line of 2D
> animation, making it any color the animator wanted**." — Keyframe [DOC]

Lines are **coloured, not black**. Weight varies along the stroke ("thick-thin"), and overshoot is
deliberate.

**[MEAS] I measured one.** On the ITSV Gwen still (2000×838), at the silhouette where her white
hood meets her black bodysuit:

<img src="/opt/cursor/artifacts/03_ink_line.png" alt="Ink line measurement: crop showing a cyan line on Gwen's hood silhouette, per-channel profiles where G and B coincide while R alone is displaced, and the G-minus-R chroma curve peaking at 0.173" />

| Quantity | Value |
| --- | --- |
| Flank A (hood) | `#E5DBD9`, luma 0.867 |
| Flank B (suit) | `#160B0B`, luma 0.053 |
| Line colour at peak | `#477373` — a desaturated **teal/cyan** |
| Line width | **5–6 px** at 2000 px frame width (≈ 3 px core) |
| Peak chroma | G − R = **+0.173** at the centre |
| Channel behaviour | **G and B coincide to within 0.002; R alone is displaced ≈ 1 px and suppressed** |

The last row is the interesting one. A neutral antialiasing ramp between `#E5DBD9` and `#160B0B`
would stay grey; instead the transition swings strongly cyan. And because G and B track each other
exactly while R departs, the effect is specifically **the cyan separation (1−R) being offset and
strengthened**, not a generic RGB fringe. So on this edge the "ink line" and the
"misregistration" (§4) are the *same operation* seen at a sharp edge.

**[EST]** Implement silhouette lines as a **per-channel offset plus a chroma push**, not as a
composited dark stroke:

```glsl
// Coloured silhouette ink: offset the cyan separation outward along the silhouette normal
// and deepen it. dirN = screen-space outward normal of the silhouette.
vec3 inkEdge(vec3 base, vec2 uv, vec2 dirN, float edgeMask)
{
    float k = uInkOffsetPx * edgeMask;
    float rShift = texture(uBeauty, uv - dirN * k * uTexel).r;   // cyan plate lags
    vec3  c = vec3(rShift, base.g, base.b);
    return mix(base, c * uInkTint, edgeMask);                    // uInkTint ~ vec3(0.85,1.0,1.0)
}
```

---

## 4. Depth of field as chromatic misregistration

### 4.1 It is genuinely not a blur

This is the most unambiguous statement in all the source material:

> "We have the same image offset. **It isn't a blur. It isn't out of focus. It's an image with
> different colors offset based on z-depth**, so it looks out of focus. But it feels natural because
> we use it consistently." — Danny Dimian [DOC, VFX Voice]

> "We noticed that sometimes in printing comic books, the color offsets were not aligned properly and
> this looked like the image was out of focus… **What if the camera didn't de-focus like a lens?**
> So, we **splintered and offset** the image in a way that is similar to a misprinted comic book
> page." — Danny Dimian [DOC, fxguide]
> <https://www.fxguide.com/fxfeatured/why-spider-verse-has-the-most-inventive-visuals-youll-see-this-year/>

> "Avoiding softness in the film meant **avoiding using a traditional lens blur** for the camera
> focus and depth of field." — Sony Pictures Imageworks [DOC]
> <https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse>

So: **channel offset driven by z-depth, no Gaussian.** The Nuke tool for it was called
**ChromaShifter**; on ATSV it was repurposed with **motion vectors instead of depth** to make motion
trails [DOC, SIGGRAPH 2023 / Gnomon].

### 4.2 Measured behaviour

<img src="/opt/cursor/artifacts/02_defocus_misregistration.png" alt="Misregistration measurement: defocused background crop, per-channel profile showing G lagging R by 4-5 px with cyan and magenta fringes, and a box plot of fringe per unit contrast in focus versus defocused" />

**[MEAS]** On the ITSV diner shot (fxguide still, 1920×1080, picture height 803 px), reading raw
per-channel pixel values across the defocused menu boards in the background:

| Quantity | Value |
| --- | --- |
| Channel order across the edge | **R, then B, then G** (left to right) |
| G displacement relative to R | **+4 to +5 px**, consistent sign across several independent features |
| B displacement relative to R | ≈ +2 px, i.e. **B sits between R and G, nearer R** |
| Total 3-channel spread | **≈ 5 px** at 803 px picture height (≈ 0.6% of picture height) |
| Fringe on the leading flank | **cyan** (G high, R low), peak R − G = **−0.26** |
| Fringe on the trailing flank | **magenta** (R high, G low), peak R − G = **+0.23** |
| Per-channel transition width | R and B ≈ 1.5 px **wider** than G |

Direction: predominantly **horizontal**, with a smaller vertical component. I could not establish a
globally consistent direction across the whole frame — the sign flips between regions — so it is
**not** a single rigid plane shift of the whole image. It is locally varying, consistent with being
driven per-pixel by depth rather than applied as a global transform.

**Does it scale with circle of confusion? Yes, but the honest answer is more nuanced than
"only out of focus."** Measuring *chroma excursion relative to the flank-to-flank baseline* (which
removes genuine colour changes — a green jacket beside a red scarf is saturated without any
misregistration):

| Region | Median fringe / edge contrast | Fringe spatial extent |
| --- | --- | --- |
| In focus (6 sharp edges: cup, tray, bench, jacket) | **0.15** | 2–5 px |
| Defocused (5 background edges: menu boards, far wall) | **0.77** | 5–10 px |

So per unit of edge contrast the defocused fringing is **about 5× stronger**, and spatially about
twice as wide — **but in-focus edges still fringe** (median 0.15, up to 0.21 on the cup rim). The
Gwen ink-line measurement in §3.6 is exactly such an in-focus fringe. Treat the offset as having a
**non-zero floor at the focal plane** plus a depth-driven term, not as something that switches on
only when defocused.

### 4.3 CMY or RGB?

Both descriptions appear in the sources: fxguide calls it "a digital version of **4-color printing**"
and Keyframe says "the **CMYK offset**" [DOC], while Dimian says "different **colors** offset based
on z-depth" [DOC].

**Geometrically it makes no difference** — shifting the C plane is shifting the R channel, since
C = 1 − R. The difference is entirely in **how the shifted planes recombine**:

- **Additive (RGB)**: overlaps brighten toward white.
- **Subtractive (CMY)**: overlaps darken, and the result stays inside the ink gamut.

ATSV built an explicit **CMYK separator tool and a `PigmentMerge`** node for "subtractive colour
compositing to avoid an additive bias toward white" [DOC, SIGGRAPH 2023 / Gnomon]. Do it
subtractively.

```glsl
// Depth-driven misregistration, subtractive. Offsets are per-separation, in px.
vec3 misregister(sampler2D beauty, vec2 uv, float coc)
{
    // coc: signed circle-of-confusion in px from your depth/focus model
    float m = uFloorPx + abs(coc) * uDepthGain;          // non-zero floor at focus, Sec. 4.2
    vec2  dir = normalize(uOffsetDir);                   // ~horizontal
    // measured ratios: C:M:Y displacement approx 0 : 1.0 : 0.45  (R : G : B)
    vec2 oC = dir * m * 0.00;
    vec2 oM = dir * m * 1.00;
    vec2 oY = dir * m * 0.45;
    // sample each separation at its own offset, convert to subtractive, merge, convert back
    float C = 1.0 - texture(beauty, uv + oC * uTexel).r;
    float M = 1.0 - texture(beauty, uv + oM * uTexel).g;
    float Y = 1.0 - texture(beauty, uv + oY * uTexel).b;
    return vec3(1.0 - C, 1.0 - M, 1.0 - Y);
}
```

With `uFloorPx ≈ 1.0` and `uDepthGain` tuned so the far background reaches `m ≈ 6–7 px` at 1080p
picture height, this reproduces my measurements (5 px spread at 803 px → ≈ 6.7 px at 1080 px).

### 4.4 Near field vs far field

**[EST]** No source distinguishes them and my one measurable still has a deep background but no
strong foreground defocus. Given the effect is driven by signed z-depth, the natural and
art-directable choice is to **reverse the offset direction** either side of the focal plane, so near
and far defocus are distinguishable rather than identical. Magnitude should ramp with |CoC| and
clamp — real comic misregistration is a fixed press error, so very large offsets stop reading as
print and start reading as an anaglyph. I would cap at roughly **1% of picture height**.

---

## 5. Shading: quantisation and designed shadow shapes

### 5.1 The no-smooth-falloff rule

> "The comic book illustrators **didn't draw anything that was really soft**, so we tried not to have
> anything blurry. We tried to **avoid grades** by turning those into half-toning, and avoided
> traditional material looks by having them **quantized** using brush strokes and other ways to break
> up the form. We would have **stepped values to avoid smooth grads**, and then **broke those up with
> half-toning**. A lot of our shadows were hatches. We'd combine line work, thick to thin, to get an
> overall value." — Danny Dimian [DOC, VFX Voice]

> "soft gradations are avoided in favor of halftoning and line hatching… The look strives for the
> raw emotion of illustration." — Sony Pictures Imageworks [DOC]

The rule in one line: **every smooth gradient becomes a step, and every step edge becomes a
screen.** That is the whole shading model. Note the order — quantise *first*, then dither the steps.
A common mistake is to overlay halftone on a smooth render, which gives you texture but not the
graphic read.

### 5.2 Is it a toon ramp?

Not in the usual sense. There is no `floor(NdotL * n) / n` in the documented pipeline. Instead the
Thresher (§1.1) quantises **in comp**, on the luminance of the render, with **per-band artist
control of position, width, transition width, transition pattern and colour correction** [DOC].

That distinction matters for implementation. A toon ramp gives you evenly spaced bands you cannot
art-direct. Thresher gives you a small number of **independently positioned** bands — which is how
you "design" a shadow shape: you move the band edge until the shadow falls where the art wants it,
independent of the actual light.

The patent also documents an **anime variant**: substitute "a uniform grey value… for the
screen-tone. This may force each band of the gradient to step at the same value, thereby simplifying
the screen-tone gradients into **simple contours**" [DOC]. That is your toggle between
"printed comic" and "clean cel".

### 5.3 How many steps?

The patent's own worked example is **four luminance sections** [DOC, §1.6]. It says "a fixed number"
and gives no other figure.

**[MEAS]** I measured tone quantisation on four stills by masking to low-gradient pixels (plateau
interiors) and histogramming their luma:

<img src="/opt/cursor/artifacts/04_tone_quantisation.png" alt="Tone quantisation histograms for three regions, showing plateau fractions of 75, 38 and 31 percent with discrete luma spikes" />

| Region | Plateau fraction (|∇luma| < 0.004) | Significant luma steps found |
| --- | --- | --- |
| Gwen white hood | **75%** | 0.058 (plus fine sub-structure 0.016–0.040) |
| Peter red suit torso | **32%** | **0.203**, 0.082, 0.031 |
| `kid.jpg` mid region | **38%** | **0.179**, 0.106 ×2, plus 0.02–0.04 |
| `curvatture.jpg` mid region | **31%** | — |

Two robust conclusions:

1. **30–75% of a typical region is exactly flat.** That is enormously higher than a smooth-shaded
   render and is the strongest single signature of the look.
2. **Per material there are only a handful of large tone breaks** — luma steps of **0.08 to 0.20** —
   separating those plateaux.

The finer 0.016–0.04 structure sits at the 8-bit/JPEG quantisation floor (1/64 = 0.0156) and I
cannot separate it from compression artifacts, so I do not claim it.

**[EST] Recommended:** **3–5 bands per material**, with band edges **art-directed rather than
evenly spaced**, and luma steps of **0.08–0.20** between adjacent plateaux. Transition width ~4–8%
of the luma range, filled with the appropriate screen.

### 5.4 Designed shadow shapes

The mechanism is the per-band `position` control: you are choosing a luminance *threshold*, so the
shadow's shape is the iso-contour of the lighting at that threshold. To get shapes that are
genuinely designed rather than physical, the film added **room shaders** — US 12,293,452 B2 "Room
shaders for animated movies", inventors **Bret St. Clair** and **Ole Gulbrandsen** [DOC]
<https://patents.google.com/patent/US12293452B2/en> — together with a provisional on
**"Quantization of Surface Normals"** [DOC].

Quantising the *normal* rather than the *shade* is the key trick for designed shadows: it forces
curved surfaces to read as a small number of flat facets, so the terminator lands on a designed
edge instead of wandering smoothly.

```glsl
// Quantise the normal toward a small set of directions before lighting, so the
// terminator snaps to designed facets rather than sliding around a curve.
vec3 quantiseNormal(vec3 N, float steps)
{
    vec3 q = normalize(N);
    q = round(q * steps) / steps;
    return normalize(mix(N, q, uNormalQuantAmount));
}
```

---

## 6. Frame rate and animation

### 6.1 The mechanism

Animation on **"twos"** means each pose is held for 2 frames of a 24 fps master, giving 12 distinct
poses per second. Threes → 8 poses/s, fours → 6, sixes → 4. The master frame rate is always 24 fps;
"on Ns" describes the **pose update interval**, not a different playback rate.

ATSV built a dedicated tool to manage this, because per-part rates break every downstream sim:

> "in order to manage all of the different frame rate stuff there was a new tool developed called
> **Step sets**, because when you have these jumps of frame rates, things like cloth simulation… it
> makes it really hard to manage." — Alan Hawkins, Head of Character Animation, Gnomon panel [DOC]

So if you implement variable rates, **your cloth/hair/FX systems need to know about the stepping**,
or they will interpolate across held poses and cancel the effect. Budget for that.

### 6.2 Per-part frame rates — the Hobie Brown case

This is the clearest documented example, and it is **multiple rates on one character
simultaneously** rather than one rate per character. From the animation supervisor directly:

> "the rule that we landed on… was **different frame rates for different parts of his body at the
> same time** — so like **his body might be on twos and threes, his jacket would be on fours, his
> guitar would be on sixes** — and that kind of gave him more of the chaotic look that we liked, and
> it was more homogeneous too because it wasn't like different body parts being assembled."
> — Alan Hawkins, Head of Character Animation, Gnomon panel [DOC]

Note what they *rejected*: putting head and arms on separate layers "as if they were cut out from
different pieces of paper" — because "when you keep the arms and heads separate you kind of get like
a **South Park feel** to it" [DOC]. Per-part *timing* worked; per-part *cutout layering* did not.

Sources disagree on the exact numbers — see [Appendix B](#appendix-b--where-sources-disagree).

### 6.3 Miles' arc from twos to ones

The widely repeated account is that Miles begins the first film animated on twos and shifts to ones
once he masters his powers, encoding his arc in the frame rate.

**This is contradicted by a primary source.** Alan Hawkins — the same Head of Character Animation
quoted for Hobie's rates in §6.2 — has stated there was **no such intended meaning** behind the
frame rates on the first film. I flag this as genuinely disputed in
[Appendix B](#appendix-b--where-sources-disagree): the popular account is repeated by Business
Insider and many others, but I could not find it asserted by a named Imageworks supervisor in a
primary source, and I did find it denied by one. Note the asymmetry — the person best placed to know
is the one denying it.

**[EST] What to implement regardless:** the *technique* is well documented even if the narrative
gloss is not. A character on twos next to a character on ones is a real and striking effect. Use it
as a character/world differentiator (§9), which is unambiguously documented for ATSV.

### 6.4 Implementation

Hold poses by quantising the sampling time per partition:

```glsl
// CPU side, per partition (character, garment, prop):
// step = 1,2,3,4,6 ; phase lets you offset partitions so they do not all pop together
float heldTime(float t, int step, int phase, float fps)
{
    float f = floor(t * fps);
    float held = floor((f - float(phase)) / float(step)) * float(step) + float(phase);
    return held / fps;
}
```

Evaluate the whole animation graph for that partition at `heldTime`. Two cautions:

- **Offset the phase** between partitions. If body-on-twos and jacket-on-fours both update on even
  frames, the character reads as one stepped object rather than several.
- **Do not let the physics integrate through the hold.** Either step the sim at the same rate or
  freeze it during the hold.

### 6.5 Smears, multiples, motion blur

- **Smears / multiples**: Imageworks reused a Hotel Transylvania tool called **"post stamp"** that
  "creates geometry duplicates so you can have like **multiple limbs for smears**… without the full
  rig attached, it's much lighter" [DOC, Gnomon]. ATSV also added a tool for carving **negative
  space** into characters with temporary geometry, rather than modelling the shape [DOC, Gnomon].
- **Motion blur**: consistent with the no-softness rule, the film avoids photographic motion blur.
  Dimian's "we tried not to have anything blurry" [DOC] covers it, and the DOF section states
  outright that lens blur was avoided [DOC]. ATSV instead repurposed **ChromaShifter driven by
  motion vectors** to make **coloured motion trails** [DOC, SIGGRAPH 2023 / Gnomon] — i.e. motion is
  expressed as *channel offset along the motion vector*, the same idea as §4 but with a different
  driver.

```glsl
// Motion expressed as chromatic offset along the motion vector, not as a blur.
vec3 motionTrail(sampler2D beauty, vec2 uv, vec2 mv)
{
    float m = min(length(mv) * uTrailGain, uTrailMaxPx);
    vec2  d = (length(mv) > 1e-6) ? normalize(mv) : vec2(0.0);
    float C = 1.0 - texture(beauty, uv + d * m * 0.00 * uTexel).r;
    float M = 1.0 - texture(beauty, uv + d * m * 1.00 * uTexel).g;
    float Y = 1.0 - texture(beauty, uv + d * m * 0.45 * uTexel).b;
    return vec3(1.0 - C, 1.0 - M, 1.0 - Y);
}
```

---

## 7. Colour

### 7.1 Colour is replaced in comp, to a script

> "in Mumbattan as well as across Gwen's world, **colour was carefully scripted in by the art
> directors**, so a lot of times this would be the case where we're **completely replacing the colour
> wholesale**, so that we can get the specific distributions of colours in frames, or we can sync up
> with [the] colour script." — Gnomon panel [DOC]

This is worth taking literally: the render's colour is often discarded and re-authored. For a
real-time implementation the practical equivalent is a **per-shot palette LUT applied after
quantisation** — quantise luminance into bands (§5), then look up each band's colour from a
per-shot, per-world palette rather than from the albedo.

```glsl
// Palette-mapped banding: the band index selects a scripted colour, not a shade of albedo.
vec3 paletteShade(float luma, sampler2D palette, float paletteRow, float bandCount)
{
    float band = floor(clamp(luma, 0.0, 0.999) * bandCount);
    float u = (band + 0.5) / bandCount;
    return texture(palette, vec2(u, paletteRow)).rgb;
}
```

A 256×N RGBA16F palette texture with one row per world/shot gives you the colour script as data.

### 7.2 Simplification with depth

> "scenes are **selectively simplified** — so as you go into the background here, **detail is falling
> away** — and we're applying all the printing techniques and the colour offsets and screen-tone
> patterns and misregistration… in order to support art direction." — Gnomon panel [DOC]

So background elements lose detail *and* gain print artifacts with distance. In practice: drive
screen pitch coarser, band count lower, and misregistration stronger, all as functions of depth.

### 7.3 The Miles palette

**[EST] with partial documentation.** The cyan/magenta/purple association with Miles is consistently
reported but I found no source giving hex values. What *is* documented is that each world has a
primaries triad chosen by the art department, and that Gwen's is described differently by different
sources — see [Appendix B](#appendix-b--where-sources-disagree).

My best-informed reconstruction, for implementation, with the caveat that these are **my values
matched by eye against stills, not published figures** [EST]:

| Role | Miles / Earth-1610 | Gwen / Earth-65 |
| --- | --- | --- |
| Primary | `#00B4D8` cyan | `#F2A0C0` pink |
| Secondary | `#E0218A` magenta | `#7FE0C8` mint |
| Tertiary | `#7B2FBE` purple | `#9B6BD6` violet |
| Deep shadow | `#1A0B2E` | `#2B1B3D` |
| Paper / highlight | `#F5EFE6` | `#FBF3F0` |

Treat these as a starting palette to be replaced per shot, which is how the film worked.

### 7.4 Registering the offset against the palette

One practical note that follows from §4.3: if you do the misregistration subtractively on a
palette-mapped image, the fringe colours are determined by the palette, not by the offset. A cyan
plate offset against a magenta-dominant palette gives different fringes than against a
yellow-dominant one. Expect to tune `uOffsetDir` and the per-separation ratios per world.

---

## 8. Compositing and print artifacts

Documented elements, from the fxguide feature's own list and the supervisor interviews [DOC]:

| Element | Documentation | Implementation note [EST] |
| --- | --- | --- |
| **Misregistration** | "Misregistration to imply defocus" [fxguide] | §4 |
| **Graphic elements** | "used to fill the frame like 'BOOM' and 'POW'" [fxguide] | screen-space quads, held on the beat |
| **Panelization** | "breaks up action into" panels [fxguide] | §10.3 |
| **Halftone / hatching** | §1, §2 | — |
| **Paper grain** | implied throughout; Vulture is "on old worn parchment" [Blender 2023] | low-amplitude static noise, **locked to the frame not the camera**, ~2–4% amplitude, multiply |
| **Chromatic aberration** | distinct from misregistration; misregistration is the *deliberate* version | keep them separate; a radial CA on top of §4 doubles the fringing |
| **Glitch artifacts** | The Spot / Miles' "glitching" is a story element with its own look | horizontal band displacement + channel separation + scanline drop |
| **Lens flares** | "the flares had halftones which scaled with light" [Foundry] | **graphic, not anamorphic** — draw flares as hard-edged shapes then screen them (§1.7) |
| **Vignette** | not documented specifically | modest, and apply *before* the screen so the dots vignette too |
| **Zip ribbons** | ATSV motion graphic language | ribbon geometry along motion paths, flat-shaded, on their own frame rate |
| **Onomatopoeia typography** | "BOOM"/"POW" [fxguide] | see below |
| **Thought bubbles / caption boxes** | ATSV uses both | screen-space UI layer, composited before paper grain |

### 8.1 Typography

**No source I found names the typefaces.** This is a genuine gap. **[EST]** The onomatopoeia
lettering in the films is hand-drawn-style with heavy outlines, extreme weight, and per-letter
rotation and baseline jitter — the genre convention descends from comic letterers using Speedball
pens. For a real-time implementation the practical route is an SDF atlas of hand-drawn glyphs with
per-instance rotation/scale jitter, rather than a font file, because the expressive distortion is
the point. Caption boxes and thought bubbles use a condensed, slightly irregular
upper-case — comic lettering convention, again typically hand-drawn or a face imitating it.

If you need real fonts as a stand-in, the freely licensed **Blambot** family of comic faces is the
industry-standard reference point for the genre, but note this is my recommendation, not a
statement about what the films used.

### 8.2 Order matters

The film applied print artifacts "at the **last stage possible**… to allow us to get as many
iterations as possible" [DOC, Gnomon]. See [Appendix D](#appendix-d--suggested-render-graph-order)
for the full ordering.

---

## 9. Across the Spider-Verse: per-universe styles

The over-arching method is called the **"look of picture"**, and it starts before matte painting
because "we don't know those looks until we've figured out what the tools are capable of"
[DOC, Gnomon]. Each universe gets its own quantisation, line style, palette and frame-rate rules.

### 9.1 Earth-65 — Gwen's world (watercolour, emotional colour)

The most technically distinctive universe. Imageworks integrated **Rebelle** (Escape Motions), a
commercial natural-media painting application, into the pipeline:

> "the thing that really blew us away was their **watercolour solver** — it's super fast, so you paint
> in the software and it does these incredible simulations of watercolour, and you can **change
> gravity**, you can **wet the paper** and then you can apply watercolour on top of it and then the
> **watercolour bleeds into the paper**." [DOC, Gnomon]

> "in Gwen's world, for the backgrounds where we had watercolour in the backgrounds, we put these
> **Rebelle simulation**[s]" [DOC, Gnomon]

Rebelle was driven **from Houdini via JSON in batch mode over OpenCue**, exchanging **RGBA plus
impasto for wet and dry layers, water amount, and fluid velocity** [DOC, SIGGRAPH 2023 / Gnomon].

The emotional-colour rule: backgrounds shift hue with Gwen's emotional state, pulling away from
realism "towards linking to your imagination and the way you feel" [DOC, Gnomon].

**[EST] Real-time approximation:** you cannot run a watercolour fluid solver per frame in WebGL2 at
frame rate for full-screen backgrounds, but you can get most of the read with:

- **Edge darkening** (the watercolour "bloom" rim): dilate the wash mask, subtract, multiply — this
  single cue does most of the work.
- **Wet-in-wet bleed**: a few iterations of an anisotropic diffusion on the colour buffer, weighted
  by a paper-height texture.
- **Granulation**: modulate pigment density by the paper height map.
- **Backruns**: high-frequency noise thresholded against the wash gradient.
- **Emotional colour**: a per-shot hue-rotate/palette blend driven by a scalar "mood" uniform.

Amortise the diffusion across frames — the backgrounds are low-frequency and slow-moving.

### 9.2 Mumbattan — Pavitr Prabhakar's world

Line style is documented precisely:

> "in India world the kind of line work that we needed to do was really related to the **1970s Indian
> comics**… which is kind of like very rough, very loose, sketchy, **really heavy inks**."
> [DOC, Gnomon]

Colour was "carefully scripted in by the art directors" with wholesale replacement [DOC, Gnomon].
**[EST]** Implement as: heavier line weight (roughly 2× the Earth-1610 default), higher stroke
irregularity/jitter, lower band count (bolder posterisation), and a hot saturated palette dominated
by magenta/saffron/turquoise.

### 9.3 Earth-138 — Hobie Brown / Spider-Punk

The most aggressive style in the film, and the best documented for frame rate (§6.2). Its
distinguishing features [DOC, Gnomon + Blender 2023]:

- **Multiple simultaneous frame rates per body part** — body on twos/threes, jacket on fours, guitar
  on sixes.
- **"Paper line" around his body** — he reads as a cut-out, with visible cut edges: "we do represent
  the **cutout lines** a little bit on his body" [DOC, Gnomon].
- **"Covered in inkline"** — the densest line treatment of any character.
- Collage / screen-print / xerox register: limited flat spot colours, visible halftone at a much
  coarser pitch than the rest of the film, hard-edged torn-paper shapes.

**[EST]** Coarsen his halftone pitch to roughly 2–3× the film default so the screen reads as cheap
newsprint, restrict his palette to 3–4 flat spot colours plus paper, and add a per-limb paper-edge
outline with a slight drop offset so limbs read as separate cut pieces — while keeping the *pose*
unified, per §6.2's rejection of the South Park look.

### 9.4 Nueva York / Earth-928 — Miguel O'Hara

> "the line work in Miguel's World… was based on the work of **Syd Mead**, really leans into the
> strong **architectural styling with prominent perspective lines**." [DOC, Gnomon]

> "the 2099 world is receiving inkline that are very **architectural based on camera perspective**
> with a lot of **line work that is overshooting from the surface**." [DOC, Blender 2023]

> "we needed to be able to solve 2099 World which is based on the art of **Syd Mead** and to a lesser
> extent on that of **John Berkey**." [DOC, Gnomon]

Miguel himself has a specific rule: lines "**flow off his silhouettes**, like on his shoulders"
[DOC, Gnomon].

**[EST]** Implement as: perspective-locked line families (lines that align to the scene's vanishing
points rather than to surface curvature), generous overshoot past silhouettes (10–25 px at 1080p),
cool desaturated palette with high-key neon accents, and long specular streaks rather than diffuse
shading.

### 9.5 The Spot — Earth-1610 antagonist

> "he's got a really deceptively simple design but it evolves over the course of the story to
> visually represent his growing power. His key points include the **splotches** that make up his
> portals, and the **sketchy accent lines that go from scribbly to scrawly depending on his emotional
> state**." [DOC, Blender 2023]

> "if you look closely, spot actually has **construction lines** inside of him — those lines that
> artists draw to loosely define the volume… his torso might be defined as a cylinder."
> [DOC, Gnomon]

The powered-up form is called **Abyss**: "when he's all black and got all the dark energy"
[DOC, Gnomon]. His face is deliberately blank — an early test gave the facial spot full
expressiveness and it was rejected because "thematically what we wanted was for him to be **robbed
of that ability**" [DOC, Gnomon].

**[EST]** Minimal palette — pure white surface, pure black holes, no mid-tones — with a scalar
"chaos" uniform driving stroke jitter amplitude and construction-line opacity.

### 9.6 Vulture — Renaissance / Da Vinci

> "the vulture, **Mr Da Vinci blueprint** himself — he's comprised of **sketchy quill pen strokes on
> old worn parchment**, quite literally like an **ancient ink drawing that's come to life**."
> [DOC, Blender 2023]

> "vulture who was supposed to literally look like a drawing come to life." [DOC, Gnomon]

He was one of the two characters (with The Spot) that forced the adoption of Blender Grease Pencil,
because his style was "really difficult to capture with 3D tools" [DOC].

**[EST]** Implement as: sepia/iron-gall palette (`#3B2F1E` ink on `#D9C9A3` parchment), visible
parchment fibre texture *on the character* (not just the background), cross-hatch as the only
shading mechanism (no flat fills), and hand-drawn line quality with heavy taper and visible
pen-pressure variation. Notably he should carry **no halftone at all** — he predates printing.

### 9.7 LEGO universe — Earth-13122

**Not discussed in any of the primary technical sources I found.** It is widely reported that the
LEGO sequence was produced with involvement from a young LEGO animator and rendered in a distinct
brick-accurate style.

**[EST]** Technically it is the odd one out: hard plastic BRDF, no halftone, no ink lines, no
quantisation — its stylisation comes entirely from geometry (brick modularity, stud tiling,
limited articulation) and from stepped animation. If you implement it, treat it as a separate
material/render path rather than a parameter set of the main look.

### 9.8 Earth-42

Referenced at the Gnomon panel as one of the worlds with its own art rules, but no technical detail
is given in the sources I could reach. **[EST]** From the film itself: a darker, harder-edged
version of Earth-1610's language — same halftone architecture, lower key, more saturated reds,
heavier blacks.

### 9.9 Summary table

Frame rates are documented only for Hobie; the rest are **[EST]** based on the film's visible
stepping and on the documented principle that each world has its own rules.

| World | Line style | Tone system | Frame rate | Palette |
| --- | --- | --- | --- | --- |
| Earth-1610 (Miles) | moderate, coloured, face + hands | 4-band + halftone | ones/twos | cyan / magenta / purple |
| Earth-65 (Gwen) | soft, sparse | **watercolour wash**, minimal halftone | twos | emotional, shifts with mood |
| Mumbattan | **heavy, rough, sketchy** (1970s Indian comics) | bold, low band count | twos | hot saturated |
| Earth-138 (Hobie) | **densest; cutout paper lines** | **coarse screen-print halftone** | **body 2s/3s, jacket 4s, guitar 6s** [DOC] | 3–4 flat spot colours |
| Earth-928 (Miguel) | **architectural, perspective-locked, overshooting** | clean, high band count | ones | cool + neon |
| The Spot | **construction lines, scribbly→scrawly** | none (pure B/W) | varies with chaos | black / white only |
| Vulture | **quill pen, cross-hatch only** | **no halftone**; hatch only | twos/threes | sepia on parchment |
| LEGO | none | none | stepped | LEGO brick colours |

---

## 10. Camera language

### 10.1 What is and is not documented

**I could not find published focal-length or lens-package figures for either film.** I searched the
Gnomon panel transcript specifically and it contains no millimetre figures at all. Because these are
fully animated films there is no physical lens package to report, only virtual camera settings, and
those do not appear to have been published.

Two cautions on sourcing here. I encountered pages that state precise lens and pipeline specs for
these films — `cinecanon.com` and `videocue.io` among them — and both contain claims I could not
corroborate anywhere and at least one that is demonstrably invented (a non-existent SIGGRAPH 2018
NPR paper). They appear to be machine-generated. **Do not cite them, and be sceptical of any very
specific lens figure for these films that lacks a named source.**

### 10.2 What is documented

- **Avoiding lens behaviour is the governing principle.** "Avoiding softness in the film meant
  avoiding using a traditional lens blur for the camera focus and depth of field" [DOC, Imageworks].
  The camera is deliberately *not* photographic — DOF is misregistration (§4), motion is chromatic
  trailing (§6.5).
- **Very wide lenses are used, and they break the screen projection.** The Hatcher patent notes that
  tri-planar projection fails "when a **camera is very wide** or object shape or foreshortening
  resulted in unwanted compression or stretching" [DOC], which tells you wide-angle framing is
  common enough to have driven a tool feature.
- **Flares are treated graphically**, with halftones that scale with light [DOC, Foundry] — i.e.
  flare as drawn shape, not as optical artifact. That argues *against* an anamorphic streak model.
- **Aspect ratio 2.39:1.** [MEAS] Confirmed on unletterboxed stills: 2000×838 = 2.387.

### 10.3 Panel splits, freeze frames and caption cards

Documented as a core device: **"Panelization — breaks up action into"** panels [DOC, fxguide], and
"Graphic elements – used to fill the frame like 'BOOM' and 'POW'" [DOC, fxguide].

The editorial side is covered in Art of the Cut with editor **Michael Andrews, ACE** [DOC]
<https://borisfx.com/blog/aotc/art-of-the-cut-spider-man-across-the-spider-verse/>

**[EST] Implementation.** Panels are a screen-space compositing operation, not a camera operation.
The practical structure:

- Render the same scene from N virtual cameras into N viewports of an atlas, then composite them
  into panel rectangles with gutters. For a 2.39:1 frame, gutters of ~0.8–1.2% of picture width read
  correctly.
- **Freeze-frame + caption**: hold the beauty buffer of one panel while the others continue, then
  overlay a caption box. Because your look is already a post chain, a frozen panel is just a frozen
  input texture — the screens and grain should keep running over it or it will look like a still
  image pasted in.
- **"Shift into comic panel" transitions**: animate the panel rectangle's corners from full-frame to
  the panel bounds while simultaneously ramping band count down and halftone pitch up, so the image
  becomes *more printed* as it becomes a panel. That coupling is what makes the transition read.
- **Dutch angles and whip pans** are conventional camera animation; the only look-specific note is
  that a whip pan should express itself through §6.5's chromatic trailing rather than motion blur.

---

## Appendix A — measurement method and its limits

### A.1 Source material

Eight promotional stills from the fxguide ITSV feature
(<https://www.fxguide.com/fxfeatured/why-spider-verse-has-the-most-inventive-visuals-youll-see-this-year/>):
six at 1920×1080 with a 2.39:1 letterbox (live picture height 803 px) and two at 2000×838
(unletterboxed, 2.387:1). Two of them are the article's own illustrations of the halftone and
misregistration techniques, which makes them unusually good measurement targets.

### A.2 Methods

- **Dot pitch and screen angle**: high-pass (subtract a σ=4 Gaussian) to remove painted content,
  Hann window, **zero-pad to 512** before the FFT so period resolution is 512/k rather than
  tile/k, then locate the strongest peak inside a 3–40 px period annulus and refine it by
  log-magnitude centroid over a 5×5 neighbourhood. Repeated independently on luma and on each
  subtractive separation.
- **Independent cross-check**: band-pass, locate individual dot centres as local maxima, and
  histogram nearest-neighbour distances and bearings. This shares no machinery with the FFT method
  and agreed with it, which is the main reason I trust the 8.0 px / 45° result.
- **Channel offsets**: read directly from raw per-channel pixel profiles across edges. See A.3 for
  why the automated approach failed.
- **Fringe magnitude**: peak chroma excursion *relative to the flank-to-flank interpolation*, in
  opponent coordinates (G−R, B−G). This removes genuine colour change so a saturated edge between
  two differently-coloured objects does not register as misregistration.
- **Tone quantisation**: median-filter, mask to |∇luma| < 0.004 (plateau interiors), histogram
  their luma at 1/256, cluster peaks.

### A.3 Two failure modes I hit, and what they mean for anyone repeating this

**Phase correlation does not work on these frames.** It returned 0.04 px displacement in regions
that visibly fringe by 5 px. The cause is that the stills are **JPEG 4:2:0** — I verified the
component sampling factors — so full-resolution luma is shared identically across R, G and B while
chroma is stored at half resolution. Any whitened cross-power spectrum is therefore dominated by the
common luma term and pins the peak at zero lag. I validated the correlator against synthetic shifts
(it recovers 0.5–3.0 px to within 0.02 px), so the tool was correct and the signal was the problem.
Direct profile reading is the reliable method here.

**My first FFT pass was entirely spurious.** With a 64 px tile every reported period came out as
exactly 64/k (21.33, 16.0, 12.8…) because that is the bin spacing, and flat tiles produced "quality"
scores in the thousands by dividing against a near-zero noise floor. Zero-padding and an RMS floor
fixed both. If you see suspiciously round periods, check your bin spacing.

### A.4 Uncertainty

| Measurement | Value | Uncertainty | Confidence |
| --- | --- | --- | --- |
| Dot lattice pitch | 8.0 px @ 803 px picture height | ±0.3 px | **high** (two independent methods) |
| Lattice angle | 45° / 135° | ±3° | **high** |
| Shared screen across C/M/Y | yes, no per-ink rotation | — | **high** for this shot; one shot only |
| Channel spread, defocused | ≈5 px @ 803 px picture height | ±1–2 px (4:2:0 chroma) | medium |
| Channel order | R, B, G | — | medium |
| Fringe ratio, defocus/focus | ≈5× per unit contrast | ±2× | medium (n=11 edges) |
| Ink line width | 5–6 px @ 2000 px width | ±1 px | medium (one edge) |
| Plateau fraction | 30–75% | ±5% | **high** |
| Luma step size | 0.08–0.20 | — | medium |

**Everything here is measured from two shots of one film.** ATSV's per-universe styles almost
certainly use different pitches and band counts; I had no comparable ATSV stills at sufficient
resolution. Treat these as calibrated starting values, not as the film's constants.

Raw logs: <TextReference
 path="/opt/cursor/artifacts/measurements.log"
 start={1}
 end={169}
 alt="Full measurement output: halftone pitch and angle per separation, dot-centre geometry, ink line profile, fringe metric, tone quantisation, JPEG subsampling check"
></TextReference>

---

## Appendix B — where sources disagree

**1. The talk titled "Spider-Verse: Anatomy of a Shot" does not appear to exist.** I could not find
it in the ACM SIGGRAPH archives or anywhere else. The sessions that do exist are:

- **"Swing into Another Dimension: The Making of 'Spider-Man: Into the Spider-Verse'"**, SIGGRAPH
  2019 production session — Dimian, Beveridge, St. Clair, Grochola, Hendricks (also credited:
  Basantani).
  <https://history.siggraph.org/learning/swing-into-another-dimension-the-making-of-spider-man-into-the-spider-verse-by-dimian-beveridge-clair-grochola-and-hendricks/>
- **"Spider-Man: Creating the Spider-Verse"**, SIGGRAPH 2023 production session.
- Two SIGGRAPH 2023 talks on the ATSV linework and on repainting.

If a source cites "Anatomy of a Shot" for a specific claim, that claim needs re-verification.

**2. Hobie Brown's frame rates — three variants.**

| Source | Body | Jacket / vest | Guitar | Outline |
| --- | --- | --- | --- | --- |
| **Alan Hawkins**, Head of Character Animation, Gnomon panel [DOC] | twos **and** threes | fours | sixes | — |
| Gordon-Ratzlaff | threes | threes, offset | fours | twos |

Note that these are **two** independent accounts, not three: the figures widely attributed to
Hawkins via Autodesk material are the same person as the Gnomon panel speaker, so they are one
source, not corroboration. Hawkins is the department head who supervised the film and is speaking
on the record, so **I would implement his version** — body on twos/threes, jacket on fours, guitar
on sixes.

**3. Whether Miles' frame rate encodes his arc.** Widely reported (Business Insider, WhatCulture and
many downstream summaries) that he moves from twos to ones as he gains mastery. **Alan Hawkins has
stated there was no intended meaning behind the frame rates on the first film.** I found no named
Imageworks supervisor asserting the arc reading in a primary source. Treat the technique as real and
the narrative interpretation as disputed.

**4. Size of the ink-line department.** ~30 (SIGGRAPH paper) vs 40 (Pawel Grochola at the Gnomon
panel). Immaterial for implementation; noted for accuracy.

**5. Gwen's palette.** "Pink, mint green, purple" (Justin K. Thompson, on ITSV) vs "cyan, orange,
violet" primaries (Dean Gordon, on ATSV). Both are probably correct for their respective films —
her world was substantially redesigned for the sequel. Pick per film.

**6. CMY vs RGB for the misregistration.** fxguide and Keyframe say CMYK; Dimian says "colors".
Geometrically equivalent; the difference is subtractive vs additive recombination (§4.3). ATSV's
`PigmentMerge` settles it in favour of subtractive.

---

## Appendix C — sources, ranked by reliability

### Primary — patents (highest reliability; these are legally binding technical disclosures)

- **US 11,270,474 B2** — *Screen-tone look generator* (Thresher + Hatcher). St. Clair, Recuay.
  <https://patents.google.com/patent/US11270474B2/en>
- **US 11,763,507 B2** — *Emulating hand-drawn lines in CG animation* (Ink lines + ML). Grochola.
  <https://patents.google.com/patent/US11763507B2/en>
- **US 12,293,452 B2** — *Room shaders for animated movies*. St. Clair, Gulbrandsen.
  <https://patents.google.com/patent/US12293452B2/en>

### Primary — talks by the people who built it

- **"Inklines Across the Spider-Verse — Using Blender at Sony Imageworks"**, Blender Conference 2023.
  Edmond Boulet-Gilly (inkline technical lead), Sharon Snow (inkline artist) and Monica
  (animation). <https://www.youtube.com/watch?v=8yHuJLeAAsA>
- **"Spider-Man: Across the Spider-Verse: An Evening with Sony Pictures Imageworks"**, Gnomon, 2h05m,
  Nov 2023. Speakers: **Alan Hawkins** (Head of Character Animation), **Pav Grochola**
  (FX and Look of Picture Supervisor), **Bret St. Clair** (Senior Look of Picture
  Supervisor).
  <https://www.youtube.com/watch?v=NbatURNBv6Y>
- **SIGGRAPH 2019 production session**, "Swing into Another Dimension" (see Appendix B for URL).
- **SIGGRAPH 2023 production session**, "Spider-Man: Creating the Spider-Verse", 1h05m, posted by
  Sony Pictures Imageworks. <https://www.youtube.com/watch?v=Br2AjE2WC6U> — I was unable to obtain a
  transcript of this one, so nothing in this document rests on it alone; it is listed because it is
  the correct citation for the ATSV production session and is where the `StepSets`, `ChromaShifter`,
  `PigmentMerge` and Rebelle-integration details are presented in most depth. Plus the two ATSV
  SIGGRAPH 2023 talks on linework and on repainting.

### Primary — supervisor interviews

- **Foundry**, "Rule Book Rewrite for Spider-Man: Into the Spider-Verse" — Geeta Basantani, Marco
  Recuay. The single best source on Hatcher/Thresher artist controls.
  <https://colorway.foundry.com/insights/film-tv/graphic-look-in-comp-spiderman>
- **VFX Voice**, "Imageworks Artists 'Break the Mold'" — Danny Dimian on misregistration and the
  no-softness rule. <https://vfxvoice.com/imageworks-artists-break-the-mold-to-create-an-alternate-spider-verse/>
- **fxguide**, "Why Spider-Verse has the most inventive visuals you'll see this year!" — Dimian; also
  the source of the stills I measured.
  <https://www.fxguide.com/fxfeatured/why-spider-verse-has-the-most-inventive-visuals-youll-see-this-year/>
- **Keyframe**, "Web of Innovation" — Justin K. Thompson, incl. the three-tier screentone quote.
  <https://keyframemagazine.org/2019/03/01/web-of-innovation/>
- **Sony Pictures Imageworks** film page.
  <https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse>
- **Art of the Cut** with Michael Andrews, ACE (editorial / panels).
  <https://borisfx.com/blog/aotc/art-of-the-cut-spider-man-across-the-spider-verse/>

### Do not cite

`videocue.io` and `cinecanon.com` — both contain fabricated specifics (including a non-existent
SIGGRAPH 2018 NPR paper and uncorroborated lens/pipeline figures) and appear machine-generated.

---

## Appendix D — suggested render-graph order

The ordering is load-bearing. Quantise before you dither; screen before you misregister; grain last.

```
1.  G-buffer MRT                 beauty, luma(lighting only), P, Pref, N, uv, depth, motion, id
2.  Normal quantisation          optional, pre-lighting (Sec. 5.4)
3.  Ink lines                    3D curves rendered as ribbons; or screen-space if approximating
4.  Thresher banding             quantise luma -> N bands with art-directed edges (Sec. 5.3)
5.  Hatcher screens              dots in bright bands, hatch in dark bands (Sec. 1.6)
                                 projection per material; bifurcate by fwidth (Sec. 1.5)
6.  Apply as multiplier          multiply against beauty (Sec. 1.2)  <-- NOT an overlay
7.  Palette map                  per-shot/per-world band colours (Sec. 7.1)
8.  Glow / flare screen          second screen-locked screen, multiplier > 1 (Sec. 1.7)
9.  Misregistration              subtractive, depth-driven, per-separation offsets (Sec. 4.3)
10. Motion trailing              subtractive, motion-vector-driven (Sec. 6.5)
11. Panels / graphics / type     screen-space composite (Sec. 8, Sec. 10.3)
12. Paper grain + vignette       frame-locked, low amplitude, multiply
13. Output transform             to display
```

Two ordering notes worth stating explicitly:

- **Step 6 must be a multiply, not an over.** The whole point of the patent's multiplier layer is
  that the screen modulates whatever is underneath and can exceed 1.0 to brighten. Compositing dots
  *over* the image gives you a sticker, not a print.
- **Step 12 is frame-locked, not camera-locked.** Paper grain that tracks the camera reads as
  texture on the world; grain locked to the frame reads as the page the world is printed on. That
  single distinction does a lot of work.

---

---

## Appendix E — verification

All 13 GLSL blocks in this document were extracted programmatically and **compiled and linked in a
real WebGL2 context** (headless Chrome with the ANGLE/SwiftShader backend, `WebGL GLSL ES 3.00`),
with a `main()` that calls all 14 functions so none could be dead-stripped. They compile clean.

The pipeline was then run end to end, using the functions from this document verbatim and the screen
pitch measured in [Appendix A](#appendix-a--measurement-method-and-its-limits) (8.0 px at 803 px
picture height, rescaled to the 586 px render height):

<img src="/opt/cursor/artifacts/05_pipeline_demo.png" alt="Four-panel staged render: raw smooth shading; plus normal quantisation and Thresher banding; plus Hatcher halftone screens showing dots growing with darkness, screen-locked in the sky and object-locked with foreshortening on the ground; plus subtractive misregistration producing magenta and cyan silhouette fringes with paper grain" />

What this confirms and what it does not:

**Confirmed.** The Thresher band stack produces hard tonal plateaux; the Hatcher screen produces an
amplitude-modulated dot field that grows as tone darkens and merges in the darkest band; the same
code gives screen-locked behaviour in the sky and object-locked behaviour with correct perspective
foreshortening on the ground; the subtractive misregistration produces magenta on one silhouette
flank and cyan on the other, matching the fringe colours and order I measured in §4.2.

**Two things the demo surfaced that the report now accounts for.** First, my original `thresher()`
formulation multiplied band multipliers cumulatively instead of selecting a band, which produced
banding but confined the dots to a near-invisible contour; §1.2 now has the corrected
edge-counting form. Second, the transition width turns out to be the parameter that decides whether
you get a printed halftone or just posterisation with faint dots — that is now called out explicitly
in §1.2, and the anisotropy limitation of `fwidth`-based bifurcation is documented in §1.5.

**Not confirmed by this demo.** It is a synthetic sphere-and-plane scene with a two-light model, not
a comparison against the films. It demonstrates that the operators behave as described and that the
measured parameters are in a sensible range; it is not a claim of visual equivalence to a
Spider-Verse frame.

---

*Compiled from the sources in Appendix C plus original measurements described in Appendix A.
Every numeric claim is tagged [DOC], [MEAS] or [EST]; nothing in this document is an undisclosed
guess.*
