# Skill Registry

## User Skills
| Skill | Trigger | Description |
|-------|---------|-------------|
| skill-creator | asks to create a new skill, add agent instructions | Creates new AI agent skills |
| find-docs | library, framework, SDK, CLI tool, cloud service | Retrieves up-to-date documentation |
| sdd-init | sdd init, iniciar sdd, openspec init | Initialize SDD context |
| sdd-explore | sdd-explore, investigate an idea | Explore and investigate ideas |
| sdd-propose | sdd-propose | Create a change proposal |
| sdd-spec | sdd-spec | Write specifications |
| sdd-design | sdd-design | Create technical design |
| sdd-tasks | sdd-tasks | Break down into tasks |
| sdd-apply | sdd-apply | Implement tasks |
| sdd-verify | sdd-verify | Validate implementation |
| sdd-archive | sdd-archive | Archive a change |
| systematic-debugging | bug, test failure, unexpected behavior | Systematic debugging workflow |
| brainstorming | creative work, creating features | Brainstorming and ideation |

## Project Standards
- **Stack**: NestJS, Fastify, MongoDB, Baileys, Agenda.
- **TDD**: Strict TDD Mode enabled.
- **Style**: ESLint, Prettier.
- **Testing**: Vitest for unit, integration and e2e.

## Compact Rules
### NestJS / TypeScript
- Use decorators for dependency injection.
- Prefer `private readonly` for injected services.
- Follow the context-based structure in `src/contexts/`.
- Use DTOs for request validation.

### Testing
- Use `describe`, `it`, `expect` from `vitest`.
- Mock external services (WhatsApp, DB) when appropriate.
- For integration tests, use `mongodb-memory-server`.
