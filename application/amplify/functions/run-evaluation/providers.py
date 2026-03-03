"""
Provider adapters for model invocation.

Dispatches to Bedrock, Gemini, or OpenAI based on the provider field.
Each provider function returns raw response text; parsing stays in handler.py.

SDK clients are lazily initialized once per Lambda container.
"""
import base64
import boto3

# Lazy-initialized SDK clients (one per Lambda container)
_bedrock_client = None
_gemini_client = None
_openai_client = None


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client('bedrock-runtime')
    return _bedrock_client


def _get_gemini_client(api_key: str):
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def _get_openai_client(api_key: str):
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def invoke_provider(
    provider: str,
    provider_model_id: str,
    img_bytes: bytes,
    prompt: str,
    api_key: str = '',
) -> str:
    """Dispatch model invocation to the appropriate provider.

    Args:
        provider: One of 'bedrock', 'gemini', 'openai'.
        provider_model_id: Model ID specific to the provider.
        img_bytes: JPEG image bytes.
        prompt: Text prompt to send with the image.
        api_key: API key for non-Bedrock providers.

    Returns:
        Raw response text from the model.

    Raises:
        ValueError: If provider is unknown.
        RuntimeError: If API key is missing for non-Bedrock providers.
    """
    if provider == 'bedrock':
        return _invoke_bedrock(provider_model_id, img_bytes, prompt)
    elif provider == 'gemini':
        if not api_key:
            raise RuntimeError(
                'Gemini API key not configured. '
                'Create SSM parameter /business-ocr/gemini-api-key with your API key.'
            )
        return _invoke_gemini(provider_model_id, img_bytes, prompt, api_key)
    elif provider == 'openai':
        if not api_key:
            raise RuntimeError(
                'OpenAI API key not configured. '
                'Create SSM parameter /business-ocr/openai-api-key with your API key.'
            )
        return _invoke_openai(provider_model_id, img_bytes, prompt, api_key)
    else:
        raise ValueError(f'Unknown provider: {provider}')


def _invoke_bedrock(model_id: str, img_bytes: bytes, prompt: str) -> str:
    """Invoke model via AWS Bedrock converse API."""
    client = _get_bedrock_client()
    response = client.converse(
        modelId=model_id,
        messages=[
            {
                'role': 'user',
                'content': [
                    {'text': prompt},
                    {
                        'image': {
                            'format': 'jpeg',
                            'source': {'bytes': img_bytes},
                        },
                    },
                ],
            },
        ],
        inferenceConfig={
            'temperature': 0.1,
            'maxTokens': 500,
        },
    )
    content = response.get('output', {}).get('message', {}).get('content', [])
    return content[0].get('text', '') if content else ''


def _invoke_gemini(model_id: str, img_bytes: bytes, prompt: str, api_key: str) -> str:
    """Invoke model via Google Gemini API using google-genai SDK."""
    from google.genai import types

    client = _get_gemini_client(api_key)
    response = client.models.generate_content(
        model=model_id,
        contents=[
            types.Content(
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=img_bytes, mime_type='image/jpeg'),
                ],
            ),
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=500,
        ),
    )
    return response.text or ''


def _invoke_openai(model_id: str, img_bytes: bytes, prompt: str, api_key: str) -> str:
    """Invoke model via OpenAI API."""
    client = _get_openai_client(api_key)
    b64_image = base64.b64encode(img_bytes).decode('utf-8')
    response = client.chat.completions.create(
        model=model_id,
        messages=[
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': f'data:image/jpeg;base64,{b64_image}',
                        },
                    },
                ],
            },
        ],
        temperature=0.1,
        max_tokens=500,
    )
    return response.choices[0].message.content or ''
