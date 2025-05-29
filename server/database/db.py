"""
Database utility functions for Yoola
Provides simple functions to interact with the SQLite database for storing and retrieving summaries
based on the schema defined in ddl.sql
"""
import os
import json
import sqlite3
import hashlib
import logging
import time
from typing import Dict, Any, Optional, List

# Setup logging with more detail
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# SQLite database settings
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "yoola.db")

# Ensure the database directory exists
os.makedirs(DB_DIR, exist_ok=True)

logger.info(f"Database path set to: {DB_PATH}")

def get_db_connection():
    """
    Get a connection to the SQLite database
    
    Returns:
        SQLite connection object
    """
    try:
        # Ensure database schema exists
        if not os.path.exists(DB_PATH):
            logger.info(f"Database file does not exist at {DB_PATH}, initializing schema")
            initialize_database()
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

def initialize_database():
    """
    Initialize the database schema from ddl.sql if it doesn't exist
    """
    try:
        # Create a basic connection without row factory
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Read and execute the DDL script
        ddl_path = os.path.join(DB_DIR, "ddl.sql")
        logger.info(f"Initializing database from {ddl_path}")
        
        with open(ddl_path, 'r') as f:
            ddl_script = f.read()
        
        cursor.executescript(ddl_script)
        conn.commit()
        
        # Also initialize languages
        initialize_languages(conn)
        
        conn.close()
        logger.info("Database schema initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        if os.path.exists(DB_PATH):
            logger.warning(f"Removing potentially corrupted database file: {DB_PATH}")
            os.remove(DB_PATH)
        raise

def initialize_languages(conn):
    """
    Initialize the languages table with at least the supported languages
    """
    try:
        cursor = conn.cursor()
        
        # Add at least the basic languages we need
        languages = ["English", "Russian", "Spanish", "French", "German"]
        
        for lang in languages:
            cursor.execute(
                "INSERT OR IGNORE INTO languages(language) VALUES (?)",
                (lang,)
            )
        
        conn.commit()
        logger.info(f"Initialized {len(languages)} basic languages in the database")
    except Exception as e:
        logger.error(f"Failed to initialize languages: {e}")

def get_summary_by_content(content: str, language: str = "en") -> Optional[Dict[str, Any]]:
    """
    Retrieve a summary by content and language from the SQLite database
    
    Args:
        content: The text content to find a summary for
        language: The language code (default: "en")
        
    Returns:
        The summary data as a dict if found, None otherwise
    """
    start_time = time.time()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generate content hash for lookup
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        logger.info(f"Looking up summary for content hash: {content_hash}, language: {language}")
        
        # Query to find the summary by content hash and language
        query = """
        SELECT s.summary 
        FROM yoola_lang_summary s
        JOIN yoola y ON s.yoola_id = y.id
        WHERE y.content_hash = ? AND s.language = ?
        """
        
        result = cursor.execute(query, (content_hash, language)).fetchone()
        conn.close()
        
        if result:
            # Parse the JSON summary
            summary_data = json.loads(result[0])
            logger.info(f"Found existing summary for hash '{content_hash}' in language '{language}'")
            return summary_data
        else:
            logger.info(f"No summary found for hash '{content_hash}' in language '{language}'")
            return None
    except Exception as e:
        logger.error(f"Error retrieving summary from SQLite database: {e}", exc_info=True)
        return None
    finally:
        elapsed = time.time() - start_time
        logger.info(f"Summary lookup took {elapsed:.3f} seconds")

def add_or_update_summary(content: str, summary_data: Dict[str, Any], url: str = None, language: str = "en") -> bool:
    """
    Add or update a summary in the SQLite database
    
    Args:
        content: The text content the summary is for
        summary_data: The summary data to store (will be converted to JSON)
        url: The URL where the content was found (optional)
        language: The language code (default: "en")
        
    Returns:
        True if successful, False otherwise
    """
    start_time = time.time()
    try:
        logger.info(f"Adding/updating summary for content in language '{language}' with URL '{url}'")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First check if the language exists in the languages table
        lang_exists = cursor.execute(
            "SELECT 1 FROM languages WHERE language = ?", 
            (language,)
        ).fetchone()
        
        # If language doesn't exist, add it
        if not lang_exists:
            logger.info(f"Language '{language}' not found in database, adding it")
            cursor.execute(
                "INSERT INTO languages(language) VALUES (?)",
                (language,)
            )
            conn.commit()
        
        # Calculate content hash in Python
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        logger.info(f"Content hash: {content_hash}")
        
        # Check if content already exists
        yoola_id_result = cursor.execute("SELECT id FROM yoola WHERE content_hash = ?", (content_hash,)).fetchone()
        
        # If content doesn't exist, insert it into yoola table
        if not yoola_id_result:
            logger.info(f"Content with hash {content_hash} not found, inserting new record")
            cursor.execute(
                "INSERT INTO yoola (content, url, content_hash) VALUES (?, ?, ?)",
                (content, url, content_hash)
            )
            yoola_id = cursor.lastrowid
            logger.info(f"Inserted new content with ID: {yoola_id}")
        else:
            yoola_id = yoola_id_result[0]
            logger.info(f"Found existing content with ID: {yoola_id}")
            # Update URL if provided and different from current
            if url:
                cursor.execute("UPDATE yoola SET url = ? WHERE id = ? AND (url IS NULL OR url != ?)", 
                              (url, yoola_id, url))
        
        # Check if this language version already exists
        existing = cursor.execute(
            "SELECT 1 FROM yoola_lang_summary WHERE yoola_id = ? AND language = ?", 
            (yoola_id, language)
        ).fetchone()
        
        # Convert summary_data to JSON string
        summary_json = json.dumps(summary_data)
        
        # Insert or update the summary
        if existing:
            logger.info(f"Updating existing summary for content ID {yoola_id} in language '{language}'")
            # Update existing summary
            request_num_query = "SELECT request_num FROM yoola_lang_summary WHERE yoola_id = ? AND language = ?"
            current_request_num = cursor.execute(request_num_query, (yoola_id, language)).fetchone()[0]
            
            cursor.execute(
                "UPDATE yoola_lang_summary SET summary = ?, request_num = ? WHERE yoola_id = ? AND language = ?",
                (summary_json, current_request_num + 1, yoola_id, language)
            )
        else:
            logger.info(f"Creating new summary for content ID {yoola_id} in language '{language}'")
            # Insert new summary with request_num = 1
            cursor.execute(
                "INSERT INTO yoola_lang_summary (yoola_id, language, summary, request_num) VALUES (?, ?, ?, 1)",
                (yoola_id, language, summary_json)
            )
        
        conn.commit()
        logger.info(f"Successfully saved summary to database")
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error adding/updating summary in SQLite database: {e}", exc_info=True)
        if 'conn' in locals() and conn:
            conn.rollback()
            conn.close()
        return False
    finally:
        elapsed = time.time() - start_time
        logger.info(f"Summary save operation took {elapsed:.3f} seconds")
