'use client';

import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentRange,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { ExecutionLanguage } from '@lms/shared';
import { cn } from '@/lib/utils';

/** What a parent can do to the editor once it is ready. */
export interface CodeEditorApi {
  /** Replaces everything with this text (a reset to the starter code). */
  setValue(value: string): void;
  /** Re-indents the whole file by the language's own rules. */
  format(): void;
  focus(): void;
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: ExecutionLanguage;
  /** The editor's accessible name ("Your solution"). */
  label: string;
  readOnly?: boolean;
  /** In pixels; 13 unless the learner chose another size. */
  fontSize?: number;
  className?: string;
  /** Ctrl/⌘ + Enter. */
  onRun?: () => void;
  /** Ctrl/⌘ + Shift + Enter. */
  onSubmit?: () => void;
  onReady?: (api: CodeEditorApi) => void;
}

/**
 * Syntax colours come from tokens (`--code-*`, ADR-0016) and keywords take the brand's light
 * accent, so the editor sits on the ink plane like the rest of the product in both themes.
 */
const HIGHLIGHT = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.operatorKeyword,
      t.modifier,
      t.definitionKeyword,
      t.moduleKeyword,
      t.self,
    ],
    color: 'var(--nav-accent)',
  },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: 'var(--code-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.character, t.escape],
    color: 'var(--code-string)',
  },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: 'var(--code-number)' },
  {
    tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName), t.annotation],
    color: 'var(--code-type)',
  },
  {
    tag: [
      t.function(t.variableName),
      t.function(t.propertyName),
      t.macroName,
      t.definition(t.function(t.variableName)),
    ],
    color: 'var(--code-function)',
  },
  {
    tag: [t.operator, t.punctuation, t.bracket, t.separator, t.derefOperator],
    color: 'var(--code-operator)',
  },
  { tag: [t.variableName, t.propertyName, t.attributeName, t.labelName], color: 'var(--nav-text)' },
  { tag: t.invalid, color: 'var(--code-invalid)' },
]);

const THEME = EditorView.theme(
  {
    '&': {
      color: 'var(--nav-text)',
      backgroundColor: 'var(--nav-bg)',
      height: '100%',
      fontSize: 'var(--editor-font-size, 13px)',
    },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.75', overflow: 'auto' },
    '.cm-content': { caretColor: 'var(--nav-focus)', padding: '10px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--nav-focus)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--nav-active)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--nav-bg)',
      color: 'var(--nav-muted)',
      border: 'none',
      paddingRight: '4px',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 14px', minWidth: '40px' },
    '.cm-activeLine': { backgroundColor: 'var(--nav-hover)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--nav-hover)', color: 'var(--nav-text)' },
    '.cm-foldGutter .cm-gutterElement': { color: 'var(--nav-muted)', cursor: 'pointer' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'transparent',
      outline: '1px solid var(--nav-accent)',
      borderRadius: '2px',
    },
    '.cm-selectionMatch': { backgroundColor: 'var(--nav-hover)' },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--nav-hover)',
      border: '1px solid var(--nav-border)',
      color: 'var(--nav-text)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--nav-bg)',
      border: '1px solid var(--nav-border)',
      color: 'var(--nav-text)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--nav-active)',
      color: 'var(--nav-text)',
    },
    '.cm-panels': { backgroundColor: 'var(--nav-bg)', color: 'var(--nav-text)' },
    '.cm-panels input, .cm-panels button': { color: 'var(--nav-text)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

/** Each language's support is loaded only when the editor needs it. */
async function languageSupport(language: ExecutionLanguage): Promise<Extension> {
  switch (language) {
    case 'java':
      return (await import('@codemirror/lang-java')).java();
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'php':
      return (await import('@codemirror/lang-php')).php();
    case 'sql': {
      const { sql, SQLite } = await import('@codemirror/lang-sql');
      return sql({ dialect: SQLite, upperCaseKeywords: true });
    }
    default:
      return [];
  }
}

/** Java and PHP read best at four spaces; Python needs four; JavaScript and SQL use two. */
const INDENT: Record<ExecutionLanguage, string> = {
  java: '    ',
  python: '    ',
  php: '    ',
  javascript: '  ',
  sql: '  ',
};

/**
 * The code editor (CodeMirror 6, ADR-0016): syntax colours, line numbers, folding, bracket
 * matching and closing, indentation that follows the language, search, undo history, and the
 * run and submit shortcuts. Tab indents; Esc then Tab leaves the editor, as the hint says.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  readOnly = false,
  fontSize = 13,
  className,
  onRun,
  onSubmit,
  onReady,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const readOnlySlot = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun, onSubmit });
  const hintId = useId();
  // The editor's listeners read the latest handlers through this ref, kept current after each render.
  useLayoutEffect(() => {
    callbacks.current = { onChange, onRun, onSubmit };
  });

  // Created once; later changes arrive through compartments and transactions.
  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(HIGHLIGHT),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: false }),
        highlightActiveLine(),
        highlightSelectionMatches(),
        indentUnit.of(INDENT[language]),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                callbacks.current.onRun?.();
                return Boolean(callbacks.current.onRun);
              },
            },
            {
              key: 'Mod-Shift-Enter',
              run: () => {
                callbacks.current.onSubmit?.();
                return Boolean(callbacks.current.onSubmit);
              },
            },
          ]),
        ),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        THEME,
        languageSlot.current.of([]),
        readOnlySlot.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        EditorView.contentAttributes.of({
          'aria-label': label,
          'aria-describedby': hintId,
          'aria-multiline': 'true',
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    onReady?.({
      setValue: (next) =>
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: next } }),
      format: () => {
        const changes = indentRange(editor.state, 0, editor.state.doc.length);
        if (!changes.empty) editor.dispatch({ changes });
      },
      focus: () => editor.focus(),
    });
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is built once; value, language and read-only changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The language's grammar, loaded on demand.
  useEffect(() => {
    let cancelled = false;
    void languageSupport(language).then((support) => {
      if (cancelled || !view.current) return;
      view.current.dispatch({
        effects: languageSlot.current.reconfigure([support, indentUnit.of(INDENT[language])]),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlySlot.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  // A value from outside (another language's draft, a loaded submission) replaces the text.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      data-nav-plane
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden bg-[var(--nav-bg)] focus-within:ring-2 focus-within:ring-[var(--nav-focus)]',
        className,
      )}
      style={{ ['--editor-font-size' as string]: `${fontSize}px` }}
    >
      <div ref={host} className="min-h-0 flex-1" />
      <p id={hintId} className="sr-only">
        Tab indents. Press Escape, then Tab, to move out of the editor. Control and Enter runs your
        code; Control, Shift and Enter submits it.
      </p>
    </div>
  );
}
