PRAGMA foreign_keys = ON;

-- tables
CREATE TABLE yoola (
  id            INTEGER PRIMARY KEY,
  content       TEXT    NOT NULL,
  url           TEXT,
  content_hash  TEXT
);

CREATE TABLE languages (
  language  TEXT PRIMARY KEY,
  picture   BLOB
);

CREATE TABLE yoola_lang_summary (
  yoola_id     INTEGER NOT NULL,
  language     TEXT    NOT NULL,
  summary      JSON    NOT NULL,
  request_num  INTEGER NOT NULL,
  PRIMARY KEY (yoola_id, language),
  FOREIGN KEY (yoola_id) REFERENCES yoola(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (language) REFERENCES languages(language)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Note: Removed the trigger that uses md5 function since SQLite doesn't have this built-in
-- We'll compute the hash in Python code instead

-- indexes on yoola
CREATE INDEX idx_yoola_id           ON yoola(id);
CREATE INDEX idx_yoola_content      ON yoola(content);
CREATE INDEX idx_yoola_url          ON yoola(url);
CREATE INDEX idx_yoola_content_hash ON yoola(content_hash);

-- indexes on languages
CREATE INDEX idx_languages_language ON languages(language);
CREATE INDEX idx_languages_picture  ON languages(picture);

-- indexes on yoola_lang_summary
CREATE INDEX idx_yls_yoola_id     ON yoola_lang_summary(yoola_id);
CREATE INDEX idx_yls_language     ON yoola_lang_summary(language);
CREATE INDEX idx_yls_summary      ON yoola_lang_summary(summary);
CREATE INDEX idx_yls_request_num  ON yoola_lang_summary(request_num);
