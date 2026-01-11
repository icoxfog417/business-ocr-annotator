import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

interface GenerateAnnotationEvent {
  imageId: string;
  imageBase64: string; // Base64 encoded image data
  imageFormat: 'jpeg' | 'png' | 'gif' | 'webp';
  language: string;
  documentType: string;
  width: number;
  height: number;
  question?: string; // Optional: specific question to answer
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

// Single question prompts - for answering a specific question
const SINGLE_QUESTION_PROMPTS: Record<string, string> = {
  ja: `この画像を見て、以下の質問に答えてください。

質問: {{QUESTION}}

回答と、回答が見つかる位置のバウンディングボックス座標をJSON形式で返してください。
座標は必ず0から1の間の小数で指定してください（例: x0=0.1は画像幅の10%の位置）。

{"answer": "回答", "boundingBox": {"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25}, "confidence": 0.95}`,
  en: `Look at this image and answer the following question.

Question: {{QUESTION}}

Return the answer and bounding box coordinates in JSON format.
Coordinates MUST be decimal values between 0 and 1 (e.g., x0=0.1 means 10% from left edge).

{"answer": "your answer", "boundingBox": {"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25}, "confidence": 0.95}`,
  zh: `查看这张图片并回答以下问题。

问题: {{QUESTION}}

返回答案和边界框坐标（百分比0-1）的JSON格式:
{"answer": "答案", "boundingBox": {"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25}, "confidence": 0.95}`,
  ko: `이 이미지를 보고 다음 질문에 답하세요.

질문: {{QUESTION}}

답변과 경계 상자 좌표(백분율 0-1)를 JSON 형식으로 반환:
{"answer": "답변", "boundingBox": {"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25}, "confidence": 0.95}`,
};

function convertToPixelCoordinates(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number
): [number, number, number, number] {
  // Normalize coordinates if model returned pixel values instead of 0-1
  let { x0, y0, x1, y1 } = bbox;
  if (x0 > 1) x0 = x0 / width;
  if (y0 > 1) y0 = y0 / height;
  if (x1 > 1) x1 = x1 / width;
  if (y1 > 1) y1 = y1 / height;

  return [
    Math.round(x0 * width),
    Math.round(y0 * height),
    Math.round(x1 * width),
    Math.round(y1 * height),
  ];
}

export const handler = async (
  event: GenerateAnnotationEvent | { arguments: GenerateAnnotationEvent }
): Promise<GenerateAnnotationResponse> => {
  const modelId = process.env.MODEL_ID || 'nvidia.nemotron-nano-12b-v2';
  const region = process.env.AWS_REGION || 'us-east-1';

  const bedrockClient = new BedrockRuntimeClient({ region });

  // AppSync wraps arguments - extract them
  const args = 'arguments' in event ? event.arguments : event;

  try {
    console.log('Event received for imageId:', args.imageId);

    const { imageId, imageBase64, imageFormat, language, width, height, question } = args;

    if (!imageId || !imageBase64) {
      throw new Error('imageId and imageBase64 are required');
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Get prompt for language
    let prompt: string;
    if (question) {
      // Single question mode - answer specific question
      prompt = SINGLE_QUESTION_PROMPTS[language] || SINGLE_QUESTION_PROMPTS['en'];
      prompt = prompt.replace('{{QUESTION}}', question);
    } else {
      // Multi-question mode - generate multiple Q&A pairs
      prompt = PROMPTS[language] || PROMPTS['en'];
    }

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
      question?: string;
      answer: string;
      boundingBox: { x0: number; y0: number; x1: number; y1: number };
      confidence?: number;
    }

    let parsedAnnotations: ParsedAnnotation[];

    try {
      const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Handle both single-question format and multi-question format
        if (parsed.annotations) {
          parsedAnnotations = parsed.annotations;
        } else if (parsed.answer) {
          // Single question response - wrap in array
          parsedAnnotations = [{ ...parsed, question: question || '' }];
        } else {
          throw new Error('Unexpected response format');
        }
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
    const annotations: AnnotationResult[] = parsedAnnotations.map((ann) => ({
      question: ann.question || question || '',
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
      imageId: args.imageId,
      modelVersion: modelId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
