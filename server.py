from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="GazeFollower SDK Server")

# Get the directory of this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount the entire directory as static files
# The '/' route will serve index.html by default
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # For local testing without HTTPS, webcam works on 127.0.0.1 or localhost
    print("\n--- GazeFollower Server ---")
    print("Webcam access requires localhost or HTTPS!")
    print("Open http://localhost:8000 in your browser.\n")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
