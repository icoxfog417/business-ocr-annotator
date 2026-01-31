import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Cache for discovered table names
let cachedAnnotationTable: string | null = null;
let cachedImageTable: string | null = null;

async function discoverTables(): Promise<{ annotationTable: string; imageTable: string }> {
  if (cachedAnnotationTable && cachedImageTable) {
    return { annotationTable: cachedAnnotationTable, imageTable: cachedImageTable };
  }

  const result = await dynamoClient.send(new ListTablesCommand({}));
  const tables = result.TableNames ?? [];

  const annotationTable = tables.find((name) => name.startsWith('Annotation-'));
  const imageTable = tables.find((name) => name.startsWith('Image-'));

  if (!annotationTable) throw new Error('Annotation table not found');
  if (!imageTable) throw new Error('Image table not found');

  cachedAnnotationTable = annotationTable;
  cachedImageTable = imageTable;
  console.log(`Using tables: Annotation=${annotationTable}, Image=${imageTable}`);
  return { annotationTable, imageTable };
}

/**
 * Count annotations for a given status using the annotationsByValidationStatus GSI.
 * Handles DynamoDB pagination for large datasets (DynamoDB may return partial counts).
 */
async function countAnnotationsByStatus(tableName: string, status: string): Promise<number> {
  let total = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: 'annotationsByValidationStatus',
        KeyConditionExpression: 'validationStatus = :status',
        ExpressionAttributeValues: { ':status': status },
        Select: 'COUNT',
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    total += result.Count ?? 0;
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return total;
}

/**
 * Count total images using a Scan with Select: COUNT.
 * Handles pagination for large tables.
 */
async function countImages(tableName: string): Promise<number> {
  let total = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: 'COUNT',
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    total += result.Count ?? 0;
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return total;
}

/**
 * Get unique image IDs from annotations with exportable statuses (PENDING + APPROVED).
 * Uses ProjectionExpression to transfer only imageId per record, then deduplicates server-side.
 */
async function countExportableImages(tableName: string): Promise<number> {
  const imageIds = new Set<string>();

  for (const status of ['PENDING', 'APPROVED']) {
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'annotationsByValidationStatus',
          KeyConditionExpression: 'validationStatus = :status',
          ExpressionAttributeValues: { ':status': status },
          ProjectionExpression: 'imageId',
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      for (const item of result.Items ?? []) {
        if (item.imageId) {
          imageIds.add(item.imageId as string);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);
  }

  return imageIds.size;
}

interface AnnotationCountsResponse {
  annotations: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  images: {
    total: number;
    exportable: number;
  };
}

export const handler = async (): Promise<AnnotationCountsResponse> => {
  try {
    const { annotationTable, imageTable } = await discoverTables();

    // Run all count queries in parallel
    const [pending, approved, rejected, totalImages, exportableImages] = await Promise.all([
      countAnnotationsByStatus(annotationTable, 'PENDING'),
      countAnnotationsByStatus(annotationTable, 'APPROVED'),
      countAnnotationsByStatus(annotationTable, 'REJECTED'),
      countImages(imageTable),
      countExportableImages(annotationTable),
    ]);

    const total = pending + approved + rejected;

    console.log(`Counts: annotations=${total} (P=${pending}, A=${approved}, R=${rejected}), images=${totalImages}, exportable=${exportableImages}`);

    return {
      annotations: { total, pending, approved, rejected },
      images: { total: totalImages, exportable: exportableImages },
    };
  } catch (error) {
    console.error('Error getting annotation counts:', error);
    throw error;
  }
};
