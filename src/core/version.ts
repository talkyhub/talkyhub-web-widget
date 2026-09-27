// What this bundle is, inlined at build time (see vite.config.ts `define`).
//
// The CDN identifies a build by content hash, which answers "which bytes are serving" but not
// "which commit made them". This closes that gap: a customer can read TalkyHub.version out of
// the console and it maps straight to a commit.

export const VERSION = __WIDGET_VERSION__
export const COMMIT = __WIDGET_COMMIT__

/** Semver with the commit as build metadata, e.g. `0.0.1+ab12cd3`. */
export const BUILD = COMMIT ? `${VERSION}+${COMMIT}` : VERSION
