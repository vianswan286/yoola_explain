// Yoola Content Script
// This script runs in the context of web pages to find and extract terms of service

// Create and inject the modal styles
function injectStyles() {
  const styleId = 'yoola-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .yoola-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .yoola-modal {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      width: 80%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
    }
    
    .yoola-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e4e8f0;
    }
    
    .yoola-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #4A6FDC;
    }
    
    .yoola-title h2 {
      margin: 0;
      font-size: 20px;
    }
    
    .yoola-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #777;
    }
    
    .yoola-source {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .yoola-source-info {
      font-size: 14px;
    }
    
    .yoola-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      color: white;
      background-color: #27ae60;
    }
    
    .yoola-ai {
      background-color: #f39c12;
    }
    
    .yoola-content {
      margin-bottom: 20px;
    }
    
    .yoola-content h3 {
      font-size: 16px;
      color: #4A6FDC;
      margin: 15px 0 8px 0;
    }
    
    .yoola-content p, .yoola-content li {
      margin: 0 0 8px 0;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }
    
    .yoola-content ul {
      padding-left: 20px;
    }
    
    .yoola-alert {
      background-color: #fff5f5;
      border-left: 4px solid #e74c3c;
      padding: 10px;
      margin-bottom: 15px;
    }
    
    .yoola-alert h3 {
      color: #e74c3c;
      margin-top: 0;
    }
    
    .yoola-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e4e8f0;
    }
    
    .yoola-footer button {
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .yoola-primary {
      background-color: #4A6FDC;
      color: white;
      border: none;
    }
    
    .yoola-primary:hover {
      background-color: #6B8AE5;
    }
    
    .yoola-secondary {
      background-color: #e4e8f0;
      color: #333;
      border: none;
    }
    
    .yoola-secondary:hover {
      background-color: #d1d7e0;
    }
    
    .yoola-branding {
      font-size: 12px;
      color: #777;
    }
    
    .yoola-confirmation {
      text-align: center;
    }
    
    .yoola-confirmation p {
      margin-bottom: 20px;
    }
    
    .yoola-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
  `;
  
  document.head.appendChild(style);
}

// Create and show confirmation dialog
function showConfirmation(url, domain) {
  injectStyles();
  
  // Create modal elements
  const overlay = document.createElement('div');
  overlay.className = 'yoola-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'yoola-modal yoola-confirmation';
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  modal.innerHTML = `
    <div class="yoola-header">
      <div class="yoola-title">
        <img src="${chrome.runtime.getURL('images/icon48.png')}" width="24" height="24" alt="Yoola">
        <h2>Yoola Summarizer</h2>
      </div>
      <button class="yoola-close">&times;</button>
    </div>
    <p>This link doesn't appear to be a terms of service page. Would you still like to summarize it?</p>
    <div class="yoola-source">
      <div class="yoola-source-info">${domain}</div>
    </div>
    <div class="yoola-actions">
      <button class="yoola-secondary yoola-cancel">Cancel</button>
      <button class="yoola-primary yoola-confirm">Summarize Anyway</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Add event listeners
  modal.querySelector('.yoola-close').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  modal.querySelector('.yoola-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  modal.querySelector('.yoola-confirm').addEventListener('click', () => {
    document.body.removeChild(overlay);
    chrome.runtime.sendMessage({
      action: 'summarizeUrl',
      url: url,
      domain: domain
    });
  });
}

// Display summary in a modal
function displaySummary(summary) {
  injectStyles();
  
  // Create modal elements
  const overlay = document.createElement('div');
  overlay.className = 'yoola-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'yoola-modal';
  
  // Format date
  const date = new Date(summary.createdAt);
  const formattedDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  
  // Format content
  let content = '';
  
  // Key points
  if (summary.keyPoints && summary.keyPoints.length > 0) {
    content += '<h3>Key Points</h3><ul>';
    summary.keyPoints.forEach(point => {
      content += `<li>${point}</li>`;
    });
    content += '</ul>';
  }
  
  // Data collection
  if (summary.dataCollection) {
    content += `<h3>Data Collection</h3><p>${summary.dataCollection}</p>`;
  }
  
  // User rights
  if (summary.userRights) {
    content += `<h3>Your Rights</h3><p>${summary.userRights}</p>`;
  }
  
  // Alerts
  if (summary.alerts && summary.alerts.length > 0) {
    content += '<div class="yoola-alert"><h3>⚠️ Important Alerts</h3><ul>';
    summary.alerts.forEach(alert => {
      content += `<li>${alert}</li>`;
    });
    content += '</ul></div>';
  }
  
  modal.innerHTML = `
    <div class="yoola-header">
      <div class="yoola-title">
        <img src="${chrome.runtime.getURL('images/icon48.png')}" width="24" height="24" alt="Yoola">
        <h2>Terms Summary</h2>
      </div>
      <button class="yoola-close">&times;</button>
    </div>
    <div class="yoola-source">
      <div class="yoola-source-info">
        <div>${new URL(summary.originalUrl).hostname}</div>
        <div style="font-size: 12px; color: #666;">${formattedDate}</div>
      </div>
      <div class="yoola-badge ${summary.isReviewed ? '' : 'yoola-ai'}">
        ${summary.isReviewed ? 'Pre-Approved' : 'AI Generated'}
      </div>
    </div>
    <div class="yoola-content">
      ${content}
    </div>
    <div class="yoola-footer">
      <button class="yoola-secondary yoola-view-original">View Original</button>
      <div class="yoola-branding">Powered by Yoola</div>
    </div>
  `;
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Add event listeners
  modal.querySelector('.yoola-close').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  modal.querySelector('.yoola-view-original').addEventListener('click', () => {
    window.location.href = summary.originalUrl;
  });
}

// Show error message
function showError(errorMessage) {
  injectStyles();
  
  // Create modal elements
  const overlay = document.createElement('div');
  overlay.className = 'yoola-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'yoola-modal yoola-confirmation';
  
  modal.innerHTML = `
    <div class="yoola-header">
      <div class="yoola-title">
        <img src="${chrome.runtime.getURL('images/icon48.png')}" width="24" height="24" alt="Yoola">
        <h2>Yoola Error</h2>
      </div>
      <button class="yoola-close">&times;</button>
    </div>
    <p>Sorry, we couldn't generate a summary. ${errorMessage || 'Please try again later.'}</p>
    <div class="yoola-actions">
      <button class="yoola-primary yoola-close-btn">Close</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  // Add event listeners
  const closeButtons = modal.querySelectorAll('.yoola-close, .yoola-close-btn');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  });
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if we can connect to the page
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  // Check for terms of service on the page
  if (request.action === 'checkForTerms') {
    const results = findTermsOfService();
    sendResponse(results);
    return true;
  }
  
  // Confirm if a link should be summarized
  if (request.action === 'confirmSummarize') {
    showConfirmation(request.url, request.domain);
    return true;
  }
  
  // Show summary in a modal
  if (request.action === 'showSummary') {
    displaySummary(request.summary);
    return true;
  }
  
  // Show error message
  if (request.action === 'showError') {
    showError(request.error);
    return true;
  }
  
  // Handle other actions as needed
  return true;
});

// Function to detect and extract terms of service on the current page
function findTermsOfService() {
  try {
    // Common terms of service URL patterns
    const tosUrlPatterns = [
      /terms[-_]of[-_]service/i,
      /terms[-_]and[-_]conditions/i,
      /user[-_]agreement/i,
      /privacy[-_]policy/i,
      /legal[-_]terms/i,
      /terms[-_]of[-_]use/i
    ];
    
    // Common heading and container patterns
    const tosHeadingPatterns = [
      /terms of service/i,
      /terms and conditions/i,
      /user agreement/i,
      /privacy policy/i,
      /legal terms/i,
      /terms of use/i
    ];
    
    // Check if the current URL is a terms page
    const currentUrl = window.location.href.toLowerCase();
    const isTermsPage = tosUrlPatterns.some(pattern => pattern.test(currentUrl));
    
    // If we're already on a terms page, extract the content
    if (isTermsPage) {
      return {
        found: true,
        onTermsPage: true,
        content: extractTermsContent(),
        url: window.location.href
      };
    }
    
    // Otherwise, look for links to terms pages
    const links = Array.from(document.querySelectorAll('a'));
    const termsLinks = links.filter(link => {
      // Check link text
      const hasMatchingText = link.textContent && 
                             tosHeadingPatterns.some(pattern => pattern.test(link.textContent));
      
      // Check href attribute
      const hasMatchingHref = link.href && 
                             tosUrlPatterns.some(pattern => pattern.test(link.href));
      
      return hasMatchingText || hasMatchingHref;
    });
    
    if (termsLinks.length > 0) {
      // Found at least one terms link
      return {
        found: true,
        onTermsPage: false,
        links: termsLinks.map(link => ({
          text: link.textContent.trim(),
          url: link.href
        }))
      };
    }
    
    // Last resort: check for terms content directly in the page
    const contentSections = findTermsContentSections();
    if (contentSections) {
      return {
        found: true,
        onTermsPage: true,
        content: contentSections,
        url: window.location.href
      };
    }
    
    // No terms found
    return {
      found: false
    };
  } catch (error) {
    console.error('Error finding terms of service:', error);
    return {
      found: false,
      error: error.message
    };
  }
}

// Extract terms content from the current page
function extractTermsContent() {
  // Try to find the main content container
  const possibleContainers = [
    // Common main content selectors
    document.querySelector('main'),
    document.querySelector('article'),
    document.querySelector('.content'),
    document.querySelector('#content'),
    document.querySelector('.terms'),
    document.querySelector('#terms'),
    
    // Fallback to body if nothing else found
    document.body
  ];
  
  // Use the first valid container found
  const container = possibleContainers.find(el => el !== null);
  
  if (!container) {
    return '';
  }
  
  // Clone the container to avoid modifying the page
  const containerClone = container.cloneNode(true);
  
  // Remove unnecessary elements
  const nodesToRemove = containerClone.querySelectorAll(
    'header, footer, nav, aside, script, style, .header, .footer, .navigation, .sidebar, .ad, .advertisement'
  );
  
  nodesToRemove.forEach(node => {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  
  // Get text content, removing excessive whitespace
  return containerClone.textContent
    .replace(/\s+/g, ' ')
    .trim();
}

// Find terms content sections directly in the page
function findTermsContentSections() {
  // Look for headings that might indicate terms of service sections
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  
  const termsHeadings = headings.filter(heading => {
    const text = heading.textContent.toLowerCase();
    return (
      text.includes('terms') ||
      text.includes('conditions') ||
      text.includes('agreement') ||
      text.includes('privacy') ||
      text.includes('policy') ||
      text.includes('legal')
    );
  });
  
  if (termsHeadings.length === 0) {
    return null;
  }
  
  // Extract content from each section
  let content = '';
  
  termsHeadings.forEach(heading => {
    content += heading.textContent.trim() + '\n\n';
    
    // Get all siblings until the next heading
    let element = heading.nextElementSibling;
    while (element && !element.tagName.match(/^H[1-6]$/i)) {
      content += element.textContent.trim() + '\n';
      element = element.nextElementSibling;
    }
    
    content += '\n';
  });
  
  return content.trim();
}
