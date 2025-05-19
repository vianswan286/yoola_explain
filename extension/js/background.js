// Yoola Background Script
// Handles background tasks and manages extension lifecycle

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
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
