# Claude Code entry point

Before changing this repository, read [AGENTS.md](AGENTS.md). It is the canonical repository
policy; do not maintain a separate copy here. Follow any stricter owner/global instructions.

For a scoped fix or feature, use `/focused-change` if this host discovers it; otherwise read
[the shared skill](.agents/skills/focused-change/SKILL.md) explicitly. Do not load every skill.

This entry point deliberately uses an explicit read instruction, not an automatic import:
the owner's installed Claude Code version/surface has not been verified. Verify actual loading
before claiming it works; see [compatibility checks](docs/agent-workflow.md#host-compatibility).
