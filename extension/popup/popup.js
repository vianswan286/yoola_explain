/**
 * Yoola - Popup Script
 * Handles the popup UI and interactions
 */

// DOM elements
const initialView = document.getElementById('initial-view');
const loadingView = document.getElementById('loading-view');
const errorView = document.getElementById('error-view');
const notTermsView = document.getElementById('not-terms-view');
const errorMessage = document.getElementById('error-message');
const languageSelect = document.getElementById('language-select');

// Buttons
const summarizePageBtn = document.getElementById('summarize-page');
const openOptionsBtn = document.getElementById('open-options');
const tryAgainBtn = document.getElementById('try-again');
const forceSummarizeBtn = document.getElementById('force-summarize');
const cancelSummarizeBtn = document.getElementById('cancel-summarize');

// State
let currentTabId = null;
let currentUrl = null;

// Initialize the popup
async function initPopup() {
  // Get the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;
  currentUrl = tab.url;

  // Load available languages
  loadLanguages();

  // Set up event listeners
  setupEventListeners();

  console.log('Yoola popup initialized for tab:', currentTabId);
}

// Load the available languages
async function loadLanguages() {
  try {
    // Get languages from background script
    const { languages } = await chrome.runtime.sendMessage({ action: 'getAvailableLanguages' });
    
    // Get user's preferred language
    const { preferredLanguage = 'English' } = await chrome.storage.sync.get(['preferredLanguage']);
    
    // Populate the language dropdown
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      languageSelect.appendChild(option);
    });
    
    // Set the selected language
    languageSelect.value = preferredLanguage;
  } catch (error) {
    console.error('Error loading languages:', error);
  }
}

// Set up event listeners for buttons
function setupEventListeners() {
  // Summarize the current page
  summarizePageBtn.addEventListener('click', () => {
    summarizeCurrentPage();
  });
  
  // Open options page
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Try again after error
  tryAgainBtn.addEventListener('click', () => {
    showView(initialView);
  });
  
  // Force summarize even if not a terms page
  forceSummarizeBtn.addEventListener('click', () => {
    summarizeCurrentPage(true);
  });
  
  // Cancel summarization
  cancelSummarizeBtn.addEventListener('click', () => {
    showView(initialView);
  });
  
  // Language selection change
  languageSelect.addEventListener('change', () => {
    const selectedLanguage = languageSelect.value;
    chrome.storage.sync.set({ preferredLanguage: selectedLanguage });
  });
}

// Show a specific view and hide others
function showView(viewToShow) {
  // Hide all views
  initialView.classList.add('hidden');
  loadingView.classList.add('hidden');
  errorView.classList.add('hidden');
  notTermsView.classList.add('hidden');
  
  // Show the requested view
  viewToShow.classList.remove('hidden');
}

// Summarize the current page
async function summarizeCurrentPage(force = false) {
  try {
    showView(loadingView);
    
    // Get the selected language
    const language = languageSelect.value;
    
    // First, directly extract the page content using executeScript
    let pageContent;
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => {
          return {
            content: document.body.innerText,
            domain: window.location.hostname,
            url: window.location.href,
            title: document.title
          };
        }
      });
      
      pageContent = result[0].result;
      console.log('Extracted content:', {
        contentLength: pageContent.content.length,
        domain: pageContent.domain,
        url: pageContent.url
      });
      
      if (!pageContent.content || pageContent.content.length < 100) {
        throw new Error('Not enough content found on this page to summarize');
      }
    } catch (e) {
      console.error('Error extracting content:', e);
      throw new Error('Could not extract content from the current page: ' + e.message);
    }
    
    try {
      // Show message that we're generating a summary
      errorMessage.textContent = 'Generating summary in ' + language + '...';
      showView(loadingView);
      
      // Construct API URL
      const apiUrl = 'http://127.0.0.1:8000/get_summary';
      const params = new URLSearchParams({
        content: pageContent.content,
        domain: pageContent.domain,
        url: pageContent.url,
        language: language
      });
      
      const fullUrl = `${apiUrl}?${params}`;
      console.log('Requesting summary with URL:', fullUrl.substring(0, 100) + '...');
      
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const summary = await response.json();
      
      // Add the extracted content to the summary object
      summary.content = pageContent.content;
      summary.domain = pageContent.domain;
      summary.url = pageContent.url;
      summary.language = language;
      
      // Now inject content script to show the summary
      try {
        console.log('Injecting content script into tab ID:', currentTabId);
        
        // First, check if we can communicate with an existing content script
        let contentScriptReady = false;
        try {
          const pingResponse = await chrome.tabs.sendMessage(currentTabId, { action: 'ping' })
            .catch(() => null);
          contentScriptReady = !!pingResponse;
        } catch (e) {
          // Content script not ready
          contentScriptReady = false;
        }
        
        // Inject content script if not already loaded
        if (!contentScriptReady) {
          console.log('Content script not ready, injecting...');
          await chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            files: ['content.js']
          });
          console.log('Content script injected successfully');
          
          // Give content script time to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log('Content script already loaded');
        }
        
        // Show the summary on the page
        console.log('Sending showSummary message to content script');
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'showSummary',
          summary: summary
        }).catch(e => {
          console.error('Failed to send summary to content script:', e);
          errorMessage.textContent = 'Failed to display summary. Try refreshing the page.';
          showView(errorView);
          return;
        });
        
        // Success - close the popup
        window.close();
      } catch (error) {
        console.error('Error showing summary:', error);
        errorMessage.textContent = error.message || 'An error occurred while displaying the summary';
        showView(errorView);
      }
    } catch (e) {
      console.error('Error fetching summary:', e);
      errorMessage.textContent = e.message || 'Failed to fetch summary';
      showView(errorView);
    }
  } catch (error) {
    console.error('Error summarizing page:', error);
    errorMessage.textContent = error.message || 'Failed to summarize the page';
    showView(errorView);
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'setLoading') {
    if (message.isLoading) {
      showView(loadingView);
    }
  } else if (message.action === 'showError') {
    errorMessage.textContent = message.error;
    showView(errorView);
  }
});

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);
