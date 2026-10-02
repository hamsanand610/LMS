'use client';

import { decodeWebFiles, WEB_FILE_LABELS, WEB_FILES, type ExecutionLanguage } from '@lms/shared';
import { CodeEditor } from '@/components/code-editor';

/**
 * Submitted code, read-only: one editor for a program, or a web page's files (ADR-0019) when the
 * answer is a web bundle, so nobody reads the bundle's encoding.
 */
export function SubmittedCode({
  code,
  language,
  label,
  className,
}: {
  code: string;
  language: ExecutionLanguage | null;
  label: string;
  className?: string;
}) {
  const files = language === 'web' ? decodeWebFiles(code) : null;
  if (files) {
    return (
      <div className="space-y-3">
        {WEB_FILES.filter((name) => files[name]).map((name) => (
          <div key={name}>
            <p className="mb-1 font-mono text-xs text-muted-foreground">{WEB_FILE_LABELS[name]}</p>
            <div className="overflow-hidden rounded-lg border border-border">
              <CodeEditor
                value={files[name]}
                language={name === 'js' ? 'javascript' : name}
                label={`${label}: ${WEB_FILE_LABELS[name]}`}
                readOnly
                className={className}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <CodeEditor
        value={code}
        language={language ?? 'java'}
        label={label}
        readOnly
        className={className}
      />
    </div>
  );
}
