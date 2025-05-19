# Yoola - User Agreement Summarizer

A browser extension that simplifies user agreements and terms of service by providing easy-to-understand summaries.

## How it Works

1. When a user visits a website with terms of service:
   - First checks our MongoDB database for an existing summary
   - If found, displays the pre-approved summary
   - If not found, generates a new summary using AI (GPT API)
   - For popular websites, summaries are manually reviewed for accuracy

## Technical Stack

- Frontend: JavaScript (Browser Extension)
- Backend: Python (FastAPI)
- Database: MongoDB
- AI: OpenAI GPT API

## Project Structure
