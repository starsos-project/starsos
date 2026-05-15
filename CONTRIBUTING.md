# Contributing to Stars OS

Thanks for considering a contribution. Stars OS is in **pre-alpha** — interfaces and APIs will change. If that's exciting rather than scary, you'll fit right in.

## What we welcome

In rough priority order:

1. **New adapters** for tools you use every day (hosting providers, CRMs, secret stores, monitoring, …)
2. **Bug reports** with a minimal reproduction
3. **Documentation** improvements (typos, clarifications, missing examples)
4. **Recipes** showing how to use Stars OS for a real workflow
5. **Performance** patches with benchmarks
6. **Tests** filling gaps in coverage

## What we don't want (yet)

- Large refactors to the core during pre-alpha — APIs are intentionally unstable
- New top-level commands without a prior discussion issue
- Dependencies on closed-source services in the core (adapters are fine)

## Ground rules

- **Open an issue first** for anything bigger than a typo fix
- **Keep PRs focused** — one logical change per PR
- **Write tests** for new functionality (`bun test`)
- **Update docs** when behavior changes
- **Conventional Commits** for commit messages: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- **English** for code, comments, commits, and PR descriptions

## Development setup

```bash
git clone https://github.com/starsos-project/starsos
cd starsos
bun install
bun test
bun run dev    # local CLI link
```

## Adapter authoring

The simplest adapter is ~50 lines:

```ts
// my-adapter/index.ts
import { defineAdapter } from "@starsos/sdk";

export default defineAdapter({
  name: "my-adapter",
  version: "0.1.0",
  commands: {
    hello: async ({ args }) => `Hello, ${args.name ?? "world"}`,
  },
});
```

Full guide: [docs.starsos.org/adapters/authoring](https://docs.starsos.org/adapters/authoring) *(coming with v0.1)*

## Code of Conduct

Be kind. Assume good faith. Disagree with substance, not snark. Full text in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License of contributions

By submitting a contribution you agree to license it under the [AGPL-3.0](LICENSE), the same terms as the rest of the project.

## Questions?

- **GitHub Discussions** — the right place for design questions
- **Discord** — opens at v0.1 launch
- **Issues** — for bugs and feature requests
