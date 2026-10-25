# Widget changelog

The changelog of the TalkyHub **website widget** lives here, next to the code it describes:

- [`ru.md`](ru.md) — Russian (the docs' default locale)
- [`en.md`](en.md) — English

After every successful production deploy, CI (`publish-changelog` in `.github/workflows/deploy.yml`) copies them
into [`talkyhub-docs`](https://github.com/talkyhub/talkyhub-docs) (branch `production`) as
`docs/changelog/web-widget.md` and `i18n/en/docusaurus-plugin-content-docs/current/changelog/web-widget.md`,
next to the app's `app.md`. That push rebuilds docs.talkyhub.ru. **Don't edit the copies in talkyhub-docs**:
they're overwritten on the next release.

Publishing needs the `DOCS_REPO_TOKEN` repository secret (contents:write on talkyhub-docs)
in this repo, the same token talkyhub-web-app uses. Without it the job warns and skips; the release itself
never fails on the changelog.

## Releasing

1. Bump `version` in `package.json` (semver: patch = fixes, minor = features, major = breaking changes,
   which also means a new `/widget/v2/` path; see docs/widget.md).
2. Add a section at the **top** of both files, same version, same order of entries:
   - `ru.md`: `## 1.5.0 — 25.10.2026`
   - `en.md`: `## 1.5.0 — 2026-10-25`
3. Group items under `### Добавлено / Изменено / Исправлено` (`### Added / Changed / Fixed`). Write for the
   people who put the widget on their site (site owners and the developers who embed it), not for us: what
   changed for them and their visitors, one line each, the feature name in **bold**. Name the setting or call
   when there is one. Skip internal refactors.

`npm run changelog:check` (run in CI before every deploy) fails when:
- the front matter lacks `title`, `sidebar_label` or `sidebar_position`;
- `ru.md` and `en.md` have a different number of `## ` releases or different versions in them;
- the newest release isn't the `package.json` version.
