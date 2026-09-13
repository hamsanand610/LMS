/** Inline validation message under a field. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-danger" role="alert">
      {message}
    </p>
  );
}
