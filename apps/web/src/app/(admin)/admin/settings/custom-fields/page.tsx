import { permanentRedirect } from 'next/navigation';

/**
 * Custom fields moved in with the vocabularies (plan DP-A32). The old address still works, so a
 * bookmark or a link from an earlier phase does not break.
 */
export default function CustomFieldsPage() {
  permanentRedirect('/admin/settings/fields');
}
