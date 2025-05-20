// Yoola Background Script
// Handles background tasks and manages extension lifecycle

// Backend API URL
const API_URL = 'http://127.0.0.1:8000';

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  // Create context menu item for terms of service links
  chrome.contextMenus.create({
    id: 'yoola-summarize',
    title: 'Summarize Terms with Yoola',
    contexts: ['link'],
    documentUrlPatterns: ['<all_urls>']
  });
  if (details.reason === 'install') {
    // Set default settings for new installations
    chrome.storage.sync.set({
      autoDetect: true,
      notificationsEnabled: true,
      aiProvider: 'gpt',
      theme: 'light'
    });
    
    // Open onboarding page on installation
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  } else if (details.reason === 'update') {
    // Handle updates if needed
    const newVersion = chrome.runtime.getManifest().version;
    console.log(`Yoola updated to version ${newVersion}`);
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle various message types
  switch (request.action) {
    case 'getSettings':
      getSettings().then(sendResponse);
      return true;
      
    case 'checkCache':
      checkSummaryCache(request.url).then(sendResponse);
      return true;
      
    case 'clearCache':
      clearCache().then(sendResponse);
      return true;
  }
});

// Get user settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (settings) => {
      resolve(settings);
    });
  });
}

// Check if we have a cached summary for the given URL
async function checkSummaryCache(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ cached: false });
      return;
    }
    
    const domain = new URL(url).hostname;
    
    chrome.storage.local.get(['summaryCache'], (result) => {
      const cache = result.summaryCache || {};
      
      if (cache[domain] && cache[domain].timestamp) {
        // Check if cache is still valid (1 week)
        const now = Date.now();
        const cacheTime = cache[domain].timestamp;
        const cacheAge = now - cacheTime;
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        
        if (cacheAge < weekInMs) {
          resolve({ 
            cached: true, 
            data: cache[domain].data 
          });
          return;
        }
      }
      
      resolve({ cached: false });
    });
  });
}

// Clear all cached summaries
async function clearCache() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['summaryCache'], () => {
      resolve({ success: true });
    });
  });
}

// Cache a summary for future use
async function cacheSummary(domain, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['summaryCache'], (result) => {
      const cache = result.summaryCache || {};
      
      // Add to cache with timestamp
      cache[domain] = {
        data: data,
        timestamp: Date.now()
      };
      
      chrome.storage.local.set({ summaryCache: cache }, () => {
        resolve({ success: true });
      });
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'yoola-summarize') {
    // Get the URL from the clicked link
    const url = info.linkUrl;
    
    // Extract the domain
    const domain = new URL(url).hostname;
    
    // Check if it's likely a terms of service link
    const tosPatterns = [
      /terms/i, /conditions/i, /privacy/i, /policy/i, /agreement/i, /legal/i
    ];
    
    const isTosLink = tosPatterns.some(pattern => {
      return pattern.test(url) || (info.linkText && pattern.test(info.linkText));
    });
    
    // If it looks like a ToS link, show the summary
    if (isTosLink) {
      showSummary(url, domain, tab.id);
    } else {
      // Ask for confirmation if it doesn't look like a ToS link
      chrome.tabs.sendMessage(tab.id, {
        action: 'confirmSummarize',
        url: url,
        domain: domain
      });
    }
  }
});

// Function to fetch and show summary
function showSummary(url, domain, tabId) {
  // Fetch summary from API
  fetch(`${API_URL}/summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      domain: domain,
      url: url,
      content: ''
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    // Store summary in local storage for popup
    chrome.storage.local.set({
      currentSummary: data,
      summaryUrl: url,
      summaryDomain: domain
    }, () => {
      // Send message to content script to show modal if available
      chrome.tabs.sendMessage(tabId, {
        action: 'showSummary',
        summary: data
      });
      
      // Open popup
      chrome.action.openPopup();
    });
  })
  .catch(error => {
    console.error('Error fetching summary:', error);
    // Notify user of error
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      error: error.message
    });
  });
}

// Optional: Track terms of service seen by user to improve detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react when a page has completely loaded
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we should auto-detect terms
    chrome.storage.sync.get(['autoDetect'], (settings) => {
      if (settings.autoDetect) {
        // Send message to content script to check for terms
        chrome.tabs.sendMessage(tabId, { action: 'checkForTerms' })
          .then(response => {
            if (response && response.found) {
              // Notify the user that terms were found
              chrome.action.setBadgeText({ 
                text: '!',
                tabId: tabId
              });
              chrome.action.setBadgeBackgroundColor({ 
                color: '#4A6FDC',
                tabId: tabId
              });
              
              // If notifications are enabled, show a notification
              chrome.storage.sync.get(['notificationsEnabled'], (settings) => {
                if (settings.notificationsEnabled) {
                  chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon128.png',
                    title: 'Yoola Terms Detector',
                    message: 'Terms of service detected on this page. Click to view summary.'
                  });
                }
              });
            } else {
              // Clear badge if no terms found
              chrome.action.setBadgeText({ 
                text: '',
                tabId: tabId
              });
            }
          })
          .catch(error => {
            console.error('Error checking for terms:', error);
          });
      }
    });
  }
});
