export function FieldError({
  error,
  fieldName,
}: {
  error: string | null;
  fieldName: string;
}) {
  if (!error) return null;

  return (
    <p
      id={`${fieldName}-error`}
      role="alert"
      className="text-red-400 text-xs mt-1.5 font-sans flex items-center gap-1"
    >
      <span aria-hidden="true">⚠</span>
      {error}
    </p>
  );
}
