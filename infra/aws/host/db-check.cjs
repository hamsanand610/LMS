// Release checks on the production database (infra/aws/host/release.sh), run inside the release
// image with the API's own PostgreSQL driver:
//
//   node db-check.cjs               the connection is encrypted and verified against the RDS
//                                   authority (the URL's sslmode=verify-full), and pgvector can
//                                   be 0.8.0 or later
//   node db-check.cjs organization  exits 0 while the institute (CLIENT_KEY) does not exist, 3
//                                   once it does
//   node db-check.cjs admin         exits 0 while the institute has no Super Admin, 3 once it has
//
// It prints no secret: the driver's error messages never contain the password.
'use strict';

const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (process.argv[2] === 'organization') {
      const { rows } = await client.query('SELECT 1 FROM organizations WHERE key = $1', [
        process.env.CLIENT_KEY,
      ]);
      return rows.length === 0 ? 0 : 3;
    }
    if (process.argv[2] === 'admin') {
      const { rows } = await client.query(
        `SELECT 1
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           JOIN organizations o ON o.id = r.organization_id
          WHERE o.key = $1 AND r.key = 'super_admin'
          LIMIT 1`,
        [process.env.CLIENT_KEY],
      );
      return rows.length === 0 ? 0 : 3;
    }
    const tls = await client.query(
      'SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()',
    );
    if (!tls.rows[0] || !tls.rows[0].ssl) {
      throw new Error('the connection to the database is not encrypted');
    }
    const vector = await client.query(
      "SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'vector'",
    );
    const row = vector.rows[0];
    if (!row) throw new Error('pgvector is not available on this database');
    const [major, minor] = row.default_version.split('.').map(Number);
    if (major === 0 && minor < 8) {
      throw new Error(`pgvector ${row.default_version} is older than 0.8.0 (iterative scans)`);
    }
    const server = await client.query('SHOW server_version');
    console.log(
      `database: PostgreSQL ${server.rows[0].server_version}, ${tls.rows[0].version}, ` +
        `pgvector ${row.installed_version || 'not installed yet'} (available ${row.default_version})`,
    );
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`database check failed: ${error.message}`);
    process.exit(2);
  },
);
