/**
 * Yoola - Background Script
 * Handles communication between the content script, popup, and the Yoola API
 */

// API endpoint configuration
const API_CONFIG = {
  baseUrl: 'http://127.0.0.1:8000',
  getSummaryEndpoint: '/get_summary'
};

// State management
let currentPageData = null;
let isCachingStatus = false;
let requestStartTime = 0;

// Clear context menus to prevent duplicates
try {
  chrome.contextMenus.removeAll();
} catch (e) {
  console.log('Context menu not yet initialized');
}

// Initialize the extension
function initExtension() {
  // Set up context menu
  try {
    chrome.contextMenus.create({
      id: 'yoolaSummarize',
      title: 'Summarize Terms with Yoola',
      contexts: ['link', 'page']
    });
  } catch (e) {
    console.error('Error creating context menu:', e);
  }

  // Listen for context menu clicks
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

  // Listen for messages from content scripts and popup
  chrome.runtime.onMessage.addListener(handleMessage);

  console.log('Yoola background script initialized');
}

// Handle context menu clicks
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'yoolaSummarize') {
    if (info.linkUrl) {
      // Summarize linked page
      try {
        // First, inject content script if not already injected
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (e) {
          console.log('Content script may already be injected or cannot be injected on this page');
          // Continue anyway, as the script might already be injected
        }
        
        // Get the user's preferred language
        const { preferredLanguage = 'English' } = await chrome.storage.sync.get(['preferredLanguage']);
        
        // Now navigate to the page and summarize it
        await summarizeExternalPage(info.linkUrl, tab.id, preferredLanguage);
      } catch (error) {
        console.error('Error summarizing linked page:', error);
        notifyError(tab.id, 'Could not summarize the linked page: ' + error.message);
      }
    } else {
      // Summarize current page
      try {
        // First, inject content script if not already injected
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (e) {
          console.log('Content script may already be injected or cannot be injected on this page');
          // Continue anyway, as the script might already be injected
        }
        
        await summarizeCurrentPage(tab.id);
      } catch (error) {
        console.error('Error summarizing current page:', error);
        notifyError(tab.id, 'Could not extract content from this page: ' + error.message);
      }
    }
  }
}

// Handle messages from content scripts and popup
function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'summarizeCurrentPage':
      summarizeCurrentPage(sender.tab?.id || message.tabId)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('Error summarizing current page:', error);
          sendResponse({ error: error.message });
        });
      return true; // Keep the message channel open for async response

    case 'summarizeTermsLink':
      summarizeExternalPage(message.url, sender.tab.id)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('Error summarizing linked page:', error);
          sendResponse({ error: error.message });
        });
      return true;

    case 'getSummaryInLanguage':
      if (!message.content) {
        sendResponse({ error: 'No content provided' });
        return true;
      }
      
      fetchSummaryFromAPI(message.content, message.domain, message.url, message.language)
        .then(summary => {
          // Add the extracted content to the summary object
          summary.content = message.content;
          summary.domain = message.domain;
          summary.url = message.url;
          summary.language = message.language;
          
          sendResponse({ summary });
        })
        .catch(error => {
          console.error('Error getting summary in language:', error);
          sendResponse({ error: error.message });
        });
      return true;
      
    case 'getAvailableLanguages':
      // This could be enhanced to fetch dynamically from the server
      const languages = [
        { name: 'English', code: 'English' },
        { name: 'Spanish', code: 'Spanish' },
        { name: 'Russian', code: 'Russian' },
        { name: 'French', code: 'French' },
        { name: 'German', code: 'German' },
        { name: 'Italian', code: 'Italian' },
        { name: 'Mandarin Chinese', code: 'Mandarin Chinese' },
        { name: 'Hindi', code: 'Hindi' },
        { name: 'Portuguese', code: 'Portuguese' },
        { name: 'Japanese', code: 'Japanese' },
        { name: 'Korean', code: 'Korean' }
      ];
      sendResponse({ languages });
      return false;
  }
}

// Summarize the current page
async function summarizeCurrentPage(tabId, specifiedLanguage = null) {
  if (!tabId) {
    throw new Error('No tab ID provided');
  }

  try {
    // Get the current user's preferred language or use the specified one
    const { preferredLanguage = 'English' } = await chrome.storage.sync.get(['preferredLanguage']);
    const language = specifiedLanguage || preferredLanguage;
    
    // Show loading message in the content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showLoadingOverlay',
        message: 'Analyzing page content...'
      }).catch(() => console.log('Content script may not be ready yet'));
    } catch (e) {
      console.log('Could not send loading message');
    }

    // Execute content script to extract the page content
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // This function runs in the context of the page
        if (typeof window.yoolaContent !== 'undefined') {
          return window.yoolaContent.extractPageContent();
        } else {
          // Fallback extraction if content script not initialized
          return {
            domain: window.location.hostname,
            url: window.location.href,
            title: document.title,
            content: document.body.textContent.trim()
          };
        }
      }
    }).catch(err => {
      throw new Error('Could not extract content from this page: ' + err.message);
    });
    
    if (!results || results.length === 0) {
      throw new Error('No content extraction results');
    }
    
    const { result } = results[0];

    if (!result) {
      throw new Error('No content extraction result');
    }

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.content || result.content.length < 100) {
      throw new Error('Not enough content found on this page to summarize');
    }

    // Store the current page data for later use
    currentPageData = result;

    // Update the loading message
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'updateLoadingStatus',
        message: `Generating summary in ${language}...`
      }).catch(() => console.log('Content script may not be ready yet'));
    } catch (e) {
      console.log('Could not send loading update');
    }

    // Fetch summary from API
    const summary = await fetchSummaryFromAPI(
      result.content,
      result.domain,
      result.url,
      language
    );

    // Add the extracted content to the summary object
    summary.content = result.content;
    summary.domain = result.domain;
    summary.url = result.url;
    summary.language = language;

    // Show the summary in the content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'showSummary',
      summary
    }).catch(err => {
      throw new Error('Could not display summary: ' + err.message);
    });

    return { success: true, summary };
  } catch (error) {
    console.error('Error in summarizeCurrentPage:', error);
    
    // Try to show error in content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showSummary',
        summary: { error: error.message || 'Unknown error occurred' }
      });
    } catch (e) {
      console.error('Could not show error in content script:', e);
    }
    
    throw error;
  }
}

// Summarize an external page by navigating to it first
async function summarizeExternalPage(url, tabId, language = 'English') {
  // Show a notification that we're navigating to the page
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showLoadingOverlay',
      message: 'Navigating to page to analyze terms...'
    }).catch(err => {
      console.log('Tab might not be ready yet, will try to inject content script');
    });
  } catch (e) {
    console.log('Could not send loading message, will continue');
  }
  
  // Navigate to the page first
  await chrome.tabs.update(tabId, { url });

  // Wait for the page to load with a reasonable timeout
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Page loading timed out'));
    }, 15000); // 15 second timeout
    
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // Give the page a moment to fully render and try to inject the content script if needed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Try to inject content script if not already injected
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => console.log('Content script may already be injected'));
  } catch (e) {
    console.log('Could not inject content script, will try to continue');
  }
  
  // Now summarize the loaded page with the specified language
  return summarizeCurrentPage(tabId, language);
}

// Fetch summary from the Yoola API
async function fetchSummaryFromAPI(content, domain, url, language = 'English') {
  // Validate required parameters
  if (!content || content === 'undefined') {
    throw new Error('No content provided for summarization');
  }
  
  // Ensure we have valid values for all parameters
  const validDomain = domain && domain !== 'undefined' ? domain : window.location.hostname || 'unknown';
  const validUrl = url && url !== 'undefined' ? url : window.location.href || 'https://unknown.com';
  
  // Log the request parameters (without the full content for brevity)
  console.log('Sending API request with params:', {
    content: content.substring(0, 50) + '... (truncated)',
    domain: validDomain,
    url: validUrl,
    language: language
  });

  const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.getSummaryEndpoint}`;

  // Set cache status tracking variables
  isCachingStatus = false;
  requestStartTime = Date.now();

  try {
    // Show loading state in the popup if it's open
    chrome.runtime.sendMessage({ action: 'setLoading', isLoading: true });

    // Start a timer to check if this is taking longer than 2 seconds
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        // If still waiting after 2 seconds, it's likely generating a new summary
        if (!isCachingStatus) {
          isCachingStatus = true;
          chrome.runtime.sendMessage({ 
            action: 'cachingStatus', 
            status: 'generating', 
            message: 'Generating new summary (not found in database)...'
          });
          
          // Send message to content script too (in case popup is closed)
          try {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                  action: 'updateLoadingStatus', 
                  message: 'Generating new summary (not found in database)...'
                }).catch(err => console.log('Tab not ready yet'));
              }
            });
          } catch (e) {
            console.log('Could not send message to content script');
          }
        }
        resolve();
      }, 2000);
    });

    // Run the timeout promise in parallel
    await timeoutPromise;
    
    // Instead of using URL parameters, let's use query parameters for shorter values
    // and append content to the URL instead of using it as a parameter
    const params = new URLSearchParams({
      domain: validDomain,
      url: validUrl,
      language: language,
      content: content.substring(0, 5000) // Limit content length to stay within URL limits
    });
    
    const fullApiUrl = `${apiUrl}?${params.toString()}`;
    const response = await fetch(fullApiUrl);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data) {
      throw new Error('No data returned from API');
    }
    
    // Calculate how long the request took
    const requestTime = Date.now() - requestStartTime;
    data.generationTime = requestTime;
    data.fromCache = requestTime < 2000; // Rough estimation if it came from cache
    
    return data;
  } catch (error) {
    console.error('Error fetching summary from API:', error);
    throw error;
  } finally {
    // Hide loading state in the popup
    chrome.runtime.sendMessage({ action: 'setLoading', isLoading: false }).catch(() => {
      // Ignore errors if popup is closed
    });
  }
}

// Send an error notification to the content script
async function notifyError(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showSummary',
      summary: { error: message }
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Update the API endpoint URL when options change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.apiBaseUrl) {
    API_CONFIG.baseUrl = changes.apiBaseUrl.newValue;
    console.log('Updated API base URL to:', API_CONFIG.baseUrl);
  }
});

// Initialize the extension
initExtension();
