"""
Test script for Yoola API summary endpoint
This script starts the API server automatically in a background thread
"""
import os
import sys
import requests
import json
import threading
import time
import signal
import uvicorn
from fastapi import FastAPI

# Add the server directory to the path to allow importing modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

# Import the necessary modules from the server
from openrouter_api import summarize_terms

# API endpoint details
API_URL = "http://127.0.0.1:8000/get_summary"
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

# The main application will be imported and run by Uvicorn directly.

# Server control variables
server_thread = None
should_exit = threading.Event()

def run_server():
    """Run the FastAPI server in a thread"""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    original_cwd = os.getcwd()
    original_sys_path = list(sys.path) # Make a copy
    try:
        # Add project root to sys.path and change CWD
        sys.path.insert(0, project_root)
        os.chdir(project_root)
        
        # Point Uvicorn to the 'app' instance in 'server/main.py'
        config = uvicorn.Config("server.main:app", host=SERVER_HOST, port=SERVER_PORT, log_level="info")
        server = uvicorn.Server(config)
        
        # Override the server's install_signal_handlers method to do nothing
        # This is to prevent Uvicorn from catching Ctrl+C, allowing the main thread to handle it
        server.install_signal_handlers = lambda: None
        
        # Run the server
        server.run()
    finally:
        os.chdir(original_cwd) # Restore the original working directory
        sys.path = original_sys_path # Restore original sys.path

def start_server():
    """Start the API server in a background thread"""
    global server_thread
    
    # Create and start the server thread
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Wait for the server to start
    print("Starting API server...")
    time.sleep(2)  # Wait for the server to initialize
    print(f"API server running at http://{SERVER_HOST}:{SERVER_PORT}")

def read_sample_tos():
    """Read the sample TOS file"""
    with open(os.path.join(os.path.dirname(__file__), 'sample_tos.txt'), 'r') as f:
        return f.read()

def test_summary_api():
    """Test the summary API endpoint with sample TOS"""
    # Read the sample TOS
    tos_content = read_sample_tos()
    
    # Prepare the request parameters
    params = {
        "content": tos_content,
        "domain": "examplecompany.com",
        "url": "https://www.examplecompany.com/tos",
        "language": "Russian"
    }
    
    # Make the request to the API
    try:
        print("Sending request to API...")
        response = requests.get(API_URL, params=params)
        
        # Check if the request was successful
        if response.status_code == 200:
            result = response.json()
            print("\n=== Summary Results ===")
            print(f"Status: Success (HTTP {response.status_code})")
            
            # Print the key points
            print("\nKey Points:")
            for i, point in enumerate(result.get("key_points", []), 1):
                print(f"{i}. {point}")
            
            # Print data collection info
            print("\nData Collection:")
            print(result.get("data_collection_summary", "Not available"))
            
            # Print user rights info
            print("\nUser Rights:")
            print(result.get("user_rights_summary", "Not available"))
            
            # Print alerts
            print("\nAlerts:")
            for i, alert in enumerate(result.get("alerts_and_warnings", []), 1):
                print(f"{i}. {alert}")
                
            return True
        else:
            print(f"Error: HTTP {response.status_code}")
            print(response.text)
            return False
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        print("Make sure the API server is running.")
        return False

if __name__ == "__main__":
    print("Yoola API Summary Test")
    print("======================")
    print("This test will start the API server and request a summary of the sample TOS.\n")
    
    try:
        # Start the server
        start_server()
        
        # Run the test
        test_summary_api()
    except KeyboardInterrupt:
        print("\nTest interrupted by user.")
    finally:
        print("\nTest completed. Press Ctrl+C to exit.")
        # The server thread will automatically terminate when the main thread exits
