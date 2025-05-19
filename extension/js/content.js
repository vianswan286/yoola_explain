// Yoola Content Script
// This script runs in the context of web pages to find and extract terms of service

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
