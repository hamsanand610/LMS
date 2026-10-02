# ADR-0019 — Web Lab: an isolated preview in the browser, checks in the sandbox

- **Status**: accepted (proposed on 2026-10-02 and built in Roadmap Phase 1)
- **Approved**: 2026-10-02, by the client, at the Phase 1 gate
- **Date**: 2026-10-02
- **Phase**: Roadmap Phase 1 (Labs and Playground)
- **Keeps**: ADR-0016 (the browser never judges code); the web app's content security policy

## Context

A Web Lab learner edits HTML, CSS and JavaScript, needs to see the page, and needs a verdict that
counts. The learner's JavaScript is untrusted. A preview must not become a route to:

- the platform's cookies, tokens or storage;
- the API, other internal services, `localhost` or Docker services;
- metadata endpoints;
- another learner's work.

The web app's CSP forbids frames (`frame-src 'none'`). ADR-0016 says the browser never judges code.

Evidence gathered in Phase 1, on Chromium (the browser the journeys run in):

- **The preview frame.** A `<iframe sandbox="allow-scripts" srcdoc="…">` renders under the app's
  unchanged CSP: `srcdoc` is not a fetch, so `frame-src 'none'` does not block it.
- **Inside the frame:**
  - the origin is opaque (`null`);
  - `document.cookie`, `localStorage` and `parent.document` all throw a SecurityError;
  - `fetch` to the app or to any host is refused by the frame's own CSP, and the server saw no
    request;
  - an image beacon to another host was refused;
  - popups were blocked.
- **Messages.** The frame can `postMessage` to its parent, which can tell that the message came from
  that frame.
- **The checker (jsdom 26).** On Node 18, as in the sandbox:
  - scripts are held back until the checker has captured untouched references to the DOM;
  - a learner who replaces `querySelector` or `Function.prototype.call` does not change what the
    checker sees;
  - computed styles from stylesheets are reported (colour, display, font size, margins);
  - `fetch` does not exist in the page.
- **Found while building it** (2 October 2026, in the sandbox image):
  - jsdom is not a security boundary. A page's script reaches Node in one line through jsdom's own
    objects (`window._virtualConsole.constructor.constructor('return process')()`), and from
    there can print a verdict itself. A checker that runs the page's scripts in its own process can
    therefore be told `pass`;
  - loading jsdom costs about one second of CPU on the sandbox's Node 18, not 200 ms.

## Decision

1. **The preview is non-authoritative and isolated.**
   - The web app builds one document from the learner's files and shows it in an iframe with
     `sandbox="allow-scripts"` only (no `allow-same-origin`, forms, popups, modals or top
     navigation) through `srcdoc`.
   - That document starts with its own policy:

     ```
     default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
     img-src data:; font-src data:; media-src data:; form-action 'none'; base-uri 'none'
     ```

     It combines with the inherited policy, so it can only narrow it.

   - Before the document is assembled, `<base>` and `<meta http-equiv="refresh">` are removed from
     the learner's HTML.
   - A small console bridge posts `console` output and errors to the parent. The parent accepts a
     message only from that frame, and shows it as text.
   - The preview runs when the learner presses Run, not on every keystroke.
   - The app's own CSP is unchanged.
2. **The checks are authoritative and run in the sandbox, in two programs that never run at the
   same time.**
   - A `web` job goes to the sandbox runner like any other: one locked-down container, no network,
     no capabilities, CPU and memory limits (ADR-0016).
   - **The page** (`/opt/lms/web/webpage.js`) loads the learner's files into jsdom with scripts held
     back, removes `XMLHttpRequest` and `WebSocket`, gives the page what the preview's frame gives
     it (no storage, cookies or dialogs), runs the learner's scripts in document order, lets
     `DOMContentLoaded`, `load` and a short settle time pass, and performs the check's steps. It is
     given the steps and never the assertion, and it prints only a snapshot of the page: the element
     tree as data (so a script-built `<table><tr>` keeps its shape), the live state of form fields,
     what the page logged and the errors it raised.
   - **Nothing the page started survives it.** The harness then stops every process the sandbox user
     still has, apart from itself and its ancestors, before anything else runs.
   - **The checker** (`/opt/lms/web/webcheck.js`) runs none of the page's code. It rebuilds each
     snapshot's elements with scripts switched off and decides each check against it.
   - It prints, for each check, `pass` or a one-line reason. The API compares that with the case's
     expected `pass`, so hidden checks stay hidden exactly as hidden test cases do.
   - A page that subverts jsdom can only misdescribe itself; it never learns what a check expects,
     and it is not running when the verdict is written.
   - Checks without steps look at the same freshly loaded page, so they share one load; each
     interaction check gets a page of its own; one checker decides the whole job. The page's time
     limit is the learner's; the checker's limits are the harness's own and are not charged to them.
3. **Checks are structured, not code.** A check is one of:
   - an element count for a selector (`exists`);
   - text (equals, contains, matches);
   - an attribute (present, equals, contains);
   - a computed style property;
   - console output;
   - an interaction: up to ten steps (click, input, change, submit, focus, blur, keydown) followed by
     one of the assertions above.

   The schema lives in `packages/shared` and is validated on save and again in the sandbox.

4. **The runtime.** jsdom 26.1.0 (MIT; supports Node 18, which the sandbox image ships) is installed
   from a locked `package.json` in a build stage and copied into the image. It is pinned in
   `docs/STACK.md`.
5. **The editor.** `@codemirror/lang-html` and `@codemirror/lang-css` (MIT, the CodeMirror project's
   own packages) give the HTML and CSS editors.

## Consequences

- **Separation.** A learner sees their page in a real browser, but nothing the page does counts and
  nothing it does can reach the platform. What counts runs where all learner code runs.
- **No layout checks.** jsdom has no layout engine, so checks cannot judge layout ("the box is
  centred") or pixels. Authors check structure, text, attributes, computed style rules, console
  output and behaviour. A visual checker would need a real browser in the sandbox; that is a later
  ADR if evaluation shows the need.
- **Freezing the tab.** A preview that loops forever can freeze the learner's own tab, as any page
  could; it cannot reach anyone else.
- **Speed.** Loading jsdom costs about a second of CPU on the sandbox's Node 18. One page load serves
  every check without steps, each interaction check needs its own, and one checker load decides the
  job: a lab with six checks, three of them interactions, takes about ten seconds to submit. Each
  page's start-up allowance is 4 s of CPU on top of the lab's own limit. A warm start (a V8 code
  cache or a startup snapshot) could shorten it later.
- **What the page sees.** jsdom has no `innerText`, `matchMedia` or scrolling; the page runner adds
  the first as the text content and the others as harmless stand-ins, so ordinary pages behave as in
  the preview. Style values are compared as jsdom computes them: colours in any notation, `bold`
  and `normal` as 700 and 400, sizes as written. A check sees classes, inline styles and the text of
  style elements, but not rules a script adds through the CSSOM (`insertRule`), nor which element
  has focus.

## Alternatives considered

- **A separate preview origin** (a second host serving learners' pages). It needs another
  hostname, certificates and a CSP change, for isolation the opaque origin already gives. Rejected.
- **`allow-same-origin` on the frame.** It would give learner code the platform's origin. Rejected
  outright.
- **Judging in the browser.** Forbidden by ADR-0016.
- **A headless Chromium in the sandbox.** It brings full fidelity, but adds about 300 MB to the
  image, about 300 MB of memory per job, and needs `--no-sandbox` inside the container. Deferred
  until layout checks are needed.
