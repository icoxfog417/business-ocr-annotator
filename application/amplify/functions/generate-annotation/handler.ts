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
  ja: `質問に対する答えの値だけを返してください。

質問: {{QUESTION}}

【重要】
- 質問のラベル部分は出力しない
- 答えの値のみを出力
- 金額は数字のみ（¥や括弧は除外）
- 日付はyyyy/MM/dd形式（例: 2026年1月22日 → 2026/01/22）
- 複数項目は1行に1つ`,
  en: `Return only the answer value for the question.

Question: {{QUESTION}}

【Important】
- Do not output the question label
- Output only the answer value
- Money: numbers only (exclude $ and parentheses)
- Date: yyyy/MM/dd format (e.g., Jan 22, 2026 → 2026/01/22)
- Multiple items: one per line`,
  zh: `只返回问题的答案值。

问题: {{QUESTION}}

【重要】
- 不要输出问题标签
- 仅输出答案值
- 金额仅数字（排除¥和括号）
- 日期yyyy/MM/dd格式（例: 2026年1月22日 → 2026/01/22）
- 多个项目每行一个`,
  ko: `질문에 대한 답의 값만 반환하세요.

질문: {{QUESTION}}

【중요】
- 질문 레이블은 출력하지 않음
- 답의 값만 출력
- 금액은 숫자만 (₩와 괄호 제외)
- 날짜는 yyyy/MM/dd 형식 (예: 2026년 1월 22일 → 2026/01/22)
- 여러 항목은 한 줄에 하나씩`,
};

export const handler = async (
  event: GenerateAnnotationEvent | { arguments: GenerateAnnotationEvent }
): Promise<GenerateAnnotationResponse> => {
  const modelId = process.env.MODEL_ID || 'nvidia.nemotron-nano-12b-v2';
  const region = process.env.AWS_REGION || 'us-east-1';

  const bedrockClient = new BedrockRuntimeClient({ region });

  // AppSync wraps arguments - extract them
  const args = 'arguments' in event ? event.arguments : event;

  try {
    console.log('Processing annotation request for imageId:', args.imageId);

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
      console.log('Using single question mode, question:', question);
    } else {
      // Multi-question mode - generate multiple Q&A pairs
      prompt = PROMPTS[language] || PROMPTS['en'];
    }

    // Call Bedrock Converse API
    console.log('Calling Bedrock model:', modelId);
    console.log('Prompt preview:', prompt.substring(0, 200) + '...');
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

    console.log('Token usage:', response.usage);

    if (!responseText || responseText.trim().length === 0) {
      return {
        success: false,
        imageId,
        modelVersion: modelId,
        error: 'No text extracted from image',
      };
    }

    // Clean up the response text (remove any JSON artifacts if present)
    let cleanText = responseText.trim();
    
    // Remove common JSON wrapper patterns if model still returns them
    cleanText = cleanText.replace(/^["']|["']$/g, ''); // Remove quotes
    cleanText = cleanText.replace(/^.*"answer":\s*["']([^"']+)["'].*$/s, '$1'); // Extract from JSON if present
    // Trim spaces on each line, preserve newlines
    cleanText = cleanText.split('\n').map(line => line.trim()).join('\n').trim();

    // For single question mode, construct the JSON response here
    if (question) {
      const annotations: AnnotationResult[] = [{
        question: question,
        answer: cleanText,
        boundingBox: [0, 0, width, height], // Use full image as bounding box
        confidence: 0.9, // High confidence since we're just doing OCR
      }];

      return {
        success: true,
        imageId,
        annotations,
        modelVersion: modelId,
      };
    }

    // Multi-question mode (not used for mobile read button, but keep for completeness)
    return {
      success: false,
      imageId,
      modelVersion: modelId,
      error: 'Multi-question mode not implemented for text extraction',
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
