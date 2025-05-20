# Yoola Documentation

## Overview

Yoola is a browser extension that summarizes Terms of Service and User Agreements, making them more accessible to users. This document explains how the system works, data formats, and processes.

## System Architecture

The Yoola system consists of two main components:

1. **Browser Extension**: Frontend interface for users to request and view summaries
2. **API Server**: Backend that stores and retrieves summaries from MongoDB

## Data Flow

1. When a user visits a website with ToS/User Agreement, the extension detects it.
2. The extension reads the terms text content in the background.
3. Extension sends to the API server:
   - Current page URL
   - Terms page URL
   - Text content of the terms page
4. API searches MongoDB for existing summaries matching the text content.
5. If a summary is found, it's returned to the extension for display.
6. If no summary exists, the user can:
   - Request an LLM-compatible template to create their own summary
   - Submit their created summary back to the server for storage
   - Share their summary with other users

## Database Structure

MongoDB is used to store summaries with the following collection:

### `summaries` Collection

Document structure:
```json
{
  "_id": "ObjectId",
  "domain": "example.com",
  "url": "https://example.com/terms",
  "textFingerprint": "md5hash_of_terms_text",   // Hash of the terms text for efficient matching
  "createdAt": "2025-05-20T08:15:30.123Z",
  "isReviewed": false,
  "keyPoints": [
    "You grant the company a worldwide license to use your content",
    "Your account can be terminated at any time without notice"
  ],
  "dataCollection": "Text describing data collection practices...",
  "userRights": "Text describing user rights...",
  "alerts": [
    "Mandatory arbitration clause limits your right to sue in court"
  ],
  "textSnippet": "First 200 characters of terms for verification..."
}
```

## API Endpoints

### GET `/health`
Health check endpoint. Returns API status and version.

### POST `/summary`
Get a summary for the terms text content.

Request body:
```json
{
  "domain": "example.com",
  "url": "https://example.com/terms",
  "content": "Full text of the terms/user agreement..."
}
```

Returns a `SummaryResponse` object if found, or a 404 status if no matching summary exists.

### GET `/summary/template`
Get a template for creating a new summary formatted for LLM input.

Query parameters:
- `domain`: Website domain (e.g. "example.com")
- `url`: Full URL of the terms page

Returns a template with example values and LLM-compatible structure.

### POST `/summary/create`
Create a new user-provided summary.

Request body:
```json
{
  "domain": "example.com",
  "url": "https://example.com/terms",
  "content": "Full text of the terms/user agreement...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "dataCollection": "Details about data collection...",
  "userRights": "Details about user rights...",
  "alerts": ["Alert 1", "Alert 2"]
}
```

Returns the created summary as a `SummaryResponse` object.

### GET `/summary/llm-format`
Get an LLM-compatible JSON schema for processing terms content.

Returns a JSON schema that can be used to format LLM requests for summarizing terms.

## Data Models

### SummaryRequest
```
domain: str           # Website domain
url: str              # URL of the terms page
content: str          # Full text content of the terms/agreement
```

### SummaryResponse
```
createdAt: str        # ISO timestamp
isReviewed: bool      # Whether the summary is reviewed/verified 
keyPoints: List[str]  # Key points from the agreement
dataCollection: str   # Data collection practices
userRights: str       # User rights details
alerts: List[str]     # Important alerts/warnings
originalUrl: str      # Original URL of the terms
```

### CreateSummaryRequest
```
domain: str           # Website domain
url: str              # URL of the terms page
content: str          # Full text content of the terms/agreement
keyPoints: List[str]  # Key points from the agreement
dataCollection: str   # Data collection practices
userRights: str       # User rights details
alerts: List[str]     # Important alerts/warnings
isReviewed: bool      # Default is false for user-created summaries
```

### LLMTemplateResponse
```
schema: Dict          # JSON schema for LLM processing
examples: List[Dict]  # Example inputs and outputs for LLM formatting
prompt: str           # Suggested prompt for the LLM
```

## Running the Server

Start the server with:

```bash
cd server
python3 main.py
```

The API will run at http://127.0.0.1:8000, and API documentation will be available at http://127.0.0.1:8000/docs.

## Environment Variables

- `MONGO_URI`: MongoDB connection string (default: "mongodb://localhost:27017")
- `MONGO_DB_NAME`: MongoDB database name (default: "yoola_db")

---

*Note: This document should be updated whenever changes are made to the system architecture, data models, or processes.*
