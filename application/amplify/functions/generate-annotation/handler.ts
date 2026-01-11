import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ImageFormat,
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

interface GenerateAnnotationEvent {
  imageId: string;
  s3Key: string;
  language: string;
  documentType: string;
  width: number;
  height: number;
}

interface AnnotationResult {
  question: string;
  answer: string;
  boundingBox: [number, number, number, number];
  confidence?: number;
}

interface GenerateAnnotationResponse {
  success: boolean;
  imageId: string;
  annotations?: AnnotationResult[];
  modelVersion: string;
  error?: string;
}

const PROMPTS: Record<string, string> = {
  ja: `この業務文書画像を分析し、3〜5個の質問と回答を生成してください。

各質問について:
1. 文書内の具体的な情報についての自然な質問を作成
2. 文書内で見つかった回答を提供
3. 回答が見つかる位置のバウンディングボックス座標を指定（画像サイズに対する割合: 0-1）

JSON形式で返してください:
{
  "annotations": [
    {
      "question": "合計金額はいくらですか？",
      "answer": "¥1,234",
      "boundingBox": { "x0": 0.6, "y0": 0.8, "x1": 0.9, "y1": 0.85 },
      "confidence": 0.95
    }
  ]
}`,
  en: `Analyze this business document image and generate 3-5 questions with answers.

For each question:
1. Create a natural question about specific information in the document
2. Provide the answer found in the document
3. Specify bounding box coordinates (as percentages 0-1 of image dimensions)

Return JSON format:
{
  "annotations": [
    {
      "question": "What is the total amount?",
      "answer": "$123.45",
      "boundingBox": { "x0": 0.6, "y0": 0.8, "x1": 0.9, "y1": 0.85 },
      "confidence": 0.95
    }
  ]
}`,
  zh: `分析这张商业文档图片，生成3-5个问题和答案。

对于每个问题：
1. 创建关于文档中具体信息的自然问题
2. 提供在文档中找到的答案
3. 指定边界框坐标（图像尺寸的百分比：0-1）

返回JSON格式：
{
  "annotations": [
    {
      "question": "总金额是多少？",
      "answer": "¥1,234",
      "boundingBox": { "x0": 0.6, "y0": 0.8, "x1": 0.9, "y1": 0.85 },
      "confidence": 0.95
    }
  ]
}`,
  ko: `이 비즈니스 문서 이미지를 분석하고 3-5개의 질문과 답변을 생성하세요.

각 질문에 대해:
1. 문서의 특정 정보에 대한 자연스러운 질문 작성
2. 문서에서 찾은 답변 제공
3. 경계 상자 좌표 지정 (이미지 크기의 백분율: 0-1)

JSON 형식으로 반환:
{
  "annotations": [
    {
      "question": "총 금액은 얼마입니까?",
      "answer": "₩1,234",
      "boundingBox": { "x0": 0.6, "y0": 0.8, "x1": 0.9, "y1": 0.85 },
      "confidence": 0.95
    }
  ]
}`,
};

function getImageFormat(s3Key: string): ImageFormat {
  const ext = s3Key.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'webp':
      return 'webp';
    default:
      return 'jpeg';
  }
}

function convertToPixelCoordinates(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number
): [number, number, number, number] {
  return [
    Math.round(bbox.x0 * width),
    Math.round(bbox.y0 * height),
    Math.round(bbox.x1 * width),
    Math.round(bbox.y1 * height),
  ];
}

export const handler = async (
  event: GenerateAnnotationEvent
): Promise<GenerateAnnotationResponse> => {
  const modelId = process.env.MODEL_ID || 'nvidia.nemotron-nano-12b-v2';
  const region = process.env.AWS_REGION || 'us-east-1';

  const s3Client = new S3Client({ region });
  const bedrockClient = new BedrockRuntimeClient({ region });

  try {
    console.log('Event:', JSON.stringify(event, null, 2));

    const { imageId, s3Key, language, width, height } = event;

    if (!imageId || !s3Key) {
      throw new Error('imageId and s3Key are required');
    }

    // Get image from S3
    const bucketName = process.env.STORAGE_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('STORAGE_BUCKET_NAME environment variable not set');
    }

    console.log('Fetching image from S3:', s3Key);
    const s3Response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: s3Key })
    );

    const chunks: Uint8Array[] = [];
    if (s3Response.Body) {
      const stream = s3Response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    }
    const imageBuffer = Buffer.concat(chunks);
    const imageFormat = getImageFormat(s3Key);

    // Get prompt for language
    const prompt = PROMPTS[language] || PROMPTS['en'];

    // Call Bedrock Converse API
    console.log('Calling Bedrock with model:', modelId);
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [
            { text: prompt },
            {
              image: {
                format: imageFormat,
                source: { bytes: imageBuffer },
              },
            },
          ],
        },
      ],
      inferenceConfig: {
        temperature: 0.1,
        maxTokens: 2000,
      },
    });

    const response = await bedrockClient.send(command);
    const content = response.output?.message?.content;
    const responseText = content?.[0] && 'text' in content[0] ? content[0].text : '';

    console.log('Bedrock response:', responseText);
    console.log('Token usage:', response.usage);

    // Parse JSON response
    interface ParsedAnnotation {
      question: string;
      answer: string;
      boundingBox: { x0: number; y0: number; x1: number; y1: number };
      confidence?: number;
    }

    let parsedResponse: { annotations: ParsedAnnotation[] };

    try {
      const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      return {
        success: false,
        imageId,
        modelVersion: modelId,
        error: 'Failed to parse model response',
      };
    }

    // Convert bounding boxes to pixel coordinates
    const annotations: AnnotationResult[] = parsedResponse.annotations.map((ann) => ({
      question: ann.question,
      answer: ann.answer,
      boundingBox: convertToPixelCoordinates(ann.boundingBox, width, height),
      confidence: ann.confidence,
    }));

    return {
      success: true,
      imageId,
      annotations,
      modelVersion: modelId,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      success: false,
      imageId: event.imageId,
      modelVersion: modelId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
