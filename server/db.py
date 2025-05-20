"""
Database module for Yoola API
Handles storage and retrieval of summaries using MongoDB or in-memory fallback
Implements text-based matching for finding summaries
"""
import os
import logging
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime

# In-memory storage for summaries when MongoDB isn't available
in_memory_summaries = []

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# For simplicity, we're using in-memory storage by default
mongodb_available = False
logger.info("Using in-memory storage for summaries")

# Create text fingerprint (hash) from content
def create_text_fingerprint(content: str) -> str:
    """Create a fingerprint hash from text content for matching"""
    if not content:
        return ""
    # Normalize text: lowercase, remove extra whitespace
    normalized = " ".join(content.lower().split())
    # Create a hash of the first 5000 chars (to keep consistent across slight changes)
    fingerprint = hashlib.md5(normalized[:5000].encode('utf-8')).hexdigest()
    return fingerprint

# Get a representative snippet of text
def get_text_snippet(content: str, max_length: int = 200) -> str:
    """Extract a representative snippet from the beginning of the text"""
    if not content:
        return ""
    # Clean up whitespace and get the first part of the text
    normalized = " ".join(content.split())
    return normalized[:max_length]

# Setup function - simplified for in-memory storage
async def setup_indexes():
    """Prepare storage - no-op for in-memory storage"""
    logger.info("Using in-memory storage - no indexes needed")
    return

async def get_summary_by_text(content: str, domain: str = "", url: str = "") -> Optional[Dict[str, Any]]:
    """
    Find a summary by matching the text content fingerprint
    
    Args:
        content: The full text of the terms/agreement
        domain: Optional domain name for additional context
        url: Optional URL for additional context
        
    Returns:
        Summary document or None if not found
    """
    if not content:
        return None
        
    # Create a fingerprint from the text content
    fingerprint = create_text_fingerprint(content)
    
    if mongodb_available:
        try:
            # Try to find by fingerprint first (most accurate)
            result = await summaries.find_one({"textFingerprint": fingerprint})
            if result:
                return result
                
            # If not found and domain is provided, try domain + snippet matching
            if domain:
                # Extract a snippet for fuzzy matching with the domain
                snippet = get_text_snippet(content)
                domain_matches = summaries.find({"domain": domain})
                
                async for doc in domain_matches:
                    # If the snippet is similar to the stored snippet, it might be the same doc
                    if "textSnippet" in doc and doc["textSnippet"] and \
                       (doc["textSnippet"] in snippet or snippet in doc["textSnippet"]):
                        return doc
                        
            return None
            
        except Exception as e:
            logger.error(f"MongoDB query error: {e}")
            # Fall back to in-memory if MongoDB query fails
    
    # In-memory search if MongoDB isn't available or query failed
    for summary in in_memory_summaries:
        if summary.get("textFingerprint") == fingerprint:
            return summary
            
        # Try domain + snippet matching as a fallback
        if domain and domain == summary.get("domain"):
            snippet = get_text_snippet(content)
            stored_snippet = summary.get("textSnippet", "")
            if stored_snippet and (stored_snippet in snippet or snippet in stored_snippet):
                return summary
                
    return None

async def save_summary(summary_data: Dict[str, Any]) -> str:
    """
    Save a summary to the database
    
    Args:
        summary_data: Dictionary containing summary information with content
        
    Returns:
        ID of the inserted document or status message
    """
    # Ensure createdAt is set
    if "createdAt" not in summary_data:
        summary_data["createdAt"] = datetime.now().isoformat()
    
    # Get content and create fingerprint
    content = summary_data.get("content", "")
    if content:
        summary_data["textFingerprint"] = create_text_fingerprint(content)
        summary_data["textSnippet"] = get_text_snippet(content)
    
    if mongodb_available:
        try:
            # Check if we already have a summary with this fingerprint
            if "textFingerprint" in summary_data and summary_data["textFingerprint"]:
                existing = await summaries.find_one({"textFingerprint": summary_data["textFingerprint"]})
                if existing:
                    # Update existing summary
                    await summaries.replace_one(
                        {"textFingerprint": summary_data["textFingerprint"]},
                        summary_data,
                        upsert=True
                    )
                    return "updated"
            
            # Create new summary
            result = await summaries.insert_one(summary_data)
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"MongoDB save error: {e}")
            # Fall back to in-memory if MongoDB fails
    
    # In-memory storage if MongoDB isn't available or failed
    # Check if we already have this summary in memory
    fingerprint = summary_data.get("textFingerprint", "")
    if fingerprint:
        for i, summary in enumerate(in_memory_summaries):
            if summary.get("textFingerprint") == fingerprint:
                # Update existing summary
                in_memory_summaries[i] = summary_data
                return "updated"
    
    # Add ID for in-memory storage
    summary_data["_id"] = str(len(in_memory_summaries) + 1)
    in_memory_summaries.append(summary_data)
    return summary_data["_id"]

# User request-related functions removed - using simpler approach without LLM
