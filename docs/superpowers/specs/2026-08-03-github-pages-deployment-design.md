# GitHub Pages Deployment Design

## Goal

Deploy the `Carton22/CogARReliance` fork as a public static site at
`https://carton22.github.io/CogARReliance/`. Every successful push to `main`
should rebuild and redeploy the site automatically.

## Current State

The repository already exports the Next.js application as a static site and
contains a GitHub Actions workflow that publishes the `out` directory to
GitHub Pages. The configuration still contains the upstream repository path
`/AriaProReliance` and origin `https://rain-cn995.github.io`, so deploying the
fork unchanged would produce incorrect asset and metadata URLs.

## Design

Keep GitHub Pages as the hosting platform and retain the existing two-job
build-and-deploy workflow. Replace upstream-specific deployment values with
values derived from GitHub Actions repository context:

- Set the public base path from the current repository name.
- Set the public site origin from the current repository owner.
- Pass the calculated base path into the Next.js build so application links,
  icons, Open Graph images, and static assets all use the Pages subpath.
- Keep local development at the root path when the Pages build flag is absent.

The workflow will continue to use GitHub's Pages artifact and deployment
actions. It will request only `contents: read`, `pages: write`, and
`id-token: write` permissions.

## Deployment Flow

1. A push to `main` or a manual workflow dispatch starts the Pages workflow.
2. GitHub Actions installs the locked npm dependencies with Node.js 22.
3. Next.js produces a static export in `out` using the fork's owner and
   repository path.
4. The workflow uploads `out` as the Pages artifact.
5. GitHub Pages publishes the artifact to the repository's public Pages URL.

## Validation

Before pushing, run the same dependency installation and static build used by
CI and verify that `out` exists. After pushing, verify that the Pages workflow
completes successfully and that the public URL returns the application with
working styles, scripts, images, and navigation.

## Scope

This change covers deployment configuration only. It does not redesign the
application, change its data model, add authentication, or alter the study
workflow. Future application revisions can be made independently and will be
deployed automatically from `main`.

## Failure Handling

If the build fails, GitHub Pages will retain the last successful deployment.
If Pages is not configured to use GitHub Actions, enable that source in the
repository's Pages settings and rerun the workflow. A failed public-page check
must be investigated before the deployment is considered complete.
