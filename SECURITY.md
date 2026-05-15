# Security Policy

## Supported versions

Stars OS is in **pre-alpha**. Security patches will be applied to the latest `main` branch only. Once v1.0 ships, supported versions will be documented here.

## Reporting a vulnerability

Please **do not** open public GitHub issues for security vulnerabilities.

Instead, email **security@starsos.org** with:

- A description of the vulnerability
- Steps to reproduce (or proof-of-concept code)
- The impact you anticipate
- Optionally: your suggested fix

We will:

1. Acknowledge receipt within **48 hours**
2. Triage and respond with a timeline within **7 days**
3. Coordinate disclosure with you before any public announcement

Critical vulnerabilities will be patched as a priority. We do not currently offer paid bug bounties, but contributors who report responsibly will be credited (with permission) in release notes.

## Scope

In scope:

- The `stars` CLI and `@starsos/*` packages in this repository
- First-party adapters published under `@starsos/adapter-*`
- The Stars OS docs site (`docs.starsos.org`) and landing page (`starsos.org`)

Out of scope:

- Third-party adapters not published by Stars OS maintainers
- Issues in upstream dependencies (please report to the dependency's maintainer)
- Social engineering attacks against maintainers
