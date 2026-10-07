#!/usr/bin/env python3
"""Renders one release's environment files on the production host (ADR-0042).

Reads the non-secret configuration the stack keeps in Systems Manager
(/si-academy/<environment>/config) and the secrets it keeps in Secrets Manager
(si-academy/<environment>/*), and writes, readable by root only:

  compose.env  what Compose interpolates (registry, tags, log groups): no secret
  api.env      the API's environment
  web.env      the web app's: no secret
  runner.env   the sandbox runner's: its token and nothing else
  release.env  the one-off release tasks' (migrations, base seed, first Super Admin)

It prints no value. Run by release.sh; tests pass --config-file and --secrets-dir instead of AWS.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
from pathlib import Path

# Characters an environment file cannot carry safely: Compose would read `$` as a variable and `#`
# after a space as a comment, quotes are not stripped by `docker run --env-file`, and a line break
# would start another variable.
FORBIDDEN = set('\n\r\0$#"\'`\\')


class ReleaseConfigError(Exception):
    pass


def aws(region: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(['aws', '--region', region, '--output', 'text', *args],
                          capture_output=True, text=True, check=False)


class AwsSource:
    """Configuration and secrets from Systems Manager and Secrets Manager."""

    def __init__(self, environment: str, region: str) -> None:
        self.environment = environment
        self.region = region

    def config(self) -> dict:
        name = f'/si-academy/{self.environment}/config'
        result = aws(self.region, 'ssm', 'get-parameter', '--name', name,
                     '--query', 'Parameter.Value')
        if result.returncode != 0:
            raise ReleaseConfigError(f'cannot read {name}: {result.stderr.strip()}')
        return json.loads(result.stdout)

    def secret(self, name: str, optional: bool = False) -> str | None:
        secret_id = f'si-academy/{self.environment}/{name}'
        result = aws(self.region, 'secretsmanager', 'get-secret-value', '--secret-id', secret_id,
                     '--query', 'SecretString')
        if result.returncode != 0:
            if optional and 'ResourceNotFoundException' in result.stderr:
                return None
            # The error names the secret, never its value.
            raise ReleaseConfigError(f'cannot read the secret {secret_id}')
        return result.stdout.rstrip('\n')


class FileSource:
    """The same, from files (tests)."""

    def __init__(self, config_file: Path, secrets_dir: Path) -> None:
        self.config_file = config_file
        self.secrets_dir = secrets_dir

    def config(self) -> dict:
        return json.loads(self.config_file.read_text(encoding='utf-8'))

    def secret(self, name: str, optional: bool = False) -> str | None:
        path = self.secrets_dir / name
        if not path.exists():
            if optional:
                return None
            raise ReleaseConfigError(f'cannot read the secret {name}')
        return path.read_text(encoding='utf-8').rstrip('\n')


def ses_smtp_password(secret_access_key: str, region: str) -> str:
    """Amazon SES's SMTP password for an IAM key (SigV4, as the SES developer guide derives it)."""

    def sign(key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode('utf-8'), hashlib.sha256).digest()

    signature = sign(('AWS4' + secret_access_key).encode('utf-8'), '11111111')
    for part in (region, 'ses', 'aws4_request', 'SendRawEmail'):
        signature = sign(signature, part)
    return base64.b64encode(bytes([0x04]) + signature).decode('utf-8')


def docker_gid() -> str:
    import grp  # Linux only; the tests pass --docker-gid

    return str(grp.getgrnam('docker').gr_gid)


def json_secret(source, name: str) -> dict:
    raw = source.secret(name)
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as error:
        raise ReleaseConfigError(f'the secret {name} is not JSON') from error
    if not isinstance(value, dict):
        raise ReleaseConfigError(f'the secret {name} is not a JSON object')
    return value


def render(source, environment: str, region: str, tag: str, web_tag: str,
           gid: str, app_env_dir: str, certs_dir: str) -> dict[str, dict[str, str]]:
    config = source.config()
    if config.get('environment') != environment:
        raise ReleaseConfigError('the configuration belongs to another environment')
    site = f"https://{config['siteHost']}"
    db = config['database']
    database = json_secret(source, 'database')
    storage = json_secret(source, 'storage')
    admin = json_secret(source, 'admin')
    ai = config['ai']
    ai_keys = {}
    raw_ai = source.secret('ai', optional=True)
    if raw_ai:
        try:
            ai_keys = json.loads(raw_ai)
        except json.JSONDecodeError as error:
            raise ReleaseConfigError('the secret ai is not JSON') from error

    data_classes = ai['dataClasses']
    if 'personal' in data_classes.split(','):
        # ADR-0041: the learner's own records reach a provider only once its terms are recorded.
        raise ReleaseConfigError('AI_DATA_CLASSES may not include personal (ADR-0041)')
    if ai['provider'] == 'gemini' and not ai_keys.get('GEMINI_API_KEY'):
        raise ReleaseConfigError(
            'AiProvider is gemini but the secret si-academy/<environment>/ai has no GEMINI_API_KEY')
    if ai['fallbackProvider'] == 'groq' and not ai_keys.get('GROQ_API_KEY'):
        raise ReleaseConfigError(
            'AiFallbackProvider is groq but the secret si-academy/<environment>/ai has no GROQ_API_KEY')

    database_url = (
        f"postgresql://{database['username']}:{database['password']}@{db['host']}:{db['port']}/"
        f"{db['name']}?schema=public&sslmode=verify-full&sslrootcert=/certs/rds-global-bundle.pem")

    api = {
        'APP_ENV': 'production',
        'NODE_ENV': 'production',
        'PORT': '4000',
        'LOG_LEVEL': 'info',
        'CLIENT_KEY': config['clientKey'],
        'DATABASE_URL': database_url,
        'JWT_ACCESS_SECRET': source.secret('jwt-access'),
        'JWT_REFRESH_SECRET': source.secret('jwt-refresh'),
        'DATA_ENCRYPTION_KEY': source.secret('data-encryption-key'),
        'API_BASE_URL': f'{site}/api',
        'WEB_BASE_URL': site,
        'CORS_ORIGINS': site,
        'COOKIE_SECURE': 'true',
        # One API replica (ADR-0006): its worker runs inside it.
        'WORKER_MODE': 'embedded',
        'STORAGE_DRIVER': 's3',
        'S3_REGION': region,
        # Path-style links share one origin (s3.<region>.amazonaws.com) for both buckets, which the
        # web app's content security policy names (NEXT_PUBLIC_STORAGE_URL).
        'S3_FORCE_PATH_STYLE': 'true',
        'S3_ACCESS_KEY': storage['accessKeyId'],
        'S3_SECRET_KEY': storage['secretAccessKey'],
        'S3_BUCKET_PRIVATE': config['buckets']['private'],
        'S3_BUCKET_PUBLIC': config['buckets']['public'],
        'S3_PUBLIC_BASE_URL': f'{site}/files',
        'EXECUTION_DRIVER': 'runner',
        'RUNNER_URL': 'http://runner:4100',
        'RUNNER_TOKEN': source.secret('runner-token'),
        'AI_PROVIDER': ai['provider'],
        'AI_MODEL': ai['model'],
        'AI_TASK_MODELS': ai['taskModels'],
        'AI_FALLBACK_PROVIDER': ai['fallbackProvider'],
        'AI_FALLBACK_MODEL': ai['fallbackModel'],
        'AI_DATA_CLASSES': data_classes,
        'AI_MODEL_COSTS': ai['modelCosts'],
        'AI_ORG_MONTHLY_BUDGET_USD': ai['orgMonthlyBudgetUsd'],
        'AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY': ai['knowledgeAnswerMinSimilarity'],
        'GEMINI_API_KEY': ai_keys.get('GEMINI_API_KEY', ''),
        'GROQ_API_KEY': ai_keys.get('GROQ_API_KEY', ''),
    }
    email = config['email']
    if email['driver'] == 'ses':
        mail = json_secret(source, 'mail')
        api.update({
            'EMAIL_DRIVER': 'smtp',
            'EMAIL_FROM': email['from'],
            'SMTP_HOST': f'email-smtp.{region}.amazonaws.com',
            'SMTP_PORT': '587',
            'SMTP_SECURE': 'false',
            'SMTP_USER': mail['accessKeyId'],
            'SMTP_PASSWORD': ses_smtp_password(mail['secretAccessKey'], region),
        })
    else:
        api.update({'EMAIL_DRIVER': 'none', 'EMAIL_FROM': email['from']})

    web = {
        'NODE_ENV': 'production',
        'PORT': '3000',
        'HOSTNAME': '0.0.0.0',
        'API_INTERNAL_URL': 'http://api:4000',
        'NEXT_PUBLIC_API_URL': f'{site}/api',
    }
    runner = {
        'RUNNER_HOST': '0.0.0.0',
        'RUNNER_PORT': '4100',
        'RUNNER_TOKEN': api['RUNNER_TOKEN'],
        'RUNNER_IMAGE': f"{config['registry']}/lms-sandbox:{tag}",
        'RUNNER_CONCURRENCY': str(config['runnerConcurrency']),
    }
    release = {
        **api,
        'SEED_ADMIN_EMAIL': admin['email'],
        'SEED_ADMIN_PASSWORD': admin['password'],
        'NODE_PATH': '/repo/apps/api/node_modules',
    }
    compose = {
        'IMAGE_REGISTRY': config['registry'],
        'IMAGE_TAG': tag,
        'WEB_IMAGE_TAG': web_tag,
        'AWS_REGION': region,
        'LOG_GROUP_API': config['logGroups']['api'],
        'LOG_GROUP_WEB': config['logGroups']['web'],
        'LOG_GROUP_RUNNER': config['logGroups']['runner'],
        'DOCKER_GID': gid,
        'APP_ENV_DIR': app_env_dir,
        'CERTS_DIR': certs_dir,
        'SITE_URL': site,
    }
    files = {'compose.env': compose, 'api.env': api, 'web.env': web, 'runner.env': runner,
             'release.env': release}
    for name, values in files.items():
        for key, value in values.items():
            if value is None:
                raise ReleaseConfigError(f'{key} has no value ({name})')
            if FORBIDDEN & set(value):
                raise ReleaseConfigError(f'{key} holds a character an environment file cannot carry')
    return files


def write(out: Path, files: dict[str, dict[str, str]]) -> None:
    out.mkdir(mode=0o700, parents=True, exist_ok=True)
    for name, values in files.items():
        path = out / name
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            handle.writelines(f'{key}={value}\n' for key, value in values.items())
        os.chmod(path, 0o600)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--environment', required=True)
    parser.add_argument('--region', required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--web-tag', required=True)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--certs-dir', default='/opt/si-academy/certs')
    parser.add_argument('--config-file', type=Path, help='tests: configuration from a file')
    parser.add_argument('--secrets-dir', type=Path, help='tests: one file per secret')
    parser.add_argument('--docker-gid', help='tests: the docker group id')
    args = parser.parse_args(argv)

    if args.config_file:
        source = FileSource(args.config_file, args.secrets_dir)
    else:
        source = AwsSource(args.environment, args.region)
    try:
        files = render(source, args.environment, args.region, args.tag, args.web_tag,
                       args.docker_gid or docker_gid(), args.out.as_posix(), args.certs_dir)
    except (ReleaseConfigError, KeyError) as error:
        print(f'release configuration: {error}', file=sys.stderr)
        return 1
    write(args.out, files)
    print(f'environment files written to {args.out} (no value shown)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
