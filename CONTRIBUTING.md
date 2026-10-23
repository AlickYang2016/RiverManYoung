# Contributing

Thanks for wanting to help.

- **Agreement.** Contributions need the [Contributor License Agreement](CLA.md): put "I have read CLA.md and I agree to its terms." in your pull request description. It lets the project stay AGPL-3.0 while also offering commercial licenses.
- **Toolchain.** [Bun](https://bun.sh) for installs, scripts and tests: `bun install`, `bun run dev`, `bun run typecheck`, `bun run test`, `bun run build`.
- **Checks.** Keep `bun run typecheck` and `bun run test` green. The tests and the headless harnesses in `scripts/harness/` run against the demo profile in `profile/`, so keep the demo as it is in pull requests. Rendering changes to the binder should come with before/after screenshots.
- **Assets.** No third-party models or textures: everything but the open-licensed fonts and the demo photos (Unsplash, credited in `public/photos/CREDITS.md`) is drawn in code.
