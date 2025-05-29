from openrouter_api import summarize_terms
from database.db import get_summary_by_content, add_or_update_summary
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/test")
def test():
    return "test"

@app.get("/get_summary")
def get_summary(content: str, domain: str, url: str, language: str):
    ans = get_summary_by_content(content=content, language=language)
    if ans == None:
        ans = summarize_terms(content=content, domain=domain, url=url, language = language)
        add_or_update_summary(content=content, summary_data=ans, url=url, language=language)
    return ans

if __name__ == '__main__':
    uvicorn.run(app, host="127.0.0.1", port = 8000)
