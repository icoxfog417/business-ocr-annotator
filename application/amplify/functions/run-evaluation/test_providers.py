"""
Unit Tests for Provider Adapters

Tests dispatch logic, mock SDK clients, and error handling.

Run with: pytest test_providers.py -v
"""
import pytest
from unittest.mock import patch, MagicMock

import providers


@pytest.fixture(autouse=True)
def reset_clients():
    """Reset lazy-initialized clients between tests."""
    providers._bedrock_client = None
    providers._gemini_client = None
    providers._openai_client = None
    yield
    providers._bedrock_client = None
    providers._gemini_client = None
    providers._openai_client = None


# =============================================================================
# Dispatch: unknown provider raises ValueError
# =============================================================================

def test_unknown_provider_raises():
    with pytest.raises(ValueError, match='Unknown provider: foobar'):
        providers.invoke_provider('foobar', 'model-id', b'\xff', 'prompt')


# =============================================================================
# Bedrock provider
# =============================================================================

@patch('providers._get_bedrock_client')
def test_bedrock_dispatch(mock_get_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = {
        'output': {
            'message': {
                'content': [{'text': '{"answer": "hello", "bbox": [0,0,1,1]}'}]
            }
        }
    }
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider('bedrock', 'amazon.nova-pro-v1:0', b'\xff', 'prompt')
    assert result == '{"answer": "hello", "bbox": [0,0,1,1]}'

    mock_client.converse.assert_called_once()
    call_kwargs = mock_client.converse.call_args
    assert call_kwargs.kwargs['modelId'] == 'amazon.nova-pro-v1:0'


@patch('providers._get_bedrock_client')
def test_bedrock_empty_response(mock_get_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = {'output': {'message': {'content': []}}}
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider('bedrock', 'model-id', b'\xff', 'prompt')
    assert result == ''


# =============================================================================
# Gemini provider
# =============================================================================

def test_gemini_missing_api_key():
    with pytest.raises(RuntimeError, match='Gemini API key not configured'):
        providers.invoke_provider('gemini', 'gemini-3-flash-preview', b'\xff', 'prompt', '')


@patch('providers._get_gemini_client')
def test_gemini_dispatch(mock_get_client):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"answer": "test", "bbox": [0.1,0.2,0.3,0.4]}'
    mock_client.models.generate_content.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider(
        'gemini', 'gemini-3-flash-preview', b'\xff', 'prompt', 'fake-key'
    )
    assert result == '{"answer": "test", "bbox": [0.1,0.2,0.3,0.4]}'
    mock_client.models.generate_content.assert_called_once()


@patch('providers._get_gemini_client')
def test_gemini_none_text(mock_get_client):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = None
    mock_client.models.generate_content.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider(
        'gemini', 'gemini-2.5-pro', b'\xff', 'prompt', 'fake-key'
    )
    assert result == ''


# =============================================================================
# OpenAI provider
# =============================================================================

def test_openai_missing_api_key():
    with pytest.raises(RuntimeError, match='OpenAI API key not configured'):
        providers.invoke_provider('openai', 'gpt-5', b'\xff', 'prompt', '')


@patch('providers._get_openai_client')
def test_openai_dispatch(mock_get_client):
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"answer": "world", "bbox": [0,0,0.5,0.5]}'
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider(
        'openai', 'gpt-5', b'\xff', 'prompt', 'fake-key'
    )
    assert result == '{"answer": "world", "bbox": [0,0,0.5,0.5]}'
    mock_client.chat.completions.create.assert_called_once()


@patch('providers._get_openai_client')
def test_openai_none_content(mock_get_client):
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = None
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = providers.invoke_provider(
        'openai', 'gpt-4.1', b'\xff', 'prompt', 'fake-key'
    )
    assert result == ''


@patch('providers._get_openai_client')
def test_openai_base64_encoding(mock_get_client):
    """Verify image bytes are base64-encoded in the API call."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = 'test'
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response
    mock_get_client.return_value = mock_client

    providers.invoke_provider('openai', 'gpt-5', b'\x00\x01\x02', 'prompt', 'key')

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    messages = call_kwargs['messages']
    image_content = messages[0]['content'][1]
    assert image_content['type'] == 'image_url'
    assert image_content['image_url']['url'].startswith('data:image/jpeg;base64,')


# =============================================================================
# Bedrock does not require API key
# =============================================================================

@patch('providers._get_bedrock_client')
def test_bedrock_no_api_key_needed(mock_get_client):
    mock_client = MagicMock()
    mock_client.converse.return_value = {
        'output': {'message': {'content': [{'text': 'ok'}]}}
    }
    mock_get_client.return_value = mock_client

    # Should succeed without api_key
    result = providers.invoke_provider('bedrock', 'model-id', b'\xff', 'prompt')
    assert result == 'ok'
