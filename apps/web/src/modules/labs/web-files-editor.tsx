'use client';

import { useState } from 'react';
import {
  WEB_FILE_LABELS,
  WEB_FILES,
  WEB_LAB_LIMITS,
  type WebFileName,
  type WebFiles,
} from '@lms/shared';
import { CodeEditor } from '@/components/code-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const EDITOR_LANGUAGE: Record<WebFileName, 'html' | 'css' | 'javascript'> = {
  html: 'html',
  css: 'css',
  js: 'javascript',
};

/**
 * A Web Lab's three files, one tab each (ADR-0019). Every file keeps its own editor, so switching
 * files keeps each one's undo history and cursor.
 */
export function WebFilesEditor({
  files,
  onChange,
  label,
  fontSize,
  readOnly = false,
  onRun,
  onSubmit,
  className,
  editorClassName,
}: {
  files: WebFiles;
  onChange?: (files: WebFiles) => void;
  /** Names the editors for assistive technology ("Starting files"). */
  label: string;
  fontSize?: number;
  readOnly?: boolean;
  onRun?: () => void;
  onSubmit?: () => void;
  className?: string;
  editorClassName?: string;
}) {
  const [active, setActive] = useState<WebFileName>('html');
  return (
    <Tabs
      value={active}
      onValueChange={(value) => setActive(value as WebFileName)}
      className={cn('flex min-h-0 flex-col gap-0', className)}
    >
      <TabsList aria-label={`${label}: files`} className="h-10 px-3">
        {WEB_FILES.map((name) => {
          const tooLong = files[name].length > WEB_LAB_LIMITS.fileChars;
          return (
            <TabsTrigger key={name} value={name} className="font-mono text-xs">
              {WEB_FILE_LABELS[name]}
              {tooLong ? <span className="font-sans text-danger">(too long)</span> : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {WEB_FILES.map((name) => (
        <TabsContent
          key={name}
          value={name}
          forceMount
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
        >
          <CodeEditor
            value={files[name]}
            onChange={onChange ? (value) => onChange({ ...files, [name]: value }) : undefined}
            language={EDITOR_LANGUAGE[name]}
            label={`${label}: ${WEB_FILE_LABELS[name]}`}
            readOnly={readOnly}
            fontSize={fontSize}
            onRun={onRun}
            onSubmit={onSubmit}
            className={cn('h-full', editorClassName)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
