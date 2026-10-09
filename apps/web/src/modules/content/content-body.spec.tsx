// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentBody, anchorOf, blocksOf } from './content-body';

afterEach(cleanup);

const BODY = `**Draft for review.** Not yet approved.

## Who we are

The platform is run by SI Academy. [To be confirmed: the legal name.]

## What we hold

### Your account

- Your name and email.
- A photo, if you add one,
  carried on to the next line.
Text after the list.

## Who we are`;

describe('a content page’s words (privacy, terms)', () => {
  it('reads paragraphs, headings and lists from plain text', () => {
    expect(blocksOf(BODY)).toEqual([
      { kind: 'paragraph', text: '**Draft for review.** Not yet approved.' },
      { kind: 'heading', level: 2, text: 'Who we are', id: 'who-we-are' },
      {
        kind: 'paragraph',
        text: 'The platform is run by SI Academy. [To be confirmed: the legal name.]',
      },
      { kind: 'heading', level: 2, text: 'What we hold', id: 'what-we-hold' },
      { kind: 'heading', level: 3, text: 'Your account', id: 'your-account' },
      {
        kind: 'list',
        items: ['Your name and email.', 'A photo, if you add one, carried on to the next line.'],
      },
      { kind: 'paragraph', text: 'Text after the list.' },
      // The same heading twice gets its own anchor.
      { kind: 'heading', level: 2, text: 'Who we are', id: 'who-we-are-2' },
    ]);
    expect(anchorOf('Cookies & storage in your browser')).toBe('cookies-storage-in-your-browser');
    expect(anchorOf('!!!')).toBe('section');
  });

  it('renders bold, marks what is to be confirmed, and lists the sections it has', () => {
    render(<ContentBody body={BODY} />);
    expect(screen.getByText('Draft for review.').tagName).toBe('STRONG');
    expect(screen.getByText('[To be confirmed: the legal name.]').tagName).toBe('MARK');
    expect(screen.getByRole('heading', { level: 2, name: 'What we hold' }).id).toBe('what-we-hold');
    const contents = screen.getByRole('navigation', { name: 'On this page' });
    expect(contents.querySelectorAll('a')).toHaveLength(3);
    expect(contents.querySelector('a')?.getAttribute('href')).toBe('#who-we-are');
  });

  it('never interprets the words as HTML', () => {
    const { container } = render(
      <ContentBody body={'<img src=x onerror="alert(1)"> and <b>bold</b>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('keeps a short page plain: no contents list under three sections', () => {
    render(<ContentBody body={'One paragraph.\n\nAnother, with **bold** words.'} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });
});
