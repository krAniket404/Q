# Q theme (matches the website)

- `src/theme/tokens.ts`: palette, type scale (min 13px for readable text), glass levels, QCore state behavior.
- `src/theme/themes.ts`: new default theme `q` ("Q Intelligence"). Existing themes are untouched; users who already picked one keep it.
- `src/theme/typography.ts`: Manrope. Files in `android/app/src/main/res/font`. iOS needs the same .ttf files added to the Xcode target + `UIAppFonts` in Info.plist (not done; iOS falls back to the system font, as it did with Lato).
- `src/components/QCore.tsx`: the recurring orb. States: idle, analyzing, noticed, warning, insight, success. Core `Animated` API only (no new native modules). Respects the OS reduce-motion setting.
- `src/components/QStatus.tsx`: the small "Q ● found a pattern" line.
- `src/components/Glass.tsx`: four glass levels without a blur module (cheap on low-end Android).
- `src/components/WellnessCard.tsx`: first screen moved over (QCore + QStatus + Glass).

To revert the font only: set the three `fontFamily*` values in `typography.ts` back to `lato_regular` / `lato_bold`.
Tests: `npx jest __tests__/QTheme.test.tsx` (needs `@react-native/jest-preset`, which the repo's jest.config.js references but package.json does not list).
