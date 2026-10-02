// Generates docs/architecture/PERMISSION_MATRIX.md from the code: the permission catalogue
// (packages/shared, built first) and the default role bundles with their named changes
// (apps/api/src/modules/rbac/role-bundles.ts). `pnpm docs:permissions` after either changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const shared = await import(pathToFileURL(ROOT + 'packages/shared/dist/index.js').href);
const { PLATFORM_PERMISSIONS, SYSTEM_ROLES } = shared;
const source = readFileSync(ROOT + 'apps/api/src/modules/rbac/role-bundles.ts', 'utf8');

const roleKeys = {
  SUPER_ADMIN: SYSTEM_ROLES.SUPER_ADMIN,
  ADMIN: SYSTEM_ROLES.ADMIN,
  TRAINER: SYSTEM_ROLES.TRAINER,
  STUDENT: SYSTEM_ROLES.STUDENT,
  PLACEMENT_COORDINATOR: SYSTEM_ROLES.PLACEMENT_COORDINATOR,
  CONTENT_MANAGER: SYSTEM_ROLES.CONTENT_MANAGER,
};

// Each role's block: from `[SYSTEM_ROLES.X]: {` to the next role block or the end of the object.
const bundles = {};
const starts = [...source.matchAll(/\[SYSTEM_ROLES\.([A-Z_]+)\]: \{/g)].map((m) => ({
  constant: m[1],
  index: m.index,
}));
const definitionsEnd = source.indexOf('export const BUNDLE_CHANGES');
starts.forEach((start, i) => {
  const end = i + 1 < starts.length ? starts[i + 1].index : definitionsEnd;
  const block = source.slice(start.index, end);
  const role = roleKeys[start.constant];
  if (!role) throw new Error('unknown role ' + start.constant);
  if (/bundle: '\*'/.test(block)) {
    bundles[role] = '*';
    return;
  }
  bundles[role] = new Map(
    [...block.matchAll(/\{ key: '([a-z_]+:[a-z_]+)', scope: '(all|batch|own)' \}/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
});

// Named bundle changes, applied once per institute (rbac/sync.ts).
const changes = source.slice(definitionsEnd);
for (const m of changes.matchAll(
  /\{ role: SYSTEM_ROLES\.([A-Z_]+), key: '([a-z_]+:[a-z_]+)', scope: '(all|batch|own)' \}/g,
)) {
  const role = roleKeys[m[1]];
  if (bundles[role] !== '*') bundles[role].set(m[2], m[3]);
}

const columns = [
  ['Super Admin', SYSTEM_ROLES.SUPER_ADMIN],
  ['Admin', SYSTEM_ROLES.ADMIN],
  ['Trainer', SYSTEM_ROLES.TRAINER],
  ['Student', SYSTEM_ROLES.STUDENT],
  ['Placement', SYSTEM_ROLES.PLACEMENT_COORDINATOR],
  ['Content', SYSTEM_ROLES.CONTENT_MANAGER],
];
for (const [, role] of columns) if (!bundles[role]) throw new Error('no bundle for ' + role);

const cell = (role, key) => {
  if (bundles[role] === '*') return 'all';
  return bundles[role].get(key) ?? '—';
};
const known = new Set(PLATFORM_PERMISSIONS.map((p) => p.key));
for (const [, role] of columns) {
  if (bundles[role] === '*') continue;
  for (const key of bundles[role].keys()) {
    if (!known.has(key)) throw new Error(`${role} holds ${key}, which the catalogue lacks`);
  }
}

const byModule = new Map();
for (const p of PLATFORM_PERMISSIONS) {
  if (!byModule.has(p.moduleKey)) byModule.set(p.moduleKey, []);
  byModule.get(p.moduleKey).push(p);
}
const rows = [];
for (const [module, perms] of byModule) {
  for (const p of perms) {
    rows.push(
      `| \`${p.key}\` | ${module} | ${p.description.replace(/\|/g, '\\|')} | ${columns
        .map(([, role]) => cell(role, p.key))
        .join(' | ')} |`,
    );
  }
}

const superOnly = PLATFORM_PERMISSIONS.filter((p) =>
  columns.slice(1).every(([, role]) => cell(role, p.key) === '—'),
).map((p) => `\`${p.key}\``);

const doc = `# Permission matrix

Generated from the code — the catalogue (\`packages/shared/src/permissions.ts\`) and the default
bundles with their named changes (\`apps/api/src/modules/rbac/role-bundles.ts\`) — by
\`pnpm docs:permissions\` (\`scripts/permission-matrix.mjs\`); never edited by hand. These are the
**defaults** a new institute starts with; a client edits bundles in the Roles screen (ADR-0009), and
\`test/permissions.e2e-spec.ts\` proves that each seeded role holds exactly its declared bundle.

Scopes: **all** — every record; **batch** — the records of the batches one teaches (a learner's
\`batch\` reach is the batches they learn in); **own** — one's own records. "—" means not held.
Every route declares one permission, at a minimum scope where it needs one, and is refused with
403 before its handler runs (\`test/role-boundaries.e2e-spec.ts\`, every route, five roles). The
route is only the first check: the services decide which records a scope reaches (ADR-0004,
decisions D1–D10 of \`docs/phases/PHASE-03-04-trainer-and-admin.md\`).

**Held by the Super Admin alone:** ${superOnly.join(', ')}.

| Permission | Module | What it allows | Super Admin | Admin | Trainer | Student | Placement | Content |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Rules the matrix does not show

- **Granting (D4).** A role can be granted, removed or managed only by someone holding every
  permission it carries at the same scope or wider; nobody but a Super Admin changes their own
  roles; the Super Admin role is never copied; a bundle keeps to the scopes the catalogue allows.
- **Trainer reach (D1, D6).** A trainer's \`batch\` scope is the batches they teach; their authority
  over a course's content comes from course staff (ADR-0023), not from the batch; a learner is
  seen within the trainer's batches only.
- **Authored content (D2).** Content reached through a batch can be used, not changed: changing it
  needs its author or institute-wide staff.
- **Answered content (D3).** A paper or a question's key stops changing once answered.
- **Flags (D5).** A module's flag audience (roles, batches) is enforced on the server.
- **Feedback (D10).** Anonymous answers are never traceable; figures appear from five answers.
- **Privacy (ADM-11).** Export and erasure of a learner's data are the Super Admin's
  (\`privacy:manage\`) and audited.
`;
const target = ROOT + 'docs/architecture/PERMISSION_MATRIX.md';
const prettier = await import('prettier');
const options = (await prettier.resolveConfig(target)) ?? {};
writeFileSync(target, await prettier.format(doc, { ...options, parser: 'markdown' }));
console.log('rows', rows.length, 'super-only', superOnly.length);
