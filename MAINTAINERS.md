# Maintainers

| Role | Who | Can |
|---|---|---|
| Owner | [@blixvip](https://github.com/blixvip) | Everything: merge, release, settings |
| Contributors | [everyone who has had a PR merged](https://github.com/blixvip/solana-tx-parse/graphs/contributors) | Credited in CHANGELOG.md and the release notes |

## Becoming a maintainer

Maintainers merge pull requests and cut releases, so the bar is trust built over time:

1. **Contributor**: one merged pull request.
2. **Regular**: about 10 merged pull requests across at least two weeks, and helpful reviews or answers on other people's issues and PRs. Regulars are listed here and get a say on the roadmap.
3. **Maintainer**: a regular the owner invites. Maintainers get write access; `main` stays protected (pull request, passing CI and one approval from someone else), and releases stay with the owner.

Reviewing other people's pull requests is the fastest way up: anyone can leave a review.

## How main is protected

- Every change lands through a pull request with passing CI and one approval.
- No force-pushes or deletion of `main`; tags and releases are created by the owner only.
- Workflow tokens are read-only by default.
