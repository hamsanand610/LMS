import { permanentRedirect } from 'next/navigation';

/** The practice catalogue became the Labs (ADR-0018); old links and bookmarks still arrive. */
export default function Page() {
  permanentRedirect('/labs');
}
