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

    if (Array.isArray(result.data)) {
      allItems.push(...(result.data as T[]));
    }
    nextToken = result.nextToken;
    pages += 1;
  } while (nextToken && pages < MAX_PAGES);

  return allItems;
}
