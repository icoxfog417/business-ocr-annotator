import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function getTableNames(): { annotationTable: string; imageTable: string } {
  const annotationTable = process.env.ANNOTATION_TABLE_NAME;
  const imageTable = process.env.IMAGE_TABLE_NAME;

  if (!annotationTable) throw new Error('ANNOTATION_TABLE_NAME environment variable not set');
  if (!imageTable) throw new Error('IMAGE_TABLE_NAME environment variable not set');

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
 * Uses ProjectionExpression to transfer only imageId per record (~36 bytes each),
 * then deduplicates server-side. At 100k annotations this is ~3.6MB — well within
 * Lambda memory limits. For significantly larger datasets, consider maintaining
 * a counter table updated via DynamoDB Streams instead.
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
    const { annotationTable, imageTable } = getTableNames();

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
