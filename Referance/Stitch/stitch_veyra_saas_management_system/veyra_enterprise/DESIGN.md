---
name: Veyra Enterprise
colors:
  surface: '#f7f9fe'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ed'
  surface-container-highest: '#e0e2e7'
  on-surface: '#181c20'
  on-surface-variant: '#424655'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eff1f6'
  outline: '#737686'
  outline-variant: '#c2c6d7'
  surface-tint: '#0055d5'
  primary: '#0053d0'
  on-primary: '#ffffff'
  primary-container: '#246bf6'
  on-primary-container: '#fefcff'
  inverse-primary: '#b3c5ff'
  secondary: '#3d57b6'
  on-secondary: '#ffffff'
  secondary-container: '#819bff'
  on-secondary-container: '#062d8d'
  tertiary: '#4a6078'
  on-tertiary: '#ffffff'
  tertiary-container: '#637992'
  on-tertiary-container: '#00060f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#003fa3'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#001551'
  on-secondary-fixed-variant: '#213e9d'
  tertiary-fixed: '#cfe5ff'
  tertiary-fixed-dim: '#b2c9e4'
  on-tertiary-fixed: '#031d32'
  on-tertiary-fixed-variant: '#33495f'
  background: '#f7f9fe'
  on-background: '#181c20'
  surface-variant: '#e0e2e7'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-page: 2rem
  gutter-grid: 1.5rem
  stack-section: 2.5rem
  stack-component: 1rem
  inset-card: 1.5rem
---

## Brand & Style

The design system is built for a high-performance enterprise SaaS environment, focusing on task management, project clarity, and organizational efficiency. The aesthetic is **Corporate / Modern** with a lean toward **Minimalism**, characterized by vast white space, high-contrast typography, and a refined blue-scale palette.

The visual narrative centers on "Precision through Clarity." By utilizing a deep navy for structural navigation and a vibrant primary blue for action, the UI creates a clear hierarchy that guides users through complex workflows. The use of generous border radii and soft shadows adds a layer of approachability and modern tactility to an otherwise professional, data-driven environment.

The logo, featuring a distinctive 'V' with a checkmark integration, serves as the anchor for the visual identity, symbolizing completion and verification.

## Colors

The palette is strategically weighted to prioritize task focus and brand authority.

- **Primary Blue (#296EF9):** Reserved for primary calls-to-action, active states, and progress indicators. It represents the "active" pulse of the system.
- **Deep Navy (#0E3191):** Used for global navigation and structural anchors. This provides a high-contrast foundation that feels established and secure.
- **Light Blue (#C9E0FC):** An accent color used for subtle feedback, badge backgrounds, and soft highlights to reduce visual fatigue.
- **Surface & Container:** The background uses a very soft blue-tinted white (#F8FAFF) to distinguish itself from the pure white (#FFFFFF) of the content cards and sections, creating a natural sense of depth without relying on heavy borders.

## Typography

This design system utilizes **Geist** for its technical precision and exceptional legibility at small sizes, which is critical for dense task-management interfaces. 

Headline levels use semi-bold weights with slight negative letter-spacing to create a "locked-in" editorial feel. Body text is optimized for long-form reading in task descriptions, while labels use a medium weight and increased letter-spacing to ensure they are easily scannable in high-density data views.

## Layout & Spacing

The system employs a **Fluid Grid** model with a maximum content width of 1440px to ensure balance on ultra-wide displays. 

- **Desktop (12 columns):** 32px margins, 24px gutters.
- **Tablet (8 columns):** 24px margins, 16px gutters.
- **Mobile (4 columns):** 16px margins, 16px gutters.

Spacing follows an 8px base unit. Component internal padding should be generous (1.5rem for cards) to maintain a premium SaaS feel, preventing the interface from feeling cluttered even when displaying high volumes of project data.

## Elevation & Depth

Visual hierarchy is achieved through a combination of **Tonal Layers** and **Ambient Shadows**.

The base application surface (#F8FAFF) sits at the lowest level. Content containers (Cards, Modals) use a pure white surface (#FFFFFF) to "lift" themselves off the background. 

**Shadows:** 
Use a single, highly diffused shadow style for cards: `0 4px 20px -2px rgba(15, 23, 42, 0.08)`. This creates a soft, modern lift that doesn't feel heavy. For interactive elements like dropdowns or active modals, increase the spread slightly to `0 12px 40px -4px rgba(15, 23, 42, 0.12)`.

## Shapes

The shape language is friendly yet professional. 

- **Cards & Sections:** Use `rounded-xl` (1.5rem / 24px) to create a distinct, soft container for task views and kanban boards.
- **Buttons & Inputs:** Use `rounded-lg` (1rem / 16px) for a consistent touch-friendly appearance.
- **Navigation Indicators:** Active states in the sidebar use a pill-shaped (full-round) geometry to clearly distinguish them from content containers.

## Components

### Buttons
- **Primary:** Solid #296EF9 background, white text. No border.
- **Secondary:** White background, #0E3191 text, and a 1px border of #C9E0FC. 
- **Active State:** Slight darken on hover (approx 10% opacity black overlay).

### Sidebar
The sidebar is the primary brand anchor. It uses the Deep Navy (#0E3191) background. 
- **Logo:** The white version of the logo should be placed at the top-left with 2rem padding.
- **Nav Items:** Muted state uses #C9E0FC text. Active state uses white text with a pill-shaped background indicator in #296EF9.

### Task Management Elements
- **Kanban Cards:** Pure white background, subtle border (#D8E2F0), and a 24px corner radius. Include a 4px vertical "priority accent" bar on the left edge.
- **Progress Bars:** Use a light grey track with #296EF9 for the fill.
- **Badges/Chips:** Used for roles and status. Background should be #C9E0FC with #0E3191 text for high legibility.

### Inputs
- **Text Fields:** White background, #D8E2F0 border, Geist 14px text. On focus, the border transitions to #296EF9 with a soft 4px glow in the same color (20% opacity).