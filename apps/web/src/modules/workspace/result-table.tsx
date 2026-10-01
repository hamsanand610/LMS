'use client';

/**
 * A SQL result as a table. The sandbox prints `{ columns, rows }`; anything else is shown as the
 * text it is, so a broken result still says what went wrong.
 */
export function ResultTable({ json }: { json: string }) {
  let table: { columns: string[]; rows: unknown[][]; truncated?: boolean } | null = null;
  try {
    const value = JSON.parse(json) as { columns?: unknown; rows?: unknown; truncated?: boolean };
    if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
      table = {
        columns: value.columns.map(String),
        rows: value.rows as unknown[][],
        truncated: value.truncated,
      };
    }
  } catch {
    table = null;
  }
  if (!table) {
    return (
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] whitespace-pre">
        {json}
      </pre>
    );
  }
  if (table.columns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No result set (the statements changed data only).
      </p>
    );
  }
  return (
    <div className="max-h-56 overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left font-mono text-[12px]">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {table.columns.map((column, i) => (
              <th
                key={`${column}-${i}`}
                scope="col"
                className="border-b border-border px-2.5 py-1.5 font-semibold"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="odd:bg-card even:bg-surface-2/40">
              {row.map((cell, c) => (
                <td key={c} className="border-b border-border/60 px-2.5 py-1 tabular-nums">
                  {cell === null ? (
                    <span className="text-muted-foreground">NULL</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2.5 py-1 text-[11px] text-muted-foreground">
        {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}
        {table.truncated ? ' (more were cut off)' : ''}
      </p>
    </div>
  );
}
