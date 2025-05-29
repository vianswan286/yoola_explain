# Yoola Server Deployment Guide

This guide explains how to deploy the Yoola server using Docker.

## Environment Variables

Create a `.env` file in the server directory with the following variables:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
YOOLA_REFERER_URL=https://your-domain.com
YOOLA_APP_NAME=Yoola ToS Summarizer
```

## Docker Deployment

1. Make sure Docker and Docker Compose are installed on your server.
2. Navigate to the root directory of the project (where the docker-compose.yml file is located).
3. Run the following command to start the server:

```bash
docker-compose up -d
```

This will start the Yoola server in detached mode, and it will be accessible at `http://your-server-ip:8000`.

## Updating the Extension

After deploying the server, you'll need to update the API URL in your browser extension options to point to your server:

1. Right-click on the Yoola extension icon
2. Select "Options"
3. Update the API URL to: `http://your-server-ip:8000`
4. Click Save

## Database

The server uses SQLite by default for caching summaries. The database file is created automatically in the server directory.

If you need to use a different database system, modify the `database/db.py` file accordingly.

## Troubleshooting

If you encounter any issues with the server:

1. Check the Docker logs:
```bash
docker-compose logs yoola-server
```

2. Ensure that the required environment variables are set correctly in the `.env` file.

3. If needed, you can rebuild the Docker container:
```bash
docker-compose build yoola-server
docker-compose up -d
```
