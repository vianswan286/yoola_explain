# Yoola - AI-Powered Terms of Service Summarizer

A browser extension that simplifies user agreements and terms of service by providing easy-to-understand, AI-generated summaries.

## How it Works

1.  **Extraction**: The Yoola browser extension detects and extracts the text content of a Terms of Service page a user is visiting.
2.  **API Request**: The extension sends the extracted text, the website's domain, the specific URL, and the user's desired language to the Yoola API server.
3.  **Cache Check**: The API server first checks its SQLite database for an existing summary matching the content (via MD5 hash) and the requested language.
4.  **AI Generation**: If no suitable summary is found in the cache:
    *   The server sends the ToS content to the OpenRouter API (utilizing a Large Language Model like Llama by default).
    *   The LLM generates a structured summary in the requested language.
5.  **Response & Caching**: The newly generated summary is returned to the browser extension and also saved to the SQLite database for future requests.
6.  **Display**: The browser extension displays the summary to the user.

## Technical Stack

-   **Backend**: Python (FastAPI)
-   **AI Summarization**: OpenRouter API (configurable LLM, e.g., Meta Llama series)
-   **Database**: SQLite (for caching summaries)
-   **Text Fingerprinting**: MD5 hash of content for cache lookups
-   **Frontend**: JavaScript (Browser Extension - details TBD)

## Features

-   **AI-Powered Summarization**: Leverages LLMs via OpenRouter for generating summaries.
-   **Multi-Language Support**: Capable of generating summaries in various languages, dependent on the underlying LLM's capabilities.
-   **Caching**: Stores generated summaries in an SQLite database to provide instant responses for previously summarized content and languages.
-   **Content-Based Retrieval**: Uses MD5 hashing of ToS text to identify and retrieve cached summaries.

## API Endpoint

The primary API endpoint for fetching summaries is:

### `GET /get_summary`

-   **Description**: Retrieves an existing summary from the cache or generates a new one using an LLM.
-   **Query Parameters**:
    -   `content` (string, required): The full text of the Terms of Service.
    -   `domain` (string, required): The domain of the website (e.g., `example.com`).
    -   `url` (string, required): The full URL of the Terms of Service page.
    -   `language` (string, required): The desired language code for the summary (e.g., `en`, `es`, `ru`).
-   **Success Response (200 OK)**:
    -   Returns a JSON object containing the summary. If generation fails and no cached version exists, it may return `null` or an appropriate error structure (currently `null`).
-   **JSON Response Structure**:

    ```json
    {
      "language_code": "string",
      "key_points": [
        "string",
        "string"
      ],
      "data_collection_summary": "string",
      "user_rights_summary": "string",
      "alerts_and_warnings": [
        "string",
        "string"
      ]
    }
    ```

## Supported Languages

Yoola leverages the configured OpenRouter LLM for summarization and can support a wide array of languages. The server's `/get_summary` API endpoint expects the full language name as the `language` parameter (e.g., "Spanish", "Mandarin Chinese"). The browser extension will allow users to select from languages such as those defined in the system (codes are provided for reference, e.g., for flag icons or internal mapping):

-   **Mandarin Chinese** (API value: `"Mandarin Chinese"`, code: `cn`)
-   **Spanish** (API value: `"Spanish"`, code: `es`)
-   **English** (API value: `"English"`, code: `gb` / `en`)
-   **Hindi** (API value: `"Hindi"`, code: `in`)
-   **Bengali** (API value: `"Bengali"`, code: `bd`)
-   **Portuguese** (API value: `"Portuguese"`, code: `pt`)
-   **Russian** (API value: `"Russian"`, code: `ru`)
-   **Japanese** (API value: `"Japanese"`, code: `jp`)
-   **Western Punjabi** (API value: `"Western Punjabi"`, code: `pk`)
-   **Marathi** (API value: `"Marathi"`, code: `in`)
-   **Telugu** (API value: `"Telugu"`, code: `in`)
-   **Turkish** (API value: `"Turkish"`, code: `tr`)
-   **Wu Chinese** (API value: `"Wu Chinese"`, code: `cn` - Note: LLM support for differentiation from Mandarin may vary)
-   **Korean** (API value: `"Korean"`, code: `kr`)
-   **French** (API value: `"French"`, code: `fr`)
-   **Vietnamese** (API value: `"Vietnamese"`, code: `vn`)
-   **German** (API value: `"German"`, code: `de`)
-   **Urdu** (API value: `"Urdu"`, code: `pk`)
-   **Javanese** (API value: `"Javanese"`, code: `id`)
-   **Italian** (API value: `"Italian"`, code: `it`)

The exact list available in the extension can be configured. The success of summarization and the quality of the summary depend on the LLM's proficiency in the requested language. The extension will aim to default to the user's system language and allow them to change and save their preference.

## Setup and Installation (Server)

1.  **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd yoola
    ```

2.  **Navigate to Server Directory**:
    ```bash
    cd server
    ```

3.  **Create Virtual Environment & Install Dependencies**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

4.  **Set Up Database**:
    *   Ensure SQLite3 is installed on your system.
    *   From the `server` directory, initialize the database schema:
        ```bash
        sqlite3 database/yoola.db < database/ddl.sql
        ```
        This will create `yoola.db` in the `server/database/` directory.

5.  **Environment Variables**:
    *   Create a `.env` file in the `server` directory (`server/.env`).
    *   Add your OpenRouter API key:
        ```env
        OPENROUTER_API_KEY="sk-or-v1-YOUR_OPENROUTER_API_KEY"
        ```
    *   Optional: You can also set `YOOLA_REFERER_URL` (your site URL) and `YOOLA_APP_NAME` (your app's name) in the `.env` file if needed by OpenRouter or for your records:
        ```env
        YOOLA_REFERER_URL="https://your-yoola-instance.com"
        YOOLA_APP_NAME="Yoola ToS Summarizer"
        ```

## Running the Server

1.  Ensure your virtual environment is activated and you are in the `server` directory.
2.  Start the FastAPI application using Uvicorn:
    ```bash
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
    ```
    The server will be accessible at `http://127.0.0.1:8000`.

## Project Structure (Server-Side)

```
/yoola
|-- server/
|   |-- database/
|   |   |-- ddl.sql         # SQLite database schema
|   |   |-- db.py           # Database interaction logic
|   |   |-- yoola.db        # SQLite database file (created after setup)
|   |-- .env              # Environment variables (OPENROUTER_API_KEY, etc.) - create this
|   |-- main.py           # FastAPI application, API endpoints
|   |-- openrouter_api.py # Logic for interacting with OpenRouter LLM
|   |-- requirements.txt  # Python dependencies
|   |-- __init__.py
|-- tests/
|   |-- test_api_summary.py # API test script
|-- README.md             # This file
|-- .gitignore
```

## Browser Extension

(Details for the browser extension setup and usage will be added here once the extension is developed/updated to work with the current server API.)

## Future Plans

-   Develop/update the browser extension to seamlessly integrate with the `GET /get_summary` endpoint.
-   Implement more robust error handling and user feedback in the API and extension.
-   Allow users to select preferred LLM models via the extension/API.
-   Explore options for user contributions or corrections to AI-generated summaries.
-   Enhance UI/UX of the browser extension.
