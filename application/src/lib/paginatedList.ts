import { client } from './apiClient';

type ModelName = keyof typeof client.models;

interface ListOptions {
  filter?: Record<string, unknown>;
}

const MAX_PAGES = 1000;

/**
 * Fetch all items from an Amplify model using pagination.
 *
 * Amplify Gen2 `list()` returns at most one page of results by default.
 * This helper follows `nextToken` to retrieve every record.
 *
 * Note: The Amplify client's `list()` returns `{ data: [], errors }` on
 * GraphQL errors instead of throwing.  We surface those errors so callers
 * can decide how to handle them rather than silently returning empty data.
 */
export async function listAllItems<T>(
  modelName: ModelName,
  options?: ListOptions
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | null | undefined;
  let pages = 0;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = client.models[modelName] as any;
    const result = await model.list({
      ...(options?.filter ? { filter: options.filter } : {}),
      ...(nextToken ? { nextToken } : {}),
    });

    // Surface GraphQL errors that the Amplify client silently swallows
    if (result.errors && result.errors.length > 0) {
      console.error(`GraphQL errors listing ${modelName}:`, result.errors);
    }

    if (Array.isArray(result.data)) {
      // Filter out null entries caused by GraphQL errors on required fields
      allItems.push(...result.data.filter((item: T | null): item is T => item != null));
    }
    nextToken = result.nextToken;
    pages += 1;
  } while (nextToken && pages < MAX_PAGES);

  return allItems;
}
