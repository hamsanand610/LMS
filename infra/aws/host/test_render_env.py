"""Tests for render_env.py (run: python -m unittest discover -s infra/aws/host -p 'test_*.py')."""

from __future__ import annotations

import base64
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import render_env  # noqa: E402

CONFIG = {
    'environment': 'production',
    'region': 'ap-south-1',
    'siteHost': 'd1234abcd.cloudfront.net',
    'registry': '123456789012.dkr.ecr.ap-south-1.amazonaws.com/si-academy-production',
    'database': {'host': 'si-academy-production.abc.ap-south-1.rds.amazonaws.com', 'port': '5432',
                 'name': 'lms'},
    'buckets': {'private': 'bucket-private', 'public': 'bucket-public'},
    'logGroups': {'api': '/si-academy/production/api', 'web': '/si-academy/production/web',
                  'runner': '/si-academy/production/runner'},
    'clientKey': 'si-academy',
    'email': {'driver': 'none', 'from': 'SI Academy <no-reply@siacademy.example>'},
    'runnerConcurrency': '2',
    'ai': {'provider': 'none', 'model': '', 'taskModels': '', 'fallbackProvider': '',
           'fallbackModel': '', 'dataClasses': 'public,course', 'modelCosts': '',
           'orgMonthlyBudgetUsd': '', 'knowledgeAnswerMinSimilarity': '0.71'},
}

SECRETS = {
    'database': json.dumps({'username': 'si_academy', 'password': 'DbPassword0123456789abcdefABCDEF'}),
    'jwt-access': 'A' * 64,
    'jwt-refresh': 'B' * 64,
    'data-encryption-key': 'C' * 64,
    'runner-token': 'R' * 64,
    'storage': json.dumps({'accessKeyId': 'AKIAEXAMPLEEXAMPLE00',
                           'secretAccessKey': 'storageSecretKey0123456789abcdefghijklmn'}),
    'admin': json.dumps({'email': 'superadmin@siacademy.example',
                         'password': 'AdminPassword0123456789'}),
}


def read_env(path: Path) -> dict[str, str]:
    return dict(line.split('=', 1) for line in path.read_text(encoding='utf-8').splitlines())


class RenderEnvTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp())
        self.secrets = self.dir / 'secrets'
        self.secrets.mkdir()
        self.out = self.dir / 'out'
        self.config = dict(CONFIG, ai=dict(CONFIG['ai']), email=dict(CONFIG['email']))
        for name, value in SECRETS.items():
            (self.secrets / name).write_text(value, encoding='utf-8')

    def run_render(self) -> int:
        config_file = self.dir / 'config.json'
        config_file.write_text(json.dumps(self.config), encoding='utf-8')
        return render_env.main([
            '--environment', 'production', '--region', 'ap-south-1', '--tag', 'a' * 40,
            '--web-tag', 'a' * 40 + '-1234abcd', '--out', str(self.out),
            '--config-file', str(config_file), '--secrets-dir', str(self.secrets),
            '--docker-gid', '988'])

    def test_the_api_gets_a_production_environment(self) -> None:
        self.assertEqual(self.run_render(), 0)
        api = read_env(self.out / 'api.env')
        self.assertEqual(api['APP_ENV'], 'production')
        self.assertEqual(api['COOKIE_SECURE'], 'true')
        self.assertEqual(api['WEB_BASE_URL'], 'https://d1234abcd.cloudfront.net')
        self.assertEqual(api['API_BASE_URL'], 'https://d1234abcd.cloudfront.net/api')
        self.assertEqual(api['CORS_ORIGINS'], 'https://d1234abcd.cloudfront.net')
        self.assertEqual(api['S3_PUBLIC_BASE_URL'], 'https://d1234abcd.cloudfront.net/files')
        self.assertEqual(api['S3_FORCE_PATH_STYLE'], 'true')
        self.assertEqual(api['CLIENT_KEY'], 'si-academy')
        self.assertTrue(api['DATABASE_URL'].startswith(
            'postgresql://si_academy:DbPassword0123456789abcdefABCDEF@si-academy-production.abc.'))
        self.assertIn('sslmode=verify-full&sslrootcert=/certs/rds-global-bundle.pem',
                      api['DATABASE_URL'])
        self.assertEqual(api['WORKER_MODE'], 'embedded')
        self.assertEqual(api['EMAIL_DRIVER'], 'none')

    def test_ai_stays_off_and_never_personal(self) -> None:
        self.assertEqual(self.run_render(), 0)
        api = read_env(self.out / 'api.env')
        self.assertEqual(api['AI_PROVIDER'], 'none')
        self.assertEqual(api['AI_DATA_CLASSES'], 'public,course')
        self.assertEqual(api['GEMINI_API_KEY'], '')
        self.config['ai']['dataClasses'] = 'public,course,personal'
        self.assertEqual(self.run_render(), 1)

    def test_gemini_needs_its_key_in_secrets_manager(self) -> None:
        self.config['ai']['provider'] = 'gemini'
        self.assertEqual(self.run_render(), 1)
        (self.secrets / 'ai').write_text(json.dumps({'GEMINI_API_KEY': 'gemini-test-key-0123'}),
                                         encoding='utf-8')
        self.assertEqual(self.run_render(), 0)
        self.assertEqual(read_env(self.out / 'api.env')['GEMINI_API_KEY'], 'gemini-test-key-0123')

    def test_each_container_gets_only_its_own(self) -> None:
        self.assertEqual(self.run_render(), 0)
        web = read_env(self.out / 'web.env')
        runner = read_env(self.out / 'runner.env')
        compose = read_env(self.out / 'compose.env')
        secret_values = {'A' * 64, 'B' * 64, 'C' * 64, 'DbPassword0123456789abcdefABCDEF',
                         'storageSecretKey0123456789abcdefghijklmn', 'AdminPassword0123456789'}
        for name, values in (('web', web), ('compose', compose)):
            for value in values.values():
                for secret in secret_values | {'R' * 64}:
                    self.assertNotIn(secret, value, f'{name}.env holds a secret')
        self.assertEqual(set(runner), {'RUNNER_HOST', 'RUNNER_PORT', 'RUNNER_TOKEN', 'RUNNER_IMAGE',
                                       'RUNNER_CONCURRENCY'})
        self.assertEqual(runner['RUNNER_IMAGE'], CONFIG['registry'] + '/lms-sandbox:' + 'a' * 40)
        self.assertEqual(web['NEXT_PUBLIC_API_URL'], 'https://d1234abcd.cloudfront.net/api')
        self.assertEqual(compose['WEB_IMAGE_TAG'], 'a' * 40 + '-1234abcd')
        self.assertEqual(compose['DOCKER_GID'], '988')
        api = read_env(self.out / 'api.env')
        self.assertNotIn('SEED_ADMIN_PASSWORD', api)
        release = read_env(self.out / 'release.env')
        self.assertEqual(release['SEED_ADMIN_PASSWORD'], 'AdminPassword0123456789')

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions')
    def test_files_are_readable_by_their_owner_only(self) -> None:
        self.assertEqual(self.run_render(), 0)
        for path in self.out.iterdir():
            self.assertEqual(path.stat().st_mode & 0o077, 0, path.name)

    def test_a_value_an_env_file_cannot_carry_is_refused(self) -> None:
        (self.secrets / 'jwt-access').write_text('x' * 40 + '$HOME', encoding='utf-8')
        self.assertEqual(self.run_render(), 1)
        self.assertFalse((self.out / 'api.env').exists())

    def test_a_missing_secret_is_named_not_shown(self) -> None:
        (self.secrets / 'runner-token').unlink()
        self.assertEqual(self.run_render(), 1)

    def test_ses_gets_its_smtp_password_derived(self) -> None:
        self.config['email']['driver'] = 'ses'
        (self.secrets / 'mail').write_text(json.dumps(
            {'accessKeyId': 'AKIAMAILEXAMPLE00000', 'secretAccessKey': 'mailSecret0123456789'}),
            encoding='utf-8')
        self.assertEqual(self.run_render(), 0)
        api = read_env(self.out / 'api.env')
        self.assertEqual(api['EMAIL_DRIVER'], 'smtp')
        self.assertEqual(api['SMTP_HOST'], 'email-smtp.ap-south-1.amazonaws.com')
        self.assertEqual(api['SMTP_PORT'], '587')
        self.assertEqual(api['SMTP_USER'], 'AKIAMAILEXAMPLE00000')
        password = base64.b64decode(api['SMTP_PASSWORD'])
        self.assertEqual(len(password), 33)
        self.assertEqual(password[0], 4)
        self.assertEqual(api['SMTP_PASSWORD'],
                         render_env.ses_smtp_password('mailSecret0123456789', 'ap-south-1'))
        self.assertNotEqual(api['SMTP_PASSWORD'],
                            render_env.ses_smtp_password('mailSecret0123456789', 'eu-west-1'))

    def test_another_environments_configuration_is_refused(self) -> None:
        self.config['environment'] = 'staging'
        self.assertEqual(self.run_render(), 1)


if __name__ == '__main__':
    unittest.main()
