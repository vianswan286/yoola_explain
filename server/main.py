from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import datetime
import os

# Import database module
import db

app = FastAPI(title="Yoola API", description="Yoola User Agreement Summarizer API with MongoDB storage")

# Enable CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request and response models
class SummaryRequest(BaseModel):
    domain: str
    url: str
    content: Optional[str] = None  # Full text content of the terms/agreement (optional)

class SummaryResponse(BaseModel):
    createdAt: str
    isReviewed: bool
    keyPoints: List[str]
    dataCollection: Optional[str] = None
    userRights: Optional[str] = None
    alerts: List[str] = []
    originalUrl: str

class CreateSummaryRequest(BaseModel):
    domain: str
    url: str
    content: str  # Full text content of the terms/agreement
    keyPoints: List[str]
    dataCollection: Optional[str] = None
    userRights: Optional[str] = None
    alerts: List[str] = []
    isReviewed: bool = False  # User-created summaries are marked unreviewed by default

class SummaryTemplate(BaseModel):
    """Template model for user to fill out when creating a summary"""
    domain: str
    url: str
    keyPoints: List[str] = [
        "Example: You grant the company a worldwide license to use your content",
        "Example: Your account can be terminated at any time without notice",
        ""  # Empty strings for user to fill
    ]
    dataCollection: str = "Describe what data is collected by the service"
    userRights: str = "Describe what rights the user has"
    alerts: List[str] = [
        "Example: Mandatory arbitration clause limits your right to sue",
        ""  # Empty string for user to fill
    ]

class LLMTemplateResponse(BaseModel):
    """Response model for LLM template format"""
    schema: Dict[str, Any]  # JSON schema for LLM processing
    examples: List[Dict[str, Any]]  # Example inputs and outputs
    prompt: str  # Suggested prompt for the LLM

# Startup event to initialize database indexes
@app.on_event("startup")
async def startup_event():
    await db.setup_indexes()

# Get summary by text content or fallback to example data
async def get_summary_by_text_content(domain: str, url: str, content: str) -> SummaryResponse:
    """
    Try to find summary by matching text content, with fallback to example.
    
    Args:
        domain: Website domain
        url: URL of the terms page
        content: Full text content of the terms
        
    Returns:
        SummaryResponse object with summary data
    """
    try:
        # Find by text content fingerprint
        summary = await db.get_summary_by_text(content, domain, url)
        
        # If found in database, return it
        if summary:
            return SummaryResponse(
                createdAt=summary.get("createdAt") or datetime.datetime.now().isoformat(),
                isReviewed=summary.get("isReviewed", False),
                keyPoints=summary.get("keyPoints", []),
                dataCollection=summary.get("dataCollection", ""),
                userRights=summary.get("userRights", ""),
                alerts=summary.get("alerts", []),
                originalUrl=summary.get("url") or url
            )
    except Exception as e:
        print(f"Error retrieving summary by text: {e}")
    
    # Return example summary as fallback
    return get_example_summary(domain, url)

# Example summary data for fallback/demo purposes
def get_example_summary(domain: str, url: str) -> SummaryResponse:
    # Check if it's a popular domain to demo the pre-approved vs AI generated
    is_reviewed = domain in ["facebook.com", "amazon.com", "google.com", "apple.com", "microsoft.com"]
    
    return SummaryResponse(
        createdAt=datetime.datetime.now().isoformat(),
        isReviewed=is_reviewed,
        keyPoints=[
            "You grant the company a worldwide license to use your content",
            "Your account can be terminated at any time without notice",
            "The service collects your personal information including location data",
            "Disputes are resolved through arbitration, not in court",
            "They can change the terms at any time with or without notice"
        ],
        dataCollection=(
            "The service collects your name, email, IP address, device information, "
            "and browsing patterns. This data may be shared with third-party advertisers "
            "and used for personalized marketing purposes."
        ),
        userRights=(
            "You have the right to access and delete your personal data. You can opt out "
            "of certain data collection practices, though this may limit functionality. "
            "You can close your account at any time, but some information may be retained."
        ),
        alerts=[
            "Mandatory arbitration clause limits your right to sue in court",
            "Broad content license allows company to use your uploads in marketing",
            "Automatic subscription renewal with at least 24 hours notice before charge"
        ],
        originalUrl=url
    )

@app.post('/summary', response_model=SummaryResponse)
async def get_summary(request: SummaryRequest):
    """Get a summary by matching the text content or fallback to example"""
    if request.content:
        # Try to find by text content if provided
        return await get_summary_by_text_content(request.domain, request.url, request.content)
    else:
        # Fallback directly to example summary if no content
        return get_example_summary(request.domain, request.url)

@app.post('/summary/create', response_model=SummaryResponse)
async def create_summary(request: CreateSummaryRequest):
    """Create a new user-provided summary"""
    if not request.content:
        raise HTTPException(status_code=400, detail="Text content is required")
        
    summary_data = {
        "domain": request.domain,
        "url": request.url,
        "content": request.content,  # Store the content for text matching
        "keyPoints": request.keyPoints,
        "dataCollection": request.dataCollection,
        "userRights": request.userRights,
        "alerts": request.alerts,
        "isReviewed": request.isReviewed,
        "createdAt": datetime.datetime.now().isoformat()
    }
    
    try:
        await db.save_summary(summary_data)
        return SummaryResponse(
            createdAt=summary_data["createdAt"],
            isReviewed=summary_data["isReviewed"],
            keyPoints=summary_data["keyPoints"],
            dataCollection=summary_data["dataCollection"],
            userRights=summary_data["userRights"],
            alerts=summary_data["alerts"],
            originalUrl=summary_data["url"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving summary: {str(e)}")

@app.get('/summary/template')
async def get_summary_template(domain: str, url: str):
    """Get a template for creating a summary"""
    return SummaryTemplate(
        domain=domain,
        url=url
    )

@app.get('/summary/llm-format')
async def get_llm_format():
    """Get the LLM-compatible format for processing terms content"""
    schema = {
        "type": "object",
        "properties": {
            "keyPoints": {
                "type": "array",
                "items": {"type": "string"},
                "description": "5-7 key points from the terms of service"
            },
            "dataCollection": {
                "type": "string",
                "description": "Summary of data collection practices"
            },
            "userRights": {
                "type": "string",
                "description": "Summary of user rights and options"
            },
            "alerts": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Important alerts or warnings users should be aware of"
            }
        }
    }
    
    examples = [
        {
            "input": "Terms excerpt about data collection...",
            "output": {
                "keyPoints": [
                    "You grant the company a worldwide license to use your content",
                    "Your account can be terminated at any time without notice"
                ],
                "dataCollection": "The service collects personal information including location data...",
                "userRights": "You have the right to access and delete your personal data...",
                "alerts": ["Mandatory arbitration clause limits your right to sue in court"]
            }
        }
    ]
    
    prompt = """Analyze the following Terms of Service and extract key information in JSON format.
    Include: key points (5-7), data collection practices, user rights, and important alerts.
    Format your response as valid JSON matching the provided schema."""
    
    return LLMTemplateResponse(
        schema=schema,
        examples=examples,
        prompt=prompt
    )

@app.get('/health')
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}

# Run the server directly with this file
if __name__ == "__main__":
    import uvicorn
    print("Starting Yoola API server at http://127.0.0.1:8000")
    print("API Documentation available at http://127.0.0.1:8000/docs")
    uvicorn.run(app, host="127.0.0.1", port=8000)
