#!/usr/bin/env python3
"""
Download flag images for the top 20 most-spoken languages,
record each language’s primary country, and insert into yoola.db.
"""

import os
import sqlite3
import requests
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Use absolute path for database
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "yoola.db")

logger.info(f"Using database path: {DB_PATH}")

# For each language: (country_name, ISO3166-1 alpha-2 code for flagcdn)
LANG_META = {
    "Mandarin Chinese": ("China",           "cn"),
    "Spanish":          ("Spain",           "es"),
    "English":          ("United Kingdom",  "gb"),
    "Hindi":            ("India",           "in"),
    "Bengali":          ("Bangladesh",      "bd"),
    "Portuguese":       ("Portugal",        "pt"),
    "Russian":          ("Russia",          "ru"),
    "Japanese":         ("Japan",           "jp"),
    "Western Punjabi":  ("Pakistan",        "pk"),
    "Marathi":          ("India",           "in"),
    "Telugu":           ("India",           "in"),
    "Turkish":          ("Turkey",          "tr"),
    "Wu Chinese":       ("China",           "cn"),
    "Korean":           ("South Korea",     "kr"),
    "French":           ("France",          "fr"),
    "Vietnamese":       ("Vietnam",         "vn"),
    "German":           ("Germany",         "de"),
    "Urdu":             ("Pakistan",        "pk"),
    "Javanese":         ("Indonesia",       "id"),
    "Italian":          ("Italy",           "it"),
}

def download_flag(code: str) -> bytes:
    url = f"https://flagcdn.com/w80/{code.lower()}.png"
    logger.info(f"Downloading flag for code: {code} from {url}")
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    logger.info(f"Successfully downloaded flag for {code}")
    return resp.content

def main():
    # Ensure database directory exists
    os.makedirs(DB_DIR, exist_ok=True)
    
    logger.info(f"Connecting to database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if the languages table already exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='languages'")
    table_exists = cur.fetchone() is not None
    
    if not table_exists:
        # Get the absolute path to ddl.sql
        ddl_path = os.path.join(DB_DIR, "ddl.sql")
        logger.info(f"Initializing database schema from {ddl_path}")
        
        with open(ddl_path, "r") as f:
            cur.executescript(f.read())
        logger.info("Created database schema from ddl.sql")
    else:
        logger.info("Database schema already exists, skipping DDL execution")


    for lang, (country, code) in LANG_META.items():
        try:
            img = download_flag(code)
        except Exception as e:
            logger.warning(f"⚠️ Skipping {lang}: could not fetch flag → {e}")
            img = None

        cur.execute("""
            INSERT OR REPLACE INTO languages(language, picture)
            VALUES (?, ?)
        """, (lang, img))
        logger.info(f"Inserted/Updated: {lang} ({country})")

    conn.commit()
    conn.close()
    logger.info("Languages initialization completed successfully")
    
if __name__ == "__main__":
    main()
