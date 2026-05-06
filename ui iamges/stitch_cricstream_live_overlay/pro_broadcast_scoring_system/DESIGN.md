---
name: Pro-Broadcast Scoring System
colors:
  surface: '#081421'
  surface-dim: '#081421'
  surface-bright: '#2e3a49'
  surface-container-lowest: '#030f1c'
  surface-container-low: '#101c2a'
  surface-container: '#14202e'
  surface-container-high: '#1f2b39'
  surface-container-highest: '#2a3644'
  on-surface: '#d7e3f7'
  on-surface-variant: '#c5c6cc'
  inverse-surface: '#d7e3f7'
  inverse-on-surface: '#253140'
  outline: '#8e9196'
  outline-variant: '#44474c'
  surface-tint: '#bcc7d8'
  primary: '#bcc7d8'
  on-primary: '#27313e'
  primary-container: '#0b1622'
  on-primary-container: '#75808f'
  inverse-primary: '#545f6e'
  secondary: '#fff9ef'
  on-secondary: '#3a3000'
  secondary-container: '#ffdb3c'
  on-secondary-container: '#725f00'
  tertiary: '#00daf3'
  on-tertiary: '#00363d'
  tertiary-container: '#00181c'
  on-tertiary-container: '#008c9d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e3f5'
  primary-fixed-dim: '#bcc7d8'
  on-primary-fixed: '#121c29'
  on-primary-fixed-variant: '#3d4855'
  secondary-fixed: '#ffe16d'
  secondary-fixed-dim: '#e9c400'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#544600'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#081421'
  on-background: '#d7e3f7'
  surface-variant: '#2a3644'
typography:
  display-score:
    fontFamily: lexend
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: lexend
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-tabular:
    fontFamily: inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1'
  label-caps:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1440px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is engineered for high-stakes, real-time sports environments where data density and legibility are paramount. The brand personality is authoritative, precise, and high-performance, mirroring the intensity of a live broadcast suite. It adopts a **Corporate / Modern** style infused with technical broadcast aesthetics, prioritizing function over ornamentation.

The visual language draws inspiration from live TV overlays—utilizing high-contrast indicators, data-heavy grids, and a mission-critical dark mode. The goal is to evoke a sense of professional reliability, ensuring that scorers and producers can identify key metrics at a glance under time-sensitive conditions.

## Colors

The palette is anchored by **Midnight Navy** (#0B1622), providing a deep, low-glare foundation that allows data to pop. This primary surface color is complemented by a lighter neutral tier for card backgrounds to establish hierarchy.

**Action Gold** (#FFD700) serves as the primary functional accent, used for critical CTAs and primary highlights. **Electric Blue** (#00E5FF) is utilized for secondary technical data points and interactive hover states. For broadcast-critical statuses, a vibrant 'Live' Red is used exclusively for active streaming indicators, while 'Signal Green' handles encoder health and successful data syncs.

## Typography

Typography is the core of this design system's utility. We utilize **Lexend** for headlines and score displays due to its athletic, high-readability character. For all technical data, body text, and UI labels, **Inter** is specified to take advantage of its superior legibility and robust support for tabular figures.

Critical numeric data (runs, wickets, overs, bitrates) must always use `font-variant-numeric: tabular-nums` to ensure columns align perfectly in data tables. Labels use a bold, uppercase style to differentiate themselves from dynamic data inputs.

## Layout & Spacing

This design system employs a **Fluid Grid** system optimized for widescreen monitoring. The layout uses a 12-column structure with 16px gutters, allowing for flexible dashboard configurations. 

A strict 4px baseline rhythm ensures vertical alignment across disparate data modules. Content is organized into functional zones: a global navigation sidebar, a primary scoring stage, and a persistent technical sidebar for encoder and broadcast monitoring. The layout prioritizes "above the fold" density to minimize scrolling during live match events.

## Elevation & Depth

Depth is communicated through **Tonal Layers** rather than heavy shadows to maintain a sleek, digital broadcast look. The background uses the primary navy, while interactive components and data cards use a slightly lighter neutral shade (#1A2634).

To distinguish floating panels or modals, a **Low-contrast outline** (1px solid border at 15% white opacity) is applied. Subtle backdrop blurs (Glassmorphism) are reserved specifically for overlay menus and "Live" score bugs that sit atop video previews, ensuring they remain legible regardless of the background video feed.

## Shapes

The shape language is **Soft** (4px base radius) to maintain a modern, professional appearance without appearing overly playful. This slight rounding softens the high-density data grid while maintaining a structural, "racked" look reminiscent of hardware equipment.

Buttons and active "Live" badges use the standard 4px radius, while larger container cards may utilize the `rounded-lg` (8px) token to define major UI sections. Status indicators (LED-style pips) are the only elements that use a full circle/pill shape to mimic physical hardware lights.

## Components

**Buttons:** Primary actions use the Action Gold background with black text for maximum contrast. Secondary actions use ghost styles with white borders. "End Match" or "Delete" actions use a specialized deep red.

**Cards:** Every data module (e.g., Scorecard, Bowler Stats) is housed in a card with a subtle 1px border. Card headers should have a contrasting background tint to anchor the section.

**Live Indicators:** The 'LIVE' badge must feature a pulsing animation and be set in the 'label-caps' typography style. Encoder status badges should use a simple dot icon (green/yellow/red) next to the bitrate text.

**Input Fields:** For scoring, inputs should be large and touch-friendly (on tablet) or optimized for rapid keyboard entry. Active fields are highlighted with an Electric Blue border.

**Score Bug:** A specialized component designed for broadcast preview, featuring high-contrast backgrounds and the 'display-score' typography level for immediate recognition.