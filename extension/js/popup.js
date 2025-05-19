document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const stateElements = {
    loading: document.getElementById('loading'),
    noTerms: document.getElementById('no-terms'),
    summary: document.getElementById('summary'),
    error: document.getElementById('error')
  };

  const summaryElements = {
    websiteName: document.getElementById('website-name'),
    summaryDate: document.getElementById('summary-date'),
    sourceBadge: document.getElementById('source-badge'),
    content: document.getElementById('summary-content')
  };

  // Buttons
  const manualCheckBtn = document.getElementById('manual-check');
  const viewOriginalBtn = document.getElementById('view-original');
  const copySummaryBtn = document.getElementById('copy-summary');
  const retryButton = document.getElementById('retry-button');
  const settingsButton = document.getElementById('settings-button');

  // Helper to show a specific state and hide others
  function showState(stateId) {
    Object.keys(stateElements).forEach(key => {
      stateElements[key].classList.toggle('hidden', key !== stateId);
    });
  }

  // Format date for display
  function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  // Copy summary to clipboard
  async function copySummary() {
    try {
      const summaryText = summaryElements.content.textContent;
      await navigator.clipboard.writeText(summaryText);
      
      // Show temporary "Copied" text on button
      const originalText = copySummaryBtn.textContent;
      copySummaryBtn.textContent = "Copied!";
      setTimeout(() => {
        copySummaryBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  }

  // Get current tab information
  async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  // Request summary for current page
  async function requestSummary(tabId, url) {
    try {
      showState('loading');
      
      // First check if there are terms on the page
      const hasTerms = await chrome.tabs.sendMessage(tabId, { action: 'checkForTerms' });
      
      if (!hasTerms.found) {
        showState('noTerms');
        return;
      }

      // Extract domain for API request
      const domain = new URL(url).hostname;
      
      // Make API request to backend
      const apiUrl = 'https://api.yoola.app/summary';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domain,
          url: url,
          content: hasTerms.content || ''
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      displaySummary(data, domain);
    } catch (error) {
      console.error('Error fetching summary:', error);
      showState('error');
    }
  }

  // Display summary data
  function displaySummary(data, domain) {
    summaryElements.websiteName.textContent = domain;
    summaryElements.summaryDate.textContent = formatDate(data.createdAt);
    
    // Set source badge
    if (data.isReviewed) {
      summaryElements.sourceBadge.textContent = 'Pre-Approved';
      summaryElements.sourceBadge.style.backgroundColor = 'var(--success)';
    } else {
      summaryElements.sourceBadge.textContent = 'AI Generated';
      summaryElements.sourceBadge.style.backgroundColor = 'var(--warning)';
    }

    // Format summary content
    let formattedSummary = '';
    
    // Key points
    if (data.keyPoints && data.keyPoints.length > 0) {
      formattedSummary += '<h3>Key Points</h3><ul>';
      data.keyPoints.forEach(point => {
        formattedSummary += `<li>${point}</li>`;
      });
      formattedSummary += '</ul>';
    }
    
    // Data collection
    if (data.dataCollection) {
      formattedSummary += '<h3>Data Collection</h3>';
      formattedSummary += `<p>${data.dataCollection}</p>`;
    }
    
    // User rights
    if (data.userRights) {
      formattedSummary += '<h3>Your Rights</h3>';
      formattedSummary += `<p>${data.userRights}</p>`;
    }

    // Important alerts
    if (data.alerts && data.alerts.length > 0) {
      formattedSummary += '<h3>⚠️ Important Alerts</h3><ul>';
      data.alerts.forEach(alert => {
        formattedSummary += `<li>${alert}</li>`;
      });
      formattedSummary += '</ul>';
    }

    summaryElements.content.innerHTML = formattedSummary;
    
    // Store original terms URL if available
    if (data.originalUrl) {
      viewOriginalBtn.dataset.url = data.originalUrl;
    } else {
      viewOriginalBtn.dataset.url = window.location.href;
    }
    
    showState('summary');
  }

  // Initialize the popup
  async function initPopup() {
    showState('loading');
    
    try {
      const tab = await getCurrentTab();
      
      // Check if the extension is connected to the page
      const connected = await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
        .catch(() => ({ success: false }));
      
      if (!connected || !connected.success) {
        // Inject the content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['js/content.js']
        });
      }
      
      // Request summary for the current page
      requestSummary(tab.id, tab.url);
    } catch (error) {
      console.error('Initialization error:', error);
      showState('error');
    }
  }

  // Event listeners
  manualCheckBtn.addEventListener('click', async () => {
    const tab = await getCurrentTab();
    requestSummary(tab.id, tab.url);
  });

  viewOriginalBtn.addEventListener('click', async () => {
    const url = viewOriginalBtn.dataset.url;
    if (url) {
      const tab = await getCurrentTab();
      chrome.tabs.update(tab.id, { url });
    }
  });

  copySummaryBtn.addEventListener('click', copySummary);

  retryButton.addEventListener('click', async () => {
    initPopup();
  });

  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initialize popup when opened
  initPopup();
});
