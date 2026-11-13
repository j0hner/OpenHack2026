/** Providers own fetching + validation + normalization. Repositories own persistence.
 * Fetching happens outside SQLite transactions and can be cancelled. */
export interface SourceAdapter<Query, Snapshot> {
  readonly sourceId: string;
  load(query: Query): Promise<Snapshot>;
}
