/**
 * Public site links. Single owner for the repository URL so no
 * component hardcodes it. Falls back to the canonical repo when
 * the environment does not set one.
 */
export const GITHUB_URL =
  process.env.GITHUB_URL ?? 'https://github.com/darshilptl/fernleaf-kitchen';
