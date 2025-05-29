/**
 * Yoola - Options Page Script
 * Handles settings for the Yoola extension
 */

// DOM elements
const apiUrlInput = document.getElementById('api-url');
const defaultLanguageSelect = document.getElementById('default-language');
const highlightLinksCheckbox = document.getElementById('highlight-links');
const showIndicatorsCheckbox = document.getElementById('show-indicators');
const saveButton = document.getElementById('save-btn');
const resetButton = document.getElementById('reset-btn');
const statusMessage = document.getElementById('status-message');

// Default settings
const DEFAULT_SETTINGS = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  preferredLanguage: 'English',
  highlightLinks: true,
  showIndicators: true
};

// Initialize the options page
async function initOptions() {
  // Load available languages
  await loadLanguages();
  
  // Load saved settings
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
  
  console.log('Yoola options page initialized');
}

// Load the available languages
async function loadLanguages() {
  try {
    // Get languages from background script
    const { languages } = await chrome.runtime.sendMessage({ action: 'getAvailableLanguages' });
    
    // Populate the language dropdown
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      defaultLanguageSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading languages:', error);
    showStatus('Error loading languages', false);
  }
}

// Load saved settings from storage
function loadSettings() {
  chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (items) => {
    // Merge with defaults for any missing items
    const settings = { ...DEFAULT_SETTINGS, ...items };
    
    // Populate form with settings
    apiUrlInput.value = settings.apiBaseUrl;
    defaultLanguageSelect.value = settings.preferredLanguage;
    highlightLinksCheckbox.checked = settings.highlightLinks;
    showIndicatorsCheckbox.checked = settings.showIndicators;
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    apiBaseUrl: apiUrlInput.value.trim(),
    preferredLanguage: defaultLanguageSelect.value,
    highlightLinks: highlightLinksCheckbox.checked,
    showIndicators: showIndicatorsCheckbox.checked
  };
  
  // Validate API URL
  if (!isValidUrl(settings.apiBaseUrl)) {
    showStatus('Please enter a valid API URL', false);
    return;
  }
  
  // Save to storage
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving settings:', chrome.runtime.lastError);
      showStatus('Error saving settings', false);
    } else {
      console.log('Settings saved:', settings);
      showStatus('Settings saved successfully', true);
      
      // Notify background script that settings changed
      chrome.runtime.sendMessage({ action: 'settingsUpdated' });
    }
  });
}

// Reset settings to defaults
function resetSettings() {
  // Apply default settings to form
  apiUrlInput.value = DEFAULT_SETTINGS.apiBaseUrl;
  defaultLanguageSelect.value = DEFAULT_SETTINGS.preferredLanguage;
  highlightLinksCheckbox.checked = DEFAULT_SETTINGS.highlightLinks;
  showIndicatorsCheckbox.checked = DEFAULT_SETTINGS.showIndicators;
  
  // Save to storage
  chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
    if (chrome.runtime.lastError) {
      console.error('Error resetting settings:', chrome.runtime.lastError);
      showStatus('Error resetting settings', false);
    } else {
      console.log('Settings reset to defaults');
      showStatus('Settings reset to defaults', true);
      
      // Notify background script that settings changed
      chrome.runtime.sendMessage({ action: 'settingsUpdated' });
    }
  });
}

// Set up event listeners
function setupEventListeners() {
  // Save settings
  saveButton.addEventListener('click', saveSettings);
  
  // Reset settings
  resetButton.addEventListener('click', resetSettings);
}

// Show a status message
function showStatus(message, isSuccess) {
  statusMessage.textContent = message;
  statusMessage.className = isSuccess ? 'success' : 'error';
  
  // Hide the message after 3 seconds
  setTimeout(() => {
    statusMessage.style.opacity = '0';
  }, 3000);
}

// Validate URL format
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

// Initialize the options page when the DOM is loaded
document.addEventListener('DOMContentLoaded', initOptions);
