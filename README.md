# Yoola - User Agreement Summarizer

A browser extension that simplifies user agreements and terms of service by providing easy-to-understand summaries.

## How it Works

1. When a user visits a website with terms of service:
   - The extension detects and extracts the terms content from the webpage
   - The content is sent to our API server which checks for existing summaries using text fingerprinting
   - If a matching summary is found, it's displayed to the user
   - If no match is found, users can create and submit their own summaries

## Technical Stack

- Frontend: JavaScript (Browser Extension)
- Backend: Python (FastAPI)
- Database: MongoDB with in-memory fallback
- Text Matching: Fingerprinting using MD5 hash of normalized text

## Features

- Text-based summary matching using content fingerprinting
- MongoDB integration with graceful fallback to in-memory storage
- API endpoints for retrieving and creating summaries
- Template system for user-created summaries

## API Endpoints

- `POST /summary` - Find summary by text content
- `POST /summary/create` - Create a new user-provided summary
- `GET /summary/template` - Get template for summary creation
- `GET /summary/llm-format` - Get LLM-compatible format
- `GET /health` - Health check endpoint

## Future Plans

- Add AI integration for automatic summary generation
- Implement user ratings for summaries
- Create a community review system for better quality control
- Expand language support for international terms of service
- Develop enhanced text matching for better accuracy

## Project Structure
