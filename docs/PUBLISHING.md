# Publishing ScanFit

`@scanfit/browser` is a public npm package. Prereleases use the `next` distribution tag; stable releases use `latest`.

## One-time trusted-publisher setup

In the npm package settings for `@scanfit/browser`, add a GitHub Actions trusted publisher with:

- Organization or user: `Ahmedsultan09`
- Repository: `scanfit`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`
- Environment: leave empty

The workflow uses GitHub-hosted runners, Node 24, a pinned npm version with OIDC support, and `id-token: write`. It publishes without a long-lived npm token and npm generates provenance for the public package.

## Release a version

1. Update `packages/scanfit/package.json` to a new, unused version and update the workspace lockfile.
2. Move the relevant changelog entries from **Unreleased** into a dated version section.
3. Run `npm run verify` and `npm pack --dry-run --workspace @scanfit/browser`. Confirm that `README.md`, the license, notices, runtime files and declarations appear in the tarball.
4. Commit and push the release changes.
5. Create a GitHub release whose tag is exactly `v<package-version>`, for example `v0.1.0-alpha.1`.

Publishing starts only when the GitHub release is published. The workflow rejects a release tag that does not match the package version. A version containing a prerelease suffix is published to `next`; a stable version is published to `latest`.

npm versions are immutable. If a publish fails after npm accepts the version, increment the version before retrying.

After npm accepts a release, verify both the package metadata and package-page documentation:

```sh
npm view @scanfit/browser@<version> version dist-tags readmeFilename
npm install @scanfit/browser@next
```
