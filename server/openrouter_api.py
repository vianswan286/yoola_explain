"""
OpenRouter API utility module for Yoola
Handles interactions with the OpenRouter API for summarizing terms of service
"""
import os
import requests
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get API key from environment
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
BASE_URL = "https://openrouter.ai/api/v1"
MAX_RETRIES = 1 # Total attempts = 1 (initial) + MAX_RETRIES (so 2 attempts total)

def get_headers() -> Dict[str, str]:
    """Get headers for API requests"""
    if not OPENROUTER_API_KEY:
        # Log warning but allow function to proceed; error will be caught by summarize_terms
        logger.warning("OpenRouter API key not found. Set OPENROUTER_API_KEY in .env file.")
    
    return {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("YOOLA_REFERER_URL", "https://yoola.example.com"), # Site URL sending request
        "X-Title": os.getenv("YOOLA_APP_NAME", "Yoola ToS Summarizer") # Your app's name
    }

def _is_valid_summary_format(summary_data: Any, requested_language: str) -> bool:
    """
    Validates the structure and content of the summary data.
    """
    if not isinstance(summary_data, dict):
        logger.warning(f"Validation failed: summary_data is not a dict. Type: {type(summary_data)}")
        return False

    required_keys = {
        "language_code": str,
        "key_points": list,
        "data_collection_summary": str,
        "user_rights_summary": str,
        "alerts_and_warnings": list
    }

    for key, expected_type in required_keys.items():
        if key not in summary_data:
            logger.warning(f"Validation failed: Missing key '{key}' in summary_data.")
            return False
        if not isinstance(summary_data[key], expected_type):
            logger.warning(f"Validation failed: Key '{key}' has incorrect type. Expected {expected_type}, got {type(summary_data[key])}.")
            return False

    if summary_data["language_code"] != requested_language:
        logger.warning(f"Validation failed: language_code mismatch. Expected '{requested_language}', got '{summary_data['language_code']}'.")
        return False

    if not all(isinstance(item, str) for item in summary_data["key_points"]):
        logger.warning("Validation failed: Not all items in 'key_points' are strings.")
        return False
    
    if not summary_data["key_points"]: # Ensure key_points is not empty
        logger.warning("Validation failed: 'key_points' list is empty.")
        return False

    if not all(isinstance(item, str) for item in summary_data["alerts_and_warnings"]):
        logger.warning("Validation failed: Not all items in 'alerts_and_warnings' are strings.")
        return False
    # alerts_and_warnings can be an empty list if no critical warnings are found.

    return True


def summarize_terms(content: str, domain: str, url: str, language: str = "en", model: str = "meta-llama/llama-4-maverick") -> Optional[Dict[str, Any]]:
    """
    Summarize terms of service using OpenRouter API.
    Attempts to generate and validate the summary, with one retry on failure.
    
    Args:
        content: The terms of service text content.
        domain: The website domain.
        url: The URL of the terms page.
        language: The language code for the summary (default: "en").
        model: Model ID to use.
    
    Returns:
        A dictionary containing the structured summary data if successful, None otherwise.
    """
    if not OPENROUTER_API_KEY:
        logger.error("OpenRouter API key is required but not found. Cannot proceed with summarization.")
        return None 
    
    # Truncate content if too large. Llama 3 8B has 8k context.
    # A character is roughly 0.25-1 token. Aim for ~6000 tokens for content.
    # Max chars = 6000 * 4 = 24000 (conservative) to leave space for prompt.
    max_chars = 24000 
    if len(content) > max_chars:
        content_to_send = content[:max_chars] + "..."
        logger.warning(f"Content truncated from {len(content)} to {len(content_to_send)} characters for model {model}")
    else:
        content_to_send = content
    
    prompt = f"""
You are an expert legal analyst AI specializing in Terms of Service (ToS). Your task is to provide a clear, concise, and accurate summary of the provided ToS for the Yoola browser extension.
The summary MUST be in {language.upper()}. All textual content in your JSON response must be in {language.upper()}.

Please analyze the following Terms of Service from {domain} (URL: {url}).

First, provide your internal, unstructured thoughts and analysis in a preliminary section. This helps ensure comprehensive understanding.
Then, based on your analysis, generate a structured JSON object.

The final output from you MUST BE ONLY THE JSON OBJECT, formatted exactly as follows:

{{
  "unstructured_thoughts_for_internal_review_only": "Place your detailed, free-form analysis here. Consider the implications for users, potential ambiguities, and any noteworthy clauses. This section will be ignored by the parser but helps your reasoning.",
  "structured_summary": {{
    "language_code": "{language}",
    "key_points": [
      "A list of 5-7 crucial bullet points. Each point should be a complete sentence and easy to understand.",
      "Focus on what the user is agreeing to, their obligations, and significant company rights."
    ],
    "data_collection_summary": "A detailed paragraph explaining what user data is collected, how it's used, and if it's shared. Be specific if possible.",
    "user_rights_summary": "A detailed paragraph outlining the user's rights according to the ToS. Include rights to their data, content, account termination, and dispute resolution.",
    "alerts_and_warnings": [
      "A list of 2-3 critical alerts or warnings. Highlight potentially problematic clauses, significant limitations of liability, or unusual terms that users MUST be aware of."
    ]
  }}
}}

Terms of Service to analyze:
---
{content_to_send}
---

Remember: Respond ONLY with the valid JSON object described above. No introductory text, no explanations outside the JSON structure.
The "language_code" field in "structured_summary" MUST exactly match "{language}".
All string values within "structured_summary" (key_points, summaries, alerts) MUST be in {language.upper()}.
"""
    
    system_message = f"You are a meticulous legal expert AI. You always output valid JSON as per instructions. The summary must be in {language.upper()}."

    for attempt in range(MAX_RETRIES + 1): # MAX_RETRIES = 1 means 2 attempts (0, 1)
        logger.info(f"Attempt {attempt + 1} of {MAX_RETRIES + 1} to summarize ToS for {url} in {language} using model {model}")
        try:
            response = requests.post(
                f"{BASE_URL}/chat/completions",
                headers=get_headers(),
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2, # Lower temperature for more deterministic and precise output
                    "max_tokens": 2500 # Max tokens for the summary itself
                },
                timeout=90 # Increased timeout for potentially long ToS processing by LLM
            )
            
            response.raise_for_status()
            raw_response_content = response.text
            
            try:
                full_json_response = json.loads(raw_response_content)
            except json.JSONDecodeError as e:
                logger.error(f"Attempt {attempt + 1}: Failed to parse the main JSON response from OpenRouter. Error: {e}. Response text (first 500 chars): {raw_response_content[:500]}")
                if attempt < MAX_RETRIES:
                    logger.info("Retrying...")
                    continue
                return None

            try:
                llm_message_content_str = full_json_response.get("choices", [{}])[0].get("message", {}).get("content")
                if not llm_message_content_str:
                    logger.error(f"Attempt {attempt + 1}: 'content' field is missing or empty in LLM's message. Full response: {json.dumps(full_json_response)}")
                    if attempt < MAX_RETRIES:
                        logger.info("Retrying...")
                        continue
                    return None
            except (IndexError, AttributeError, TypeError) as e:
                logger.error(f"Attempt {attempt + 1}: Error extracting LLM message content. Error: {e}. Full response: {json.dumps(full_json_response)}")
                if attempt < MAX_RETRIES:
                    logger.info("Retrying...")
                    continue
                return None

            try:
                parsed_llm_content = json.loads(llm_message_content_str)
                summary_data = parsed_llm_content.get("structured_summary")
                if not summary_data:
                    logger.error(f"Attempt {attempt + 1}: 'structured_summary' key missing in LLM's JSON content. LLM content (first 500 chars): {llm_message_content_str[:500]}")
                    if attempt < MAX_RETRIES:
                        logger.info("Retrying...")
                        continue
                    return None
            except json.JSONDecodeError as e:
                logger.error(f"Attempt {attempt + 1}: Failed to parse LLM's message content as JSON. Error: {e}. LLM content (first 500 chars): {llm_message_content_str[:500]}")
                if attempt < MAX_RETRIES:
                    logger.info("Retrying...")
                    continue
                return None
            
            if _is_valid_summary_format(summary_data, language):
                logger.info(f"Successfully summarized and validated ToS for {url} in {language} on attempt {attempt + 1}.")
                return summary_data
            else:
                logger.warning(f"Attempt {attempt + 1}: Summary validation failed. Summary data: {json.dumps(summary_data)}")
                if attempt < MAX_RETRIES:
                    logger.info("Retrying due to validation failure...")
                    continue
                logger.error("Validation failed after all retries.")
                return None

        except requests.exceptions.Timeout:
            logger.error(f"Attempt {attempt + 1}: OpenRouter API request timed out after 90 seconds.")
            if attempt < MAX_RETRIES:
                logger.info("Retrying API request after timeout...")
                continue
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Attempt {attempt + 1}: OpenRouter API request failed: {e}")
            if attempt < MAX_RETRIES:
                logger.info("Retrying API request...")
                continue
            return None
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}: An unexpected error occurred: {e}", exc_info=True)
            if attempt < MAX_RETRIES:
                logger.info("Retrying due to unexpected error...")
                continue
            return None
                
    logger.error(f"Exhausted all {MAX_RETRIES + 1} retries for {url} in {language}. Returning None.")
    return None

def get_available_models() -> List[Dict[str, Any]]:
    """
    Get available models from OpenRouter API
    
    Returns:
        List of available models
    """
    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not found. Set OPENROUTER_API_KEY in .env file.")
        return []
    
    try:
        response = requests.get(
            f"{BASE_URL}/models", 
            headers=get_headers(),
            timeout=15 # Timeout for fetching models
        )
        response.raise_for_status()
        return response.json().get("data", [])
    except requests.RequestException as e:
        logger.error(f"Failed to get OpenRouter models: {e}")
        return []

# Example usage (for testing this module directly)
if __name__ == '__main__':
    # Ensure OPENROUTER_API_KEY is set in your .env file or environment
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY is not set. Please set it in your .env file or environment variables to run this example.")
    else:
        print(f"Using OpenRouter API Key: ...{OPENROUTER_API_KEY[-4:]}") # Print last 4 chars for confirmation
        sample_tos = """
        TERMS OF SERVICE FOR EXAMPLE COMPANY

        Last Updated: May 28, 2025

        1. ACCEPTANCE OF TERMS
        By accessing or using Example Company's website, mobile applications, products, or services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Services.

        2. DATA COLLECTION
        We collect your name, email, and usage data. This data is used to improve our services and for marketing. We may share this data with third-party partners. By using our services, you consent to this.

        3. USER RIGHTS
        You have the right to access your data and request deletion. You own your content but grant us a license to use it.

        4. CRITICAL WARNING
        Our liability is severely limited. We are not responsible for any damages. All disputes must be arbitrated in Narnia.
        """
        
        print("\nRequesting English Summary...")
        summary_en = summarize_terms(sample_tos, "example.com", "http://example.com/tos", "en")
        if summary_en:
            print("\n--- English Summary (structured_summary) ---")
            print(json.dumps(summary_en, indent=2, ensure_ascii=False))
        else:
            print("\nFailed to get English summary after retries.")

        print("\nRequesting Spanish Summary...")
        summary_es = summarize_terms(sample_tos, "example.com", "http://example.com/tos", "es")
        if summary_es:
            print("\n--- Spanish Summary (structured_summary) ---")
            print(json.dumps(summary_es, indent=2, ensure_ascii=False))
        else:
            print("\nFailed to get Spanish summary after retries.")
